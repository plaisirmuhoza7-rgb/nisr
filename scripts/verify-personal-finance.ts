import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nextRepayment} from '../src/lib/personal-finance';

// Explicit local-only synthetic workflow. Never loads .env.local or live credentials.
async function main(){
 const base=new URL(process.env.HURIZA_BASE_URL||'http://127.0.0.1:3102');
 assert.ok(['127.0.0.1','localhost'].includes(base.hostname),'A local test server is required.');
 const headers={'Content-Type':'application/json',Origin:base.origin};
 const login=await fetch(new URL('/api/local-demo',base),{method:'POST',headers,body:JSON.stringify({workspace:'personal'})});
 assert.equal(login.status,200,'Run an isolated development server with Sheets disabled.');
 const cookie=login.headers.getSetCookie().find(value=>value.startsWith('huriza_local_demo='))?.split(';')[0];
 assert.ok(cookie);
 const session=await (await fetch(new URL('/api/session',base),{headers:{Cookie:cookie}})).json();
 assert.equal(session.user?.id,'local-demo-personal');assert.equal(session.user?.isTestAccount,true);
 async function state(){const response=await fetch(new URL('/api/state?workspace=personal',base),{headers:{Cookie:cookie!}});assert.equal(response.status,200);return response.json();}
 async function action(body:Record<string,unknown>,status=200){const response=await fetch(new URL('/api/actions',base),{method:'POST',headers:{...headers,Cookie:cookie!},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data.result;}
 const before=await state();
 const initial=(before.personalAccounts as {balance:number}[]).reduce((sum,a)=>sum+BigInt(a.balance),0n);
 const suffix=randomUUID().slice(0,8);
 await action({action:'createPersonalLoan',counterpartyName:'Synthetic invalid plan',direction:'i_owe',amount:100,repaymentMonths:2,firstPaymentDate:'9999-12-31'},400);
 await action({action:'createPersonalAccount',institution:'Synthetic QA Bank',accountName:`QA bank ${suffix}`,accountType:'bank',balance:100000});
 await action({action:'createPersonalAccount',institution:'Synthetic QA Wallet',accountName:`QA wallet ${suffix}`,accountType:'mobile_money',balance:50000});
 await action({action:'createGoal',name:`QA allocated savings ${suffix}`,target:100000,saved:50000,deadline:'2027-12-31'});
 const loan=await action({action:'createPersonalLoan',counterpartyName:`Synthetic QA lender ${suffix}`,direction:'i_owe',amount:100001,repaymentMonths:3,firstPaymentDate:'2027-01-31'});
 const payment={action:'recordPersonalLoanPayment',loanId:loan.id,amount:10000,paymentDate:'2027-01-31',reference:`qa-payment-${suffix}`};
 await action(payment);await action(payment);
 await action({...payment,reference:`qa-excess-${suffix}`,amount:90002},400);
 const after=await state();
 assert.equal((after.personalAccounts as {balance:number}[]).reduce((sum,a)=>sum+BigInt(a.balance),0n),initial+150000n);
 const saved=after.personalLoans.find((row:{id:string})=>row.id===loan.id);
 assert.equal(saved.paidAmount,10000);assert.equal(saved.remainingAmount,90001);
 assert.equal(saved.repaymentMonths,3);assert.equal(saved.firstPaymentDate,'2027-01-31');
 assert.equal(saved.payments.length,1);assert.equal(saved.payments[0].amount,10000);assert.equal(saved.payments[0].paymentDate,'2027-01-31');
 assert.deepEqual(nextRepayment(saved.amount,saved.paidAmount,saved.repaymentMonths,saved.firstPaymentDate),{dueDate:'2027-01-31',amount:23334});
 const old=await action({action:'createPersonalLoan',counterpartyName:`Synthetic legacy loan ${suffix}`,direction:'they_owe',amount:1000,dueDate:'2027-01-01'});
 await action({action:'recordPersonalLoanPayment',loanId:old.id,amount:100});
 const final=await state();
 assert.equal(final.personalLoans.find((row:{id:string})=>row.id===old.id).paidAmount,100);
 console.log('Personal finance HTTP checks passed: accounts, goal allocation, planned loan, exact partial payment, replay, overpayment rejection and legacy payloads. All records are synthetic.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
