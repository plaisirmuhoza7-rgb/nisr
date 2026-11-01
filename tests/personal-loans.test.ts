import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database,Sql} from '../src/server/db';
import {recordPersonalLoanPayment} from '../src/server/personal-loans';
import {accountTotal,repaymentSchedule,nextRepayment,safeRwf} from '../src/lib/personal-finance';

test('account totals include bank and wallet balances but not goal allocations',()=>{
 const accounts=[{balance:450000},{balance:185000}];
 const goals=[{saved:100000}];
 assert.equal(accountTotal(accounts),635000n);
 assert.notEqual(accountTotal(accounts),635000n+BigInt(goals[0].saved));
 assert.throws(()=>accountTotal([{balance:1.5}]));
});
test('principal schedules conserve RWF and respect month ends',()=>{
 const schedule=repaymentSchedule(100,3,'2028-01-31');
 assert.deepEqual(schedule,[{dueDate:'2028-01-31',amount:34},{dueDate:'2028-02-29',amount:33},{dueDate:'2028-03-31',amount:33}]);
 assert.deepEqual(nextRepayment(100,40,3,'2028-01-31'),{dueDate:'2028-02-29',amount:27});
 assert.equal(nextRepayment(100,100,3,'2028-01-31'),null);
 assert.throws(()=>repaymentSchedule(100,3,'2028-02-30'));
 assert.equal(repaymentSchedule(100,2,'0099-01-31')[1].dueDate,'0099-02-28');
 assert.throws(()=>repaymentSchedule(100,2,'9999-12-31'),/supported range/);
 assert.throws(()=>safeRwf(BigInt(Number.MAX_SAFE_INTEGER)+1n));
});
test('payments are scoped, atomic, reject excess and deduplicate references',async()=>{
 const pg=await PGlite.create();
 const db:Database={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)} as Sql))};
 try {
  for(const file of ['001-identity.sql','002-finance.sql','003-firebase-accounts.sql','017-personal-finance-extensions.sql','018-personal-loan-plans.sql']) await db.exec(await readFile('migrations/'+file,'utf8'));
  await db.query("INSERT INTO demo_tenants(id) VALUES('t'),('other')");
  await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES('u','User','u@test.invalid','x','member'),('other','Other','other@test.invalid','x','member')");
  await db.query("INSERT INTO personal_loans(id,tenant_id,user_id,counterparty_name,direction,amount,paid_amount) VALUES('loan','t','u','Lender','i_owe',100,10)");
  const actor={tenantId:'t',userId:'u',role:'member' as const};
  const payment={loanId:'loan',amount:30,paymentDate:'2026-11-01',reference:'payment-1'};
  await assert.rejects(recordPersonalLoanPayment(db,{...actor,userId:'other'},payment),/Loan not found/);
  await assert.rejects(recordPersonalLoanPayment(db,{...actor,tenantId:'other'},payment),/Loan not found/);
  await assert.rejects(recordPersonalLoanPayment(db,actor,{...payment,amount:-1}),/Invalid payment/);
  await assert.rejects(recordPersonalLoanPayment(db,actor,{...payment,paymentDate:'2026-02-30'}),/Invalid payment/);
  await recordPersonalLoanPayment(db,actor,payment);
  assert.equal((await recordPersonalLoanPayment(db,actor,payment)).duplicate,true);
  await assert.rejects(recordPersonalLoanPayment(db,actor,{...payment,amount:31}),/reference already used/);
  await assert.rejects(recordPersonalLoanPayment(db,actor,{...payment,reference:'another',amount:61}),/exceeds/);
  const loan=(await db.query("SELECT paid_amount,status FROM personal_loans WHERE id='loan'")).rows[0];
  assert.equal(Number(loan.paid_amount),40); assert.equal(loan.status,'partially_paid');
  const payments=(await db.query('SELECT amount,payment_date FROM personal_loan_payments')).rows;
  assert.equal(payments.length,1); assert.equal(Number(payments[0].amount),30);
  const concurrent=await Promise.allSettled([recordPersonalLoanPayment(db,actor,{...payment,reference:'final',amount:60}),recordPersonalLoanPayment(db,actor,{...payment,reference:'racing',amount:60})]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(concurrent.filter(x=>x.status==='rejected').length,1);
  assert.equal((await db.query("SELECT status FROM personal_loans WHERE id='loan'")).rows[0].status,'settled');
 } finally {await pg.close();}
});
