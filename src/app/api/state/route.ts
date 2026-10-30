import {NextResponse} from 'next/server';
import {requireAccount} from '@/server/auth';
import {DomainError} from '@/server/permissions';
import {WORKSPACES,type Workspace} from '@/lib/access';
import {getDb} from '@/server/db';
import {financeState} from '@/server/finance/service';
import {apiError} from '@/server/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await requireAccount();const workspace=new URL(request.url).searchParams.get('workspace')||user.homeWorkspace;
 if(!WORKSPACES.includes(workspace as Workspace)||!user.workspaces.includes(workspace as Workspace))throw new DomainError('Your account does not have access to this workspace.',403);
 const actor={tenantId:user.tenantId,userId:user.id,role:user.role};const db=await getDb();const personal=workspace==='personal';const url=new URL(request.url);const requestedOrg=url.searchParams.get('orgId')??undefined;const orgId=(workspace==='groups'||workspace==='cooperative')?(requestedOrg??user.memberships.find(m=>workspace==='cooperative'?m.orgId.startsWith('coop-'):m.orgId.startsWith('group-'))?.orgId):undefined;const state=await financeState(db,actor,{personal,orgId});
 const [goals,interventions,notifications,rawWallets,rawLoans,rawInvestmentPlans]=await Promise.all([
 db.query('SELECT id,name,target,saved,deadline FROM goals WHERE tenant_id=$1 AND user_id=$2 ORDER BY deadline',[actor.tenantId,actor.userId]),
 Promise.resolve({rows:[]}),
 db.query('SELECT id,message,created_at FROM notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 150',[actor.tenantId,actor.userId]),
 db.query('SELECT id,institution,account_name,account_type,account_identifier,balance,currency,notes,updated_at FROM personal_wallets WHERE tenant_id=$1 AND user_id=$2 ORDER BY institution, account_name',[actor.tenantId,actor.userId]),
 db.query('SELECT id,counterparty_name,counterparty_phone,direction,amount,paid_amount,due_date,notes,status,created_at FROM personal_loans WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC',[actor.tenantId,actor.userId]),
 db.query('SELECT id,title,category,capital_required,projected_revenue,projected_expenses,time_horizon_months,notes,status,created_at FROM personal_investment_plans WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC',[actor.tenantId,actor.userId])
 ]);

 let walletsRows = rawWallets.rows;
 let loansRows = rawLoans.rows;
 let investmentPlansRows = rawInvestmentPlans.rows;

 // Seed initial demo personal records for member fixture if empty
 if (walletsRows.length === 0 && actor.userId === 'member') {
   const {randomUUID} = await import('node:crypto');
   const defaultAccounts = [
     { id: randomUUID(), institution: 'MTN MoMo', account_name: 'Mobile Money', account_type: 'mobile_money', account_identifier: '*182# · 0788 450 123', balance: 185000, notes: 'Daily transactions & MoMo Pay' },
     { id: randomUUID(), institution: 'Bank of Kigali', account_name: 'BK Savings Account', account_type: 'bank', account_identifier: '4002-8921-0012', balance: 450000, notes: 'Primary bank savings reserve' },
     { id: randomUUID(), institution: 'Umurenge SACCO', account_name: 'Gasabo SACCO Shares', account_type: 'sacco', account_identifier: 'SC-3921', balance: 120000, notes: 'Community SACCO equity & passbook' },
     { id: randomUUID(), institution: 'Cash Wallet', account_name: 'Cash in Hand', account_type: 'cash', account_identifier: 'Physical wallet', balance: 25000, notes: 'Petty cash for market transit' }
   ];
   for (const acc of defaultAccounts) {
     await db.query('INSERT INTO personal_wallets(id,tenant_id,user_id,institution,account_name,account_type,account_identifier,balance,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [acc.id, actor.tenantId, actor.userId, acc.institution, acc.account_name, acc.account_type, acc.account_identifier, acc.balance, acc.notes]);
   }
   walletsRows = defaultAccounts.map(a => ({ ...a, currency: 'RWF', updated_at: new Date() }));
 }

 if (loansRows.length === 0 && actor.userId === 'member') {
   const {randomUUID} = await import('node:crypto');
   const defaultLoans = [
     { id: randomUUID(), counterparty_name: 'Claire Mukamana', counterparty_phone: '0788 312 890', direction: 'they_owe', amount: 75000, paid_amount: 25000, due_date: '2026-12-15', notes: 'Kigali market stall seasonal inventory advance', status: 'partially_paid' },
     { id: randomUUID(), counterparty_name: 'Jean-Pierre Bizimana', counterparty_phone: '0788 664 120', direction: 'i_owe', amount: 40000, paid_amount: 0, due_date: '2026-11-30', notes: 'Agri seed supplies remaining balance', status: 'active' }
   ];
   for (const l of defaultLoans) {
     await db.query('INSERT INTO personal_loans(id,tenant_id,user_id,counterparty_name,counterparty_phone,direction,amount,paid_amount,due_date,notes,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [l.id, actor.tenantId, actor.userId, l.counterparty_name, l.counterparty_phone, l.direction, l.amount, l.paid_amount, l.due_date, l.notes, l.status]);
   }
   loansRows = defaultLoans.map(l => ({ ...l, created_at: new Date() }));
 }

 if (investmentPlansRows.length === 0 && actor.userId === 'member') {
   const {randomUUID} = await import('node:crypto');
   const defaultPlans = [
     { id: randomUUID(), title: 'Kimironko Poultry Broiler Project', category: 'agriculture', capital_required: 850000, projected_revenue: 1200000, projected_expenses: 680000, time_horizon_months: 6, notes: '500-bird broiler cycle in partnership with local feed cooperative', status: 'active' },
     { id: randomUUID(), title: 'Nyabugogo Commercial Moto Transit', category: 'transport', capital_required: 1500000, projected_revenue: 2600000, projected_expenses: 1200000, time_horizon_months: 18, notes: 'Simulated TVS motorcycle route lease in Gasabo district', status: 'planned' }
   ];
   for (const p of defaultPlans) {
     await db.query('INSERT INTO personal_investment_plans(id,tenant_id,user_id,title,category,capital_required,projected_revenue,projected_expenses,time_horizon_months,notes,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [p.id, actor.tenantId, actor.userId, p.title, p.category, p.capital_required, p.projected_revenue, p.projected_expenses, p.time_horizon_months, p.notes, p.status]);
   }
   investmentPlansRows = defaultPlans.map(p => ({ ...p, created_at: new Date() }));
 }

 const personalAccounts = walletsRows.map((w: any) => ({
   id: w.id,
   institution: w.institution,
   accountName: w.account_name,
   accountType: w.account_type,
   accountIdentifier: w.account_identifier,
   balance: Number(w.balance),
   currency: w.currency || 'RWF',
   notes: w.notes,
   updatedAt: w.updated_at instanceof Date ? w.updated_at.toISOString() : String(w.updated_at)
 }));

 const personalLoans = loansRows.map((l: any) => {
   const amt = Number(l.amount);
   const paid = Number(l.paid_amount);
   return {
     id: l.id,
     counterpartyName: l.counterparty_name,
     counterpartyPhone: l.counterparty_phone,
     direction: l.direction,
     amount: amt,
     paidAmount: paid,
     remainingAmount: Math.max(0, amt - paid),
     dueDate: l.due_date instanceof Date ? l.due_date.toISOString().slice(0, 10) : (l.due_date ? String(l.due_date).slice(0, 10) : undefined),
     notes: l.notes,
     status: l.status,
     createdAt: l.created_at instanceof Date ? l.created_at.toISOString() : String(l.created_at)
   };
 });

 const personalInvestmentPlans = investmentPlansRows.map((p: any) => {
   const rev = Number(p.projected_revenue);
   const exp = Number(p.projected_expenses);
   const cap = Number(p.capital_required);
   const net = rev - exp;
   const margin = rev > 0 ? Math.round((net / rev) * 100) : 0;
   const payback = (net > 0 && cap > 0) ? Math.ceil(cap / (net / (p.time_horizon_months || 12))) : 0;
   return {
     id: p.id,
     title: p.title,
     category: p.category,
     capitalRequired: cap,
     projectedRevenue: rev,
     projectedExpenses: exp,
     netProfit: net,
     profitMarginPercent: margin,
     paybackMonths: payback,
     timeHorizonMonths: p.time_horizon_months,
     notes: p.notes,
     status: p.status,
     createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at)
   };
 });

 return NextResponse.json({...state,user,goals:goals.rows.map(x=>({...x,target:Number(x.target),saved:Number(x.saved),deadline:x.deadline instanceof Date?x.deadline.toISOString().slice(0,10):String(x.deadline)})),interventions:interventions.rows,notifications:notifications.rows,personalAccounts,personalLoans,personalInvestmentPlans},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
