import {NextResponse} from 'next/server';
import {requireAccount} from '@/server/auth';
import {getDb} from '@/server/db';
import {assertPermission,DomainError} from '@/server/permissions';
import {financeState} from '@/server/finance/service';
import {apiError} from '@/server/http';
export const dynamic='force-dynamic';
function cell(value:unknown){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function GET(request:Request){try{
 const user=await requireAccount();const actor={tenantId:user.tenantId,userId:user.id,role:user.role};const type=new URL(request.url).searchParams.get('type')||'personal';
 if(type==='group'&&!user.workspaces.includes('groups'))throw new DomainError('Your account cannot download this organizational report.',403);
 if(type==='group')await assertPermission(actor,'group-ubumwe','report');else if(type!=='personal')throw new DomainError('Unknown report type.');
 const state=await financeState(await getDb(),actor);let rows:unknown[][];
 if(type==='group'){
  const {rows:entries}=await (await getDb()).transaction(async tx=>{
   const {rows:memberships}=await tx.query('SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 AND role=$4 FOR SHARE',[actor.tenantId,actor.userId,'group-ubumwe',actor.role]);
   if(!memberships.length)throw new DomainError('Your organization access has changed.',403);
   return tx.query('SELECT e.created_at,e.description,e.reference,SUM(l.debit)::text AS debit,SUM(l.credit)::text AS credit FROM finance_entries e JOIN finance_lines l ON l.entry_id=e.id AND l.tenant_id=e.tenant_id AND l.org_id=e.org_id WHERE e.tenant_id=$1 AND e.org_id=$2 GROUP BY e.id ORDER BY e.created_at DESC,e.id',[actor.tenantId,'group-ubumwe']);
  });
  rows=[['Date','Description','Debit RWF','Credit RWF','Reference'],...entries.map(x=>[x.created_at instanceof Date?x.created_at.toISOString():x.created_at,x.description,x.debit,x.credit,x.reference])];
 }else {
  const {rows:payments}=await (await getDb()).query("SELECT p.created_at,p.amount,CASE WHEN EXISTS (SELECT 1 FROM finance_entries e WHERE e.tenant_id=p.tenant_id AND e.org_id=p.org_id AND e.reversal_of=p.journal_id) THEN 'reversed' ELSE p.status END AS status FROM finance_payments p WHERE p.tenant_id=$1 AND p.user_id=$2 AND p.kind='contribution' ORDER BY p.created_at DESC",[actor.tenantId,actor.userId]);
  rows=[['Date','Contribution RWF','Status'],...payments.map(x=>[x.created_at instanceof Date?x.created_at.toISOString():x.created_at,x.amount,x.status])];
 }
 const csv=[['HURIZA fictional demo records. Simulated transactions; no real money.'],...rows].map(row=>row.map(cell).join(',')).join('\r\n');
 return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="huriza-${type}.csv"`,'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
