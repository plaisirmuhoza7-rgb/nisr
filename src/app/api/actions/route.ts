import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireActor} from '@/server/auth';
import {getDb} from '@/server/db';
import {assertPermission,DomainError} from '@/server/permissions';
import {financeAction} from '@/server/finance/service';
import {checkMutation,apiError} from '@/server/http';
const amount=z.number().int().min(1).max(1_000_000_000_000);
const financeActions=new Set(['contribute','requestLoan','approveLoan','confirmPayment','repay','donate','requestExpense','approveExpense','createCampaign','updateCampaign','grantCampaignAccess','revokeCampaignAccess','postCampaignUpdate','addCampaignComment','moderateCampaignComment','toggleCampaignReaction','toggleCampaignFollow','addCampaignMedia','createCampaignMilestone','updateCampaignMilestone','submitCampaignRsvp','addCampaignGiftItem','createMatchingPledge','assignCampaignTeamMember','moderateCampaign','createProposal','vote','recordCoop','configureGroup','reverseEntry','reconcile','startRotation','payRotation','createGroupInvite','settleGroupCycle','retryShareOut','setGroupMemberRole','startSavingsCycle','addGroupMember','sendPaymentReminder','recordExpense','confirmExpensePayment','recordIncome','createExpenseCategory','createCooperative','subscribeCoopShares','payCoopShares','recordCoopDelivery','confirmDeliveryPayment','recordCoopSale','recordCoopExpense','approveCoopExpense','confirmCoopExpensePayment','calculateSurplusAllocation','approveSurplusAllocation','distributeMemberSurplus','simulateInvestmentProposal','recordGovernanceEvent','assignStaffAppointment','createNgoOrganization','updateNgoProfile','addNgoStaffMember','updateNgoStaffRole','createNgoProgram','createNgoProject','createNgoGrant','createNgoBudgetLine','requestNgoExpense','reviewNgoExpense','approveNgoExpense','confirmNgoExpensePayment','recordNgoActivity','verifyNgoActivity','enrollNgoBeneficiaryCohort','submitNgoFieldVisit','syncOfflineFieldVisits','createNgoIndicator','recordIndicatorObservation','verifyNgoIndicator','resolveDataQualityIssue','generateNgoReportSnapshot','approveNgoReportSnapshot','grantNgoDonorAccess','revokeNgoDonorAccess']);
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
  const data=z.object({amount,category:z.string().min(1).max(50),note:z.string().trim().min(1).max(150)}).parse(input);
  const id=randomUUID();
  const message=`[EXPENSE:${data.category}:${data.amount}] ${data.note}`;
  await db.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[id,actor.tenantId,actor.userId,message]);
  result={id};
 }else if(input.action==='recordPersonalIncome'){
  const data=z.object({amount,source:z.string().trim().min(1).max(150)}).parse(input);
  const id=randomUUID();
  const message=`[INCOME:salary:${data.amount}] ${data.source}`;
  await db.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[id,actor.tenantId,actor.userId,message]);
  result={id};
 }else if(input.action==='addIntervention'){
  await assertPermission(actor,'ngo-imizi','manage');const {title}=z.object({title:z.string().trim().min(3).max(240)}).parse(input);const id=randomUUID();
  await db.transaction(async tx=>{const {rows}=await tx.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 AND role=$4 FOR SHARE',[actor.tenantId,actor.userId,'ngo-imizi',actor.role]);if(!rows.length)throw new DomainError('You are not a member of this program.',403);await tx.query('INSERT INTO interventions(id,tenant_id,org_id,title) VALUES($1,$2,$3,$4)',[id,actor.tenantId,'ngo-imizi',title]);});result={id};
 }else if(financeActions.has(input.action)){result=await financeAction(db,actor,input);
 }else throw new DomainError('Unknown action.');
 return NextResponse.json({ok:true,result});
 }catch(error){if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid JSON.'},{status:400});return apiError(error);}}
