import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { Actor, ActionInput } from '../src/lib/contracts';
import type { Database, Sql } from '../src/server/db';
import { createSavingsGroup, joinSavingsGroup, financeAction, financeState, seedFinance, type NewSavingsGroup } from '../src/server/finance/service';

let pg: PGlite;
let db: Database;
let tenantNumber=0;

test('group administrator label preserves exact submitted text without granting roles',async()=>{
 const f=await fixture();
 const input:NewSavingsGroup={model:'ACCUMULATING',name:'Label test',description:'Synthetic label test',location:'Gasabo',contact:'0780000000',administratorLabel:'  member / named coordinator = president  ',expectedMembers:2,contributionAmount:1000,frequency:'monthly',startDate:'2026-01-01',endDate:'2027-01-01',shareOutDate:'2027-01-01',rotationOrder:[],reserveBps:0,accepted:true};
 const created=await createSavingsGroup(db,f.president,input);
 const policy=(await db.query('SELECT administrator_label,accepted_by FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[f.tenantId,created.orgId])).rows[0];
 assert.equal(policy.administrator_label,input.administratorLabel);assert.equal(policy.accepted_by,f.president.userId);
 const members=(await db.query('SELECT user_id,role FROM memberships WHERE tenant_id=$1 AND org_id=$2',[f.tenantId,created.orgId])).rows;
 assert.deepEqual(members,[{user_id:f.president.userId,role:'president'}]);
 const older=await createSavingsGroup(db,f.president,{...input,administratorLabel:undefined});
 assert.equal((await db.query('SELECT administrator_label FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[f.tenantId,older.orgId])).rows[0].administrator_label,'');
 await assert.rejects(createSavingsGroup(db,f.president,{...input,administratorLabel:'x'.repeat(121)}),/at most 120/);
 await assert.rejects(createSavingsGroup(db,f.president,{...input,administratorLabel:42 as unknown as string}),/must be text/);
});
before(async()=>{
  pg=new PGlite(); await pg.waitReady;
  db={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)} as Sql))};
  await db.exec(await readFile('migrations/001-identity.sql','utf8'));
  await db.exec(await readFile('migrations/002-finance.sql','utf8'));
  await db.exec(await readFile('migrations/003-firebase-accounts.sql','utf8'));
  await db.exec(await readFile('migrations/004-dual-savings-groups.sql','utf8'));
  await db.exec(await readFile('migrations/010-savings-group-administrator-label.sql','utf8'));
  await db.exec(await readFile('migrations/013-savings-group-roles-and-expenses.sql','utf8'));
  for(const role of ['member','president','treasurer','cooperative','ngo']) await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$1,$2,$1,$1)',[role,`${role}@test.invalid`]);
});
after(async()=>{await pg?.close();});
async function fixture() {
  const tenantId=`finance-test-${++tenantNumber}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenantId]);
  for(const role of ['member','president','treasurer','cooperative','ngo']) {
    const orgs=role==='ngo'?['ngo-imizi','fund-school']:role==='cooperative'?['coop-imena','fund-school']:['group-ubumwe','group-hope','fund-school'];
    for(const org of orgs) await db.query('INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$2)',[tenantId,role,org]);
  }
  await seedFinance(db,tenantId);
  const actor=(role:Actor['role']):Actor=>({tenantId,userId:role,role});
  return {tenantId,member:actor('member'),president:actor('president'),treasurer:actor('treasurer'),coop:actor('cooperative'),ngo:actor('ngo')};
}
async function act(actor: Actor,input: ActionInput):Promise<Record<string,unknown>> { return await financeAction(db,actor,input) as Record<string,unknown>; }
async function account(tenantId:string,label:string,role:Actor['role'],orgs=['group-ubumwe','fund-school']):Promise<Actor> {
  const userId=`firebase-${tenantId}-${label}`;
  await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[userId,`Account ${label}`,`${userId}@test.invalid`,'firebase-auth',role]);
  for(const org of orgs) await db.query('INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4)',[tenantId,userId,org,role]);
  return {tenantId,userId,role};
}
async function activeLoan(f:Awaited<ReturnType<typeof fixture>>,amount=100000) {
  const loan=await act(f.member,{action:'requestLoan',amount,months:3});
  const payment=await act(f.president,{action:'approveLoan',loanId:loan.id,decision:'approve'});
  await act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'});
  return {loan,payment};
}

test('seed projects exact cash, integer savings cap and balanced immutable journals',async()=>{
  const f=await fixture(),state=await financeState(db,f.member);
  assert.equal(state.treasury.cash,5000000);
  assert.equal(state.treasury.reserve,1000000);
  assert.equal(state.member.eligibleSavings,400000);
  assert.equal(state.member.loanLimit,200000);
  assert.equal(state.loans.length,0);
  const all=await financeState(db,f.president);
  assert.ok(all.ledger.length>0);
  assert.ok(all.ledger.every(e=>e.debit===e.credit));
  await assert.rejects(db.query('UPDATE finance_entries SET description=$1 WHERE tenant_id=$2',['tampered',f.tenantId]),/immutable/);
  await assert.rejects(db.query('DELETE FROM finance_lines WHERE tenant_id=$1',[f.tenantId]),/immutable/);
  await assert.rejects(db.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES('late-line',$1,$2,'group-ubumwe','cash',1,0)",[all.ledger[0].id,f.tenantId]),/same transaction/);
  await assert.rejects(db.transaction(async sql=>{
    await sql.query("INSERT INTO finance_entries(id,tenant_id,org_id,description,reference) VALUES('bad-entry',$1,'group-ubumwe','unbalanced','unbalanced')",[f.tenantId]);
    await sql.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES('bad-line','bad-entry',$1,'group-ubumwe','cash',1,0)",[f.tenantId]);
  }),/balanced debit and credit/);
});
test('failed, pending and unknown provider results never post; confirmation is authorized and idempotent',async()=>{
  const f=await fixture();
  for(const status of ['failed','pending','unknown']) await act(f.member,{action:'contribute',amount:15000,outcome:status,reference:`test-${status}`});
  assert.equal((await financeState(db,f.member)).treasury.cash,5000000);
  const state=await financeState(db,f.member),pending=state.payments.find(p=>p.reference==='test-pending')!;
  await assert.rejects(act(f.member,{action:'confirmPayment',paymentId:pending.id,outcome:'success'}),/role cannot/);
  await act(f.treasurer,{action:'confirmPayment',paymentId:pending.id,outcome:'success'});
  await act(f.treasurer,{action:'confirmPayment',paymentId:pending.id,outcome:'success'});
  assert.equal((await financeState(db,f.member)).treasury.cash,5015000);
  await assert.rejects(act(f.treasurer,{action:'confirmPayment',paymentId:pending.id,outcome:'failed'}),/Terminal/);
});
test('duplicate references post once and reject different economic intent',async()=>{
  const f=await fixture();
  const input={action:'contribute',amount:12345,outcome:'success',reference:'same-reference'};
  await act(f.member,input); await act(f.member,input);
  assert.equal((await financeState(db,f.member)).member.eligibleSavings,412345);
  await assert.rejects(act(f.member,{...input,amount:12346}),/different payment/);
});
test('unsafe, fractional, zero and negative amounts are rejected without posting',async()=>{
  const f=await fixture();
  for(const amount of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,Infinity,'1000']) await assert.rejects(act(f.member,{action:'contribute',amount,outcome:'success',reference:`invalid-${amount}`}));
  await assert.rejects(act(f.member,{action:'contribute',amount:Number.MAX_SAFE_INTEGER,outcome:'success',reference:'aggregate-overflow'}),/safe integer/);
  assert.equal((await financeState(db,f.member)).treasury.cash,5000000);
});
test('loan limit uses savings; president cannot approve self and treasurer cannot approve',async()=>{
  const f=await fixture();
  await assert.rejects(act(f.member,{action:'requestLoan',amount:200001,months:3}),/limit/);
  const loan=await act(f.member,{action:'requestLoan',amount:100000,months:3});
  await assert.rejects(act(f.treasurer,{action:'approveLoan',loanId:loan.id,decision:'approve'}),/role cannot/);
  await act(f.president,{action:'contribute',amount:1000000,outcome:'success',reference:'president-savings'});
  const own=await act(f.president,{action:'requestLoan',amount:100000,months:3});
  await assert.rejects(act(f.president,{action:'approveLoan',loanId:own.id,decision:'approve'}),/own loan/);
});
test('concurrent approvals reserve cash and cannot allocate the same savings limit twice',async()=>{
  const f=await fixture();
  const a=await act(f.member,{action:'requestLoan',amount:150000,months:3});
  const b=await act(f.member,{action:'requestLoan',amount:150000,months:3});
  const results=await Promise.allSettled([act(f.president,{action:'approveLoan',loanId:a.id,decision:'approve'}),act(f.president,{action:'approveLoan',loanId:b.id,decision:'approve'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const state=await financeState(db,f.member);
  assert.equal(state.treasury.cash,5000000);
  assert.equal(state.treasury.pending,150000);
  assert.equal(state.treasury.lendingCapacity,3850000);
});
test('reserve policy holds pending outflows against future allocations and releases failed holds',async()=>{
  const f=await fixture();
  await act(f.president,{action:'configureGroup',reserveBps:9800,loanLimitBps:5000});
  const a=await act(f.member,{action:'requestLoan',amount:70000,months:3});
  const b=await act(f.member,{action:'requestLoan',amount:70000,months:3});
  const p=await act(f.president,{action:'approveLoan',loanId:a.id,decision:'approve'});
  await assert.rejects(act(f.president,{action:'approveLoan',loanId:b.id,decision:'approve'}),/lending capacity/);
  assert.equal((await financeState(db,f.member)).treasury.pending,70000);
  await act(f.treasurer,{action:'confirmPayment',paymentId:p.id,outcome:'failed'});
  assert.equal((await financeState(db,f.member)).treasury.pending,0);
  await act(f.president,{action:'approveLoan',loanId:b.id,decision:'approve'});
});
test('successful loan repayment is exact; schedule conserves principal and overpayment is rejected',async()=>{
  const f=await fixture(),{loan}=await activeLoan(f,100001);
  let state=await financeState(db,f.member);
  assert.equal(state.member.outstanding,100001);
  assert.equal(state.treasury.cash,4899999);
  assert.equal(state.loans[0].schedule.reduce((n,i)=>n+i.amount,0),100001);
  await act(f.member,{action:'repay',loanId:loan.id,amount:50000,outcome:'pending',reference:'pending-repay'});
  await assert.rejects(act(f.member,{action:'repay',loanId:loan.id,amount:50002,outcome:'success',reference:'overpay'}),/remaining principal/);
  const payment=(await financeState(db,f.member)).payments.find(p=>p.reference==='pending-repay')!;
  await act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'});
  await act(f.member,{action:'repay',loanId:loan.id,amount:50001,outcome:'success',reference:'last-repay'});
  await act(f.member,{action:'repay',loanId:loan.id,amount:50001,outcome:'success',reference:'last-repay'});
  state=await financeState(db,f.member);
  assert.equal(state.member.outstanding,0);
  assert.equal(state.loans[0].status,'repaid');
  assert.equal(state.treasury.cash,5000000);
});
test('tenant, membership, record ownership and NGO confidentiality are enforced',async()=>{
  const f=await fixture(),other=await fixture();
  const loan=await act(f.member,{action:'requestLoan',amount:50000,months:3});
  await assert.rejects(act(other.president,{action:'approveLoan',loanId:loan.id,decision:'approve'}),/not found/);
  await assert.rejects(act(f.member,{action:'contribute',orgId:'coop-imena',amount:1,outcome:'success',reference:'bad'}),/role cannot/);
  const ngo=await financeState(db,f.ngo);
  assert.equal(ngo.loans.length,0); assert.equal(ngo.contributions.length,0); assert.equal(ngo.payments.length,0);assert.equal(ngo.ledger.length,0);
  assert.equal(ngo.impact.groups,2);assert.equal(ngo.impact.savings,2000000);
  const coop=await financeState(db,f.coop);assert.equal(coop.loans.length,0);assert.equal(coop.contributions.length,0);
  await db.query('DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3',[f.tenantId,'member','group-ubumwe']);
  await assert.rejects(act(f.member,{action:'contribute',amount:1,outcome:'success',reference:'revoked'}),/not a member/);
});
test('reversals append balanced opposite entries and reject a second economic reversal',async()=>{
  const f=await fixture();
  await act(f.member,{action:'contribute',amount:20000,outcome:'success',reference:'reverse-me'});
  const before=await financeState(db,f.president),entry=before.ledger.find(e=>e.reference==='reverse-me')!;
  const reversed=await act(f.treasurer,{action:'reverseEntry',entryId:entry.id});
  const duplicate=await act(f.treasurer,{action:'reverseEntry',entryId:entry.id});
  assert.equal(duplicate.id,reversed.id);
  const afterState=await financeState(db,f.president);
  assert.equal(afterState.treasury.cash,5000000);assert.equal(afterState.treasury.contributions,800000);
  assert.equal(afterState.ledger.length,before.ledger.length+1);
  assert.ok(afterState.ledger.every(e=>e.credit===e.debit));
  assert.equal((await financeState(db,f.member)).contributions.find(c=>c.id===before.contributions.find(c=>c.amount===20000)?.id)?.status,'reversed');
  await assert.rejects(act(f.treasurer,{action:'reverseEntry',entryId:reversed.id}),/reverse a reversal/);
});
test('fundraising expenses need independent approval and provider success; commitments prevent overspend',async()=>{
  const f=await fixture(),campaign=(await financeState(db,f.member)).campaigns[0];
  const e=await act(f.treasurer,{action:'requestExpense',campaignId:campaign.id,amount:600000,title:'SIMULATED books'});
  const second=await act(f.treasurer,{action:'requestExpense',campaignId:campaign.id,amount:600000,title:'SIMULATED supplies'});
  await assert.rejects(act(f.treasurer,{action:'approveExpense',expenseId:e.id}),/role cannot/);
  const p=await act(f.president,{action:'approveExpense',expenseId:e.id});
  await assert.rejects(act(f.president,{action:'approveExpense',expenseId:second.id}),/Insufficient/);
  assert.equal((await financeState(db,f.member)).campaigns[0].spent,0);
  await act(f.treasurer,{action:'confirmPayment',orgId:'fund-school',paymentId:p.id,outcome:'success'});
  assert.equal((await financeState(db,f.member)).campaigns[0].spent,600000);
});
test('cooperative voting is one vote per member; cash reserve prevents oversized expenses',async()=>{
  const f=await fixture(),state=await financeState(db,f.coop),proposal=state.cooperative.proposals[0];
  await act(f.coop,{action:'vote',proposalId:proposal.id});await act(f.coop,{action:'vote',proposalId:proposal.id});
  assert.equal((await financeState(db,f.coop)).cooperative.proposals[0].votes,1);
  await assert.rejects(act(f.coop,{action:'recordCoop',kind:'expense',amount:3000000,title:'Too large'}),/reserve/);
  await act(f.coop,{action:'recordCoop',kind:'revenue',amount:12345,title:'SIMULATED sales'});
  assert.equal((await financeState(db,f.coop)).cooperative.cash,state.cooperative.cash+12345);
});
test('reconciliation never assumes an unknown provider result succeeded',async()=>{
  const f=await fixture(),p=await act(f.member,{action:'contribute',amount:5000,outcome:'unknown',reference:'unknown-reconcile'});
  const reconciled=await act(f.treasurer,{action:'reconcile',paymentId:p.id});
  assert.equal(reconciled.status,'unknown');assert.equal(reconciled.posted,false);
  assert.equal((await financeState(db,f.member)).treasury.cash,5000000);
});
test('successful actions append an immutable hash chain; rejected actions leave no audit or posting',async()=>{
  const f=await fixture();
  await act(f.member,{action:'contribute',amount:1,outcome:'success',reference:'audit-one'});
  await act(f.member,{action:'contribute',amount:2,outcome:'failed',reference:'audit-two'});
  await assert.rejects(act(f.member,{action:'contribute',amount:-1,outcome:'success',reference:'audit-rejected'}));
  const rows=(await db.query('SELECT * FROM finance_audit WHERE tenant_id=$1 AND org_id=$2 ORDER BY sequence',[f.tenantId,'group-ubumwe'])).rows;
  assert.equal(rows.length,2);
  let previous='0'.repeat(64);
  for(let i=0;i<rows.length;i++) {
    const row=rows[i];assert.equal(row.prev_hash,previous);assert.equal(Number(row.sequence),i+1);
    const timestamp=row.created_at instanceof Date?row.created_at.toISOString():new Date(String(row.created_at)).toISOString();
    const hash=createHash('sha256').update(JSON.stringify([f.tenantId,'group-ubumwe',i+1,row.actor_id,row.actor_role,row.action,row.details,timestamp,previous])).digest('hex');
    assert.equal(row.hash,hash);previous=hash;
  }
  await assert.rejects(db.query("UPDATE finance_audit SET action='tampered' WHERE tenant_id=$1 AND org_id=$2",[f.tenantId,'group-ubumwe']),/immutable/);
  await assert.rejects(db.query('DELETE FROM finance_audit WHERE tenant_id=$1 AND org_id=$2',[f.tenantId,'group-ubumwe']),/immutable/);
  const invalid=(await db.query("SELECT e.id FROM finance_entries e JOIN finance_lines l ON l.entry_id=e.id WHERE e.tenant_id=$1 AND e.org_id=$2 GROUP BY e.id HAVING SUM(l.debit)<>SUM(l.credit)",[f.tenantId,'group-ubumwe'])).rows;
  assert.equal(invalid.length,0);
});
test('delayed loan confirmation revalidates a changed savings policy and preserves the hold on rejection',async()=>{
  const f=await fixture(),loan=await act(f.member,{action:'requestLoan',amount:100000,months:3});
  const payment=await act(f.president,{action:'approveLoan',loanId:loan.id,decision:'approve'});
  await act(f.president,{action:'configureGroup',reserveBps:2000,loanLimitBps:0});
  await assert.rejects(act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'}),/current savings-based limit/);
  let state=await financeState(db,f.member);
  assert.equal(state.member.outstanding,0);assert.equal(state.treasury.cash,5000000);assert.equal(state.treasury.pending,100000);
  assert.equal(state.payments.find(p=>p.id===payment.id)?.status,'pending');
  await act(f.president,{action:'configureGroup',reserveBps:2000,loanLimitBps:5000});
  await act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'});
  state=await financeState(db,f.member);assert.equal(state.member.outstanding,100000);assert.equal(state.treasury.pending,0);
});
test('a savings reversal cannot leave an ineligible pending loan free to post',async()=>{
  const f=await fixture(),loan=await act(f.member,{action:'requestLoan',amount:100000,months:3});
  const payment=await act(f.president,{action:'approveLoan',loanId:loan.id,decision:'approve'});
  const entry=(await financeState(db,f.president)).ledger.find(e=>e.reference==='seed-member-savings')!;
  await act(f.treasurer,{action:'reverseEntry',entryId:entry.id});
  await assert.rejects(act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'}),/current savings-based limit/);
  assert.equal((await financeState(db,f.member)).member.outstanding,0);
  await act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'failed'});
  assert.equal((await financeState(db,f.member)).treasury.pending,0);
});
test('repayment schedule starts at successful disbursement even when the request was delayed months',async()=>{
  const f=await fixture(),loan=await act(f.member,{action:'requestLoan',amount:100001,months:3});
  await db.query("UPDATE finance_loans SET created_at=now()-interval '3 months' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[f.tenantId,'group-ubumwe',loan.id]);
  const payment=await act(f.president,{action:'approveLoan',loanId:loan.id,decision:'approve'});
  await act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'});
  const schedule=(await financeState(db,f.member)).loans.find(l=>l.id===loan.id)!.schedule;
  assert.ok(schedule[0].dueDate>new Date().toISOString().slice(0,10));
  assert.equal(schedule.reduce((total,item)=>total+item.amount,0),100001);
});
test('NGO and cooperative fundraising access exposes campaign totals and only the actor own donor records',async()=>{
  const f=await fixture(),campaign=(await financeState(db,f.ngo)).campaigns[0];
  assert.ok(campaign);
  await act(f.ngo,{action:'donate',campaignId:campaign.id,amount:10000,outcome:'success',reference:'ngo-own-donation'});
  await act(f.coop,{action:'donate',campaignId:campaign.id,amount:20000,outcome:'success',reference:'coop-own-donation'});
  const ngo=await financeState(db,f.ngo),coop=await financeState(db,f.coop);
  assert.equal(ngo.campaigns[0].raised,880000);assert.equal(coop.campaigns[0].raised,880000);
  assert.deepEqual(ngo.payments.map(p=>p.reference),['ngo-own-donation']);
  assert.deepEqual(coop.payments.map(p=>p.reference),['coop-own-donation']);
  assert.equal(ngo.loans.length,0);assert.equal(coop.loans.length,0);assert.equal(ngo.contributions.length,0);assert.equal(coop.contributions.length,0);
});

test('arbitrary Firebase member accounts in one tenant keep contributions, loans and donor payments private',async()=>{
  const f=await fixture(),alice=await account(f.tenantId,'alice','member'),bob=await account(f.tenantId,'bob','member');
  const officer=await account(f.tenantId,'officer','president');
  for(const actor of [alice,bob]) {
    await act(actor,{action:'contribute',amount:300000,outcome:'success',reference:`${actor.userId}-savings`});
    const loan=await act(actor,{action:'requestLoan',amount:100000,months:3});
    const payment=await act(officer,{action:'approveLoan',loanId:loan.id,decision:'approve'});
    await act(f.treasurer,{action:'confirmPayment',paymentId:payment.id,outcome:'success'});
    const campaign=(await financeState(db,actor)).campaigns[0];
    await act(actor,{action:'donate',campaignId:campaign.id,amount:1000,outcome:'success',reference:`${actor.userId}-donation`});
  }
  for(const [actor,other] of [[alice,bob],[bob,alice]]) {
    const state=await financeState(db,actor);
    assert.equal(state.member.eligibleSavings,300000);
    assert.equal(state.member.outstanding,100000);
    assert.equal(state.contributions.length,1);
    assert.equal(state.contributions[0].member,actor===alice?'Account alice':'Account bob');
    assert.equal(state.loans.length,1);
    assert.equal(state.loans[0].userId,actor.userId);
    assert.equal(state.loans[0].member,state.contributions[0].member);
    assert.equal(state.ledger.length,0);
    assert.equal(JSON.stringify(state).includes(other.userId),false);
    await assert.rejects(act(actor,{action:'repay',loanId:(await financeState(db,other)).loans[0].id,amount:1,outcome:'success',reference:'foreign-borrower'}),/Only the borrower/);
  }
  const officerState=await financeState(db,officer);
  assert.ok(officerState.loans.some(l=>l.userId===alice.userId));
  assert.ok(officerState.loans.some(l=>l.userId===bob.userId));
  const notifications=(await db.query('SELECT message FROM notifications WHERE tenant_id=$1 AND user_id=$2',[f.tenantId,officer.userId])).rows;
  assert.equal(notifications.length,2);
});

test('officer personal projection exposes only the actor own group records and no organizational totals',async()=>{
  const f=await fixture(),officer=await account(f.tenantId,'personal-officer','president');
  await act(officer,{action:'contribute',amount:200000,outcome:'success',reference:'personal-officer-savings'});
  await act(officer,{action:'requestLoan',amount:50000,months:2});
  await act(f.member,{action:'requestLoan',amount:50000,months:2});
  const campaign=(await financeState(db,officer)).campaigns[0];
  await act(officer,{action:'donate',campaignId:campaign.id,amount:1234,outcome:'success',reference:'officer-private-donation'});
  const state=await financeState(db,officer,{personal:true});
  assert.equal(state.member.eligibleSavings,200000);
  assert.equal(state.member.loanLimit,100000);
  assert.equal(state.contributions.length,1);
  assert.equal(state.contributions[0].member,'Account personal-officer');
  assert.deepEqual(state.loans.map(l=>l.userId),[officer.userId]);
  assert.deepEqual(state.payments.map(p=>p.reference),['personal-officer-savings']);
  assert.ok(Object.values(state.treasury).every(value=>value===0));
  assert.equal(state.ledger.length,0);assert.equal(state.campaigns.length,0);
  assert.equal(state.cooperative.cash,0);assert.deepEqual(state.cooperative.assets,[]);assert.deepEqual(state.cooperative.proposals,[]);
  assert.equal(state.impact.groups,0);assert.deepEqual(state.impact.organizations,[]);
  assert.equal(JSON.stringify(state).includes('seed-member-savings'),false);
  for(const actor of [f.ngo,f.coop]) {
    const personal=await financeState(db,actor,{personal:true});
    assert.equal(personal.payments.length,0);assert.equal(personal.campaigns.length,0);assert.equal(personal.ledger.length,0);
    assert.equal(personal.impact.groups,0);assert.equal(personal.cooperative.cash,0);
  }
});

test('revoked or mismatched membership roles hide projections and reject actions within their transaction',async()=>{
  const f=await fixture(),member=await account(f.tenantId,'revoked','member'),officer=await account(f.tenantId,'mismatch','president');
  await act(member,{action:'contribute',amount:123,outcome:'success',reference:'before-revoke'});
  await db.query('DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2',[f.tenantId,member.userId]);
  await assert.rejects(act(member,{action:'contribute',amount:1,outcome:'success',reference:'after-revoke'}),/not a member/);
  await db.query("UPDATE memberships SET role='member' WHERE tenant_id=$1 AND user_id=$2",[f.tenantId,officer.userId]);
  await assert.rejects(act(officer,{action:'configureGroup',reserveBps:2000,loanLimitBps:5000}),/role cannot/);
  const campaign=(await financeState(db,f.member)).campaigns[0];
  await assert.rejects(act(officer,{action:'donate',campaignId:campaign.id,amount:1,outcome:'success',reference:'mismatched-fund'}),/membership role/);
  for(const actor of [member,officer,{...member,tenantId:(await fixture()).tenantId}]) {
    for(const options of [{},{personal:true}]) {
      const state=await financeState(db,actor,options);
      assert.deepEqual(state.contributions,[]);assert.deepEqual(state.loans,[]);assert.deepEqual(state.payments,[]);assert.deepEqual(state.ledger,[]);assert.deepEqual(state.campaigns,[]);
      assert.equal(state.treasury.cash,0);assert.equal(state.member.eligibleSavings,0);
    }
  }
  const audits=(await db.query('SELECT action FROM finance_audit WHERE tenant_id=$1 AND actor_id=$2',[f.tenantId,officer.userId])).rows;
  assert.deepEqual(audits,[]);
});

test('fresh personal tenant with no memberships or finance organizations returns an empty state',async()=>{
  const tenantId=`fresh-personal-${++tenantNumber}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenantId]);
  const actor=await account(tenantId,'fresh','member',[]);
  for(const options of [{},{personal:true}]) {
    const state=await financeState(db,actor,options);
    assert.ok(Object.values(state.treasury).every(value=>value===0));
    assert.ok(Object.values(state.member).every(value=>value===0));
    assert.deepEqual(state.contributions,[]);assert.deepEqual(state.loans,[]);assert.deepEqual(state.ledger,[]);assert.deepEqual(state.payments,[]);assert.deepEqual(state.campaigns,[]);
    assert.equal(state.cooperative.cash,0);assert.equal(state.impact.groups,0);assert.deepEqual(state.alerts,[]);
  }
  await assert.rejects(act(actor,{action:'contribute',amount:1,outcome:'success',reference:'unassigned'}),/not a member/);
  assert.equal((await db.query('SELECT org_id FROM finance_orgs WHERE tenant_id=$1',[tenantId])).rows.length,0);
});

test('Ikimina creates obligations, segregates rotation payable and posts payout only after confirmation',async()=>{
  const f=await fixture();
  const created=await createSavingsGroup(db,f.president,{model:'ROTATING',name:'Ikimina Test',description:'Synthetic test group',location:'Gasabo',contact:'0780000000',expectedMembers:2,contributionAmount:10000,frequency:'monthly',startDate:'2025-01-01',endDate:'2025-02-01',shareOutDate:'2025-01-01',rotationOrder:['member','president'],reserveBps:0,accepted:true});
  await joinSavingsGroup(db,f.member,created.inviteCode);
  await act(f.president,{action:'startRotation',orgId:created.orgId});
  const before=await financeState(db,f.member,{orgId:created.orgId});
  assert.equal(before.savingsGroup?.model,'ROTATING');assert.equal(before.savingsGroup?.obligations.length,2);assert.equal(before.member.loanLimit,0);
  const round=before.savingsGroup!.rotationRounds[0];
  await act(f.member,{action:'contribute',orgId:created.orgId,roundId:round.id,amount:10000,outcome:'success',reference:'rot-member'});
  await act(f.president,{action:'contribute',orgId:created.orgId,roundId:round.id,amount:10000,outcome:'success',reference:'rot-president'});
  assert.equal(Number((await db.query("SELECT balance FROM (SELECT SUM(debit-credit)::bigint AS balance FROM finance_lines WHERE tenant_id=$1 AND org_id=$2 AND account='rotation_payable') x",[f.tenantId,created.orgId])).rows[0].balance),-20000);
  const payout=await act(f.president,{action:'payRotation',orgId:created.orgId,roundId:round.id,outcome:'pending'});
  assert.equal(payout.status,'pending');assert.equal((await financeState(db,f.president,{orgId:created.orgId})).treasury.cash,20000);
  await act(f.president,{action:'confirmPayment',orgId:created.orgId,paymentId:payout.id,outcome:'success'});
  const after=await financeState(db,f.president,{orgId:created.orgId});assert.equal(after.savingsGroup?.rotationRounds[0].status,'paid');assert.equal(after.treasury.cash,0);
  await act(f.president,{action:'setGroupMemberRole',orgId:created.orgId,userId:f.member.userId,memberRole:'treasurer'});
  const secondRound=after.savingsGroup!.rotationRounds[1];
  await act(f.member,{action:'contribute',orgId:created.orgId,roundId:secondRound.id,amount:10000,outcome:'success',reference:'rot-member-round-2'});
  await act(f.president,{action:'contribute',orgId:created.orgId,roundId:secondRound.id,amount:10000,outcome:'success',reference:'rot-president-round-2'});
  const secondPayout=await act(f.president,{action:'payRotation',orgId:created.orgId,roundId:secondRound.id,outcome:'pending'});
  await act(f.member,{action:'confirmPayment',orgId:created.orgId,paymentId:secondPayout.id,outcome:'success'});
  assert.equal((await financeState(db,f.president,{orgId:created.orgId})).savingsGroup?.cycleStatus,'closed');
  await act(f.president,{action:'startSavingsCycle',orgId:created.orgId,startDate:'2026-01-01',endDate:'2026-03-01',shareOutDate:'2026-02-01'});
  assert.equal((await financeState(db,f.president,{orgId:created.orgId})).savingsGroup?.cycleStatus,'collecting');
  await assert.rejects(act(f.member,{action:'requestLoan',orgId:created.orgId,amount:1,months:1}),/disabled/);
});

test('Itsinda settlement protects the reserve and requires a second group officer for each share-out',async()=>{
  const f=await fixture();
  const created=await createSavingsGroup(db,f.president,{model:'ACCUMULATING',name:'Itsinda Test',description:'Synthetic test group',location:'Gasabo',contact:'0780000000',expectedMembers:2,contributionAmount:1000,frequency:'monthly',startDate:'2024-01-01',endDate:'2025-01-01',shareOutDate:'2025-01-01',rotationOrder:[],reserveBps:0,accepted:true});
  await joinSavingsGroup(db,f.member,created.inviteCode);
  await act(f.member,{action:'contribute',orgId:created.orgId,amount:1000,outcome:'success',reference:'acc-member'});
  await act(f.president,{action:'contribute',orgId:created.orgId,amount:1000,outcome:'success',reference:'acc-president'});
  await act(f.president,{action:'setGroupMemberRole',orgId:created.orgId,userId:f.member.userId,memberRole:'treasurer'});
  const plan=await act(f.president,{action:'settleGroupCycle',orgId:created.orgId});assert.equal(plan.status,'settling');
  const payments=(await db.query("SELECT id,user_id,amount FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND kind='share-out' ORDER BY user_id",[f.tenantId,created.orgId])).rows;
  assert.equal(payments.length,2);assert.ok(payments.every(p=>Number(p.amount)===1000));
  for(const payment of payments){const confirmer=payment.user_id===f.president.userId?f.member:f.president;await act(confirmer,{action:'confirmPayment',orgId:created.orgId,paymentId:payment.id,outcome:'success'});}
  const state=await financeState(db,f.president,{orgId:created.orgId});assert.equal(state.treasury.cash,0);assert.equal((await db.query('SELECT status FROM savings_cycles WHERE tenant_id=$1 AND org_id=$2',[f.tenantId,created.orgId])).rows[0].status,'closed');
  await act(f.president,{action:'startSavingsCycle',orgId:created.orgId,startDate:'2026-01-01',endDate:'2027-01-01',shareOutDate:'2027-01-01'});
  assert.equal((await financeState(db,f.president,{orgId:created.orgId})).savingsGroup?.cycleStatus,'collecting');
});
