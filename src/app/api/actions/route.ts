import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireActor} from '@/server/auth';
import {getDb} from '@/server/db';
import {assertPermission,DomainError} from '@/server/permissions';
import {financeAction} from '@/server/finance/service';
import {checkMutation,apiError} from '@/server/http';
import {recordPersonalLoanPayment} from '@/server/personal-loans';
import {repaymentSchedule} from '@/lib/personal-finance';
const amount=z.number().int().min(1).max(1_000_000_000_000);
const financeActions=new Set(['contribute','requestLoan','approveLoan','confirmPayment','repay','donate','requestExpense','approveExpense','createCampaign','updateCampaign','grantCampaignAccess','revokeCampaignAccess','postCampaignUpdate','addCampaignComment','moderateCampaignComment','toggleCampaignReaction','toggleCampaignFollow','addCampaignMedia','createCampaignMilestone','updateCampaignMilestone','submitCampaignRsvp','addCampaignGiftItem','createMatchingPledge','assignCampaignTeamMember','moderateCampaign','createProposal','vote','recordCoop','configureGroup','reverseEntry','reconcile','startRotation','payRotation','createGroupInvite','settleGroupCycle','retryShareOut','setGroupMemberRole','startSavingsCycle','addGroupMember','addCoopMember','sendPaymentReminder','recordExpense','confirmExpensePayment','recordIncome','createExpenseCategory','createCooperative','subscribeCoopShares','payCoopShares','recordCoopDelivery','confirmDeliveryPayment','recordCoopSale','recordCoopExpense','approveCoopExpense','confirmCoopExpensePayment','calculateSurplusAllocation','approveSurplusAllocation','distributeMemberSurplus','simulateInvestmentProposal','recordGovernanceEvent','assignStaffAppointment']);
export const runtime='nodejs';
export async function POST(request:Request){try{
 checkMutation(request);const text=await request.text();if(text.length>16000)throw new DomainError('Request is too large.',413);
 const input=z.object({action:z.string().min(1).max(50),orgId:z.string().max(100).optional()}).passthrough().parse(JSON.parse(text));
 const actor=await requireActor();const db=await getDb();let result:unknown;
 if(input.action==='createGoal'){
  const data=z.object({name:z.string().trim().min(2).max(100),target:amount,saved:z.number().int().min(0).max(1_000_000_000_000).default(0),deadline:z.iso.date()}).parse(input);const id=randomUUID();
  await db.query('INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,actor.tenantId,actor.userId,data.name,data.target,data.saved,data.deadline]);result={id};
 }else if(input.action==='addGoalSavings'){
  const data=z.object({goalId:z.string(),amount}).parse(input);
  const {rows}=await db.query('UPDATE goals SET saved=saved+$1 WHERE id=$2 AND tenant_id=$3 AND user_id=$4 AND saved+$1<=1000000000000 RETURNING id',[data.amount,data.goalId,actor.tenantId,actor.userId]);if(!rows.length)throw new DomainError('Goal not found or amount exceeds the supported limit.',404);result={id:data.goalId};
 }else if(input.action==='deleteGoal'){
  const data=z.object({goalId:z.string()}).parse(input);
  const {rows}=await db.query('DELETE FROM goals WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id',[data.goalId,actor.tenantId,actor.userId]);if(!rows.length)throw new DomainError('Goal not found.',404);result={id:data.goalId};
 }else if(input.action==='recordPersonalExpense'){
  const data=z.object({amount,category:z.string().min(1).max(50),note:z.string().trim().min(1).max(150),accountId:z.string().optional()}).parse(input);
  const id=randomUUID();
  const message=`[EXPENSE:${data.category}:${data.amount}] ${data.note}`;
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[id,actor.tenantId,actor.userId,message]);
    if(data.accountId){
      await tx.query('UPDATE personal_wallets SET balance=balance-$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4 AND balance>=$1',[data.amount,data.accountId,actor.tenantId,actor.userId]);
    }
  });
  result={id};
 }else if(input.action==='recordPersonalIncome'){
  const data=z.object({amount,source:z.string().trim().min(1).max(150),category:z.string().min(1).max(50).default('salary'),accountId:z.string().optional()}).parse(input);
  const id=randomUUID();
  const message=`[INCOME:${data.category}:${data.amount}] ${data.source}`;
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[id,actor.tenantId,actor.userId,message]);
    if(data.accountId){
      await tx.query('UPDATE personal_wallets SET balance=balance+$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4 AND balance+$1<=1000000000000',[data.amount,data.accountId,actor.tenantId,actor.userId]);
    }
  });
  result={id};
 }else if(input.action==='createPersonalAccount'){
  const data=z.object({institution:z.string().trim().min(1).max(100),accountName:z.string().trim().min(1).max(100),accountType:z.enum(['mobile_money','bank','sacco','cash','investment','other']),accountIdentifier:z.string().trim().max(100).default(''),balance:z.number().int().min(0).max(1_000_000_000_000).default(0),notes:z.string().trim().max(250).default('')}).parse(input);
  const id=randomUUID();
  await db.query('INSERT INTO personal_wallets(id,tenant_id,user_id,institution,account_name,account_type,account_identifier,balance,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,actor.tenantId,actor.userId,data.institution,data.accountName,data.accountType,data.accountIdentifier,data.balance,data.notes]);
  result={id};
 }else if(input.action==='updatePersonalAccountBalance'){
  const data=z.object({accountId:z.string(),balance:z.number().int().min(0).max(1_000_000_000_000)}).parse(input);
  const {rows}=await db.query('UPDATE personal_wallets SET balance=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4 RETURNING id',[data.balance,data.accountId,actor.tenantId,actor.userId]);
  if(!rows.length)throw new DomainError('Account not found.',404);
  result={id:data.accountId};
 }else if(input.action==='deletePersonalAccount'){
  const data=z.object({accountId:z.string()}).parse(input);
  const {rows}=await db.query('DELETE FROM personal_wallets WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id',[data.accountId,actor.tenantId,actor.userId]);
  if(!rows.length)throw new DomainError('Account not found.',404);
  result={id:data.accountId};
 }else if(input.action==='createPersonalLoan'){
  const data=z.object({counterpartyName:z.string().trim().min(1).max(100),counterpartyPhone:z.string().trim().max(50).default(''),direction:z.enum(['i_owe','they_owe']),amount,dueDate:z.union([z.iso.date(),z.literal('')]).optional(),notes:z.string().trim().max(250).default(''),repaymentMonths:z.number().int().min(1).max(120).optional(),firstPaymentDate:z.iso.date().optional()}).refine(x=>(x.repaymentMonths===undefined)===(x.firstPaymentDate===undefined) && (!x.repaymentMonths || x.amount>=x.repaymentMonths),{message:'Provide a valid repayment duration and first payment date.'}).parse(input);
  let plannedDueDate:string|undefined;
  if(data.repaymentMonths&&data.firstPaymentDate){
   try{plannedDueDate=repaymentSchedule(data.amount,data.repaymentMonths,data.firstPaymentDate).at(-1)?.dueDate;}
   catch{throw new DomainError('Repayment plan dates are invalid or exceed the supported range.',400);}
  }
  const id=randomUUID();
  await db.query('INSERT INTO personal_loans(id,tenant_id,user_id,counterparty_name,counterparty_phone,direction,amount,paid_amount,due_date,notes,status,repayment_months,first_payment_date) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12)',[id,actor.tenantId,actor.userId,data.counterpartyName,data.counterpartyPhone,data.direction,data.amount,data.dueDate||plannedDueDate||null,data.notes,'active',data.repaymentMonths||null,data.firstPaymentDate||null]);
  result={id};
 }else if(input.action==='recordPersonalLoanPayment'){
  const data=z.object({loanId:z.string(),amount,paymentDate:z.iso.date().optional(),reference:z.string().trim().min(1).max(100).optional()}).parse(input);
  result=await recordPersonalLoanPayment(db,actor,{...data,paymentDate:data.paymentDate||new Date().toISOString().slice(0,10)});
 }else if(input.action==='deletePersonalLoan'){
  const data=z.object({loanId:z.string()}).parse(input);
  const {rows}=await db.query('DELETE FROM personal_loans WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id',[data.loanId,actor.tenantId,actor.userId]);
  if(!rows.length)throw new DomainError('Loan not found.',404);
  result={id:data.loanId};
 }else if(input.action==='createPersonalInvestmentPlan'){
  const data=z.object({title:z.string().trim().min(2).max(100),category:z.enum(['agriculture','retail','transport','real_estate','technology','services','other']).default('other'),capitalRequired:z.number().int().min(0).max(1_000_000_000_000).default(0),projectedRevenue:z.number().int().min(0).max(1_000_000_000_000).default(0),projectedExpenses:z.number().int().min(0).max(1_000_000_000_000).default(0),timeHorizonMonths:z.number().int().min(1).max(120).default(12),notes:z.string().trim().max(500).default(''),status:z.enum(['draft','planned','active','completed','abandoned']).default('planned')}).parse(input);
  const id=randomUUID();
  await db.query('INSERT INTO personal_investment_plans(id,tenant_id,user_id,title,category,capital_required,projected_revenue,projected_expenses,time_horizon_months,notes,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,actor.tenantId,actor.userId,data.title,data.category,data.capitalRequired,data.projectedRevenue,data.projectedExpenses,data.timeHorizonMonths,data.notes,data.status]);
  result={id};
 }else if(input.action==='updatePersonalInvestmentPlan'){
  const data=z.object({planId:z.string(),title:z.string().trim().min(2).max(100).optional(),category:z.enum(['agriculture','retail','transport','real_estate','technology','services','other']).optional(),capitalRequired:z.number().int().min(0).max(1_000_000_000_000).optional(),projectedRevenue:z.number().int().min(0).max(1_000_000_000_000).optional(),projectedExpenses:z.number().int().min(0).max(1_000_000_000_000).optional(),timeHorizonMonths:z.number().int().min(1).max(120).optional(),notes:z.string().trim().max(500).optional(),status:z.enum(['draft','planned','active','completed','abandoned']).optional()}).parse(input);
  const {rows}=await db.query('UPDATE personal_investment_plans SET title=COALESCE($1,title), category=COALESCE($2,category), capital_required=COALESCE($3,capital_required), projected_revenue=COALESCE($4,projected_revenue), projected_expenses=COALESCE($5,projected_expenses), time_horizon_months=COALESCE($6,time_horizon_months), notes=COALESCE($7,notes), status=COALESCE($8,status), updated_at=now() WHERE id=$9 AND tenant_id=$10 AND user_id=$11 RETURNING id',[data.title,data.category,data.capitalRequired,data.projectedRevenue,data.projectedExpenses,data.timeHorizonMonths,data.notes,data.status,data.planId,actor.tenantId,actor.userId]);
  if(!rows.length)throw new DomainError('Investment plan not found.',404);
  result={id:data.planId};
 }else if(input.action==='deletePersonalInvestmentPlan'){
  const data=z.object({planId:z.string()}).parse(input);
  const {rows}=await db.query('DELETE FROM personal_investment_plans WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id',[data.planId,actor.tenantId,actor.userId]);
  if(!rows.length)throw new DomainError('Investment plan not found.',404);
  result={id:data.planId};
 }else if(financeActions.has(input.action)){result=await financeAction(db,actor,input);
 }else throw new DomainError('Unknown action.');
 return NextResponse.json({ok:true,result});
 }catch(error){if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid JSON.'},{status:400});return apiError(error);}}
