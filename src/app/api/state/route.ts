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
 const [goals,interventions,notifications]=await Promise.all([
 db.query('SELECT id,name,target,saved,deadline FROM goals WHERE tenant_id=$1 AND user_id=$2 ORDER BY deadline',[actor.tenantId,actor.userId]),
 workspace==='impact'&&user.memberships.some(m=>m.orgId==='ngo-imizi')?db.query('SELECT id,title,created_at FROM interventions WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC',[actor.tenantId,'ngo-imizi']):Promise.resolve({rows:[]}),
 db.query('SELECT id,message,created_at FROM notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 20',[actor.tenantId,actor.userId])]);
 return NextResponse.json({...state,user,goals:goals.rows.map(x=>({...x,target:Number(x.target),saved:Number(x.saved),deadline:x.deadline instanceof Date?x.deadline.toISOString().slice(0,10):String(x.deadline)})),interventions:interventions.rows,notifications:notifications.rows},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
