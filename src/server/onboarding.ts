import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database,Sql} from './db';
import {DomainError} from './permissions';
import type {WorkspaceRequest} from '@/lib/onboarding';

const schema=z.object({purpose:z.enum(['fundraising','cooperative','impact']),organizationName:z.string().trim().min(2).max(120),district:z.string().trim().min(2).max(100),description:z.string().trim().min(20).max(2000)}).strict();
type Owner={tenantId:string;userId:string};
async function requireOwner(db:Sql,owner:Owner){
 const profile=await db.query("SELECT 1 FROM account_profiles WHERE tenant_id=$1 AND user_id=$2 AND status='active'",[owner.tenantId,owner.userId]);
 if(!profile.rows.length)throw new DomainError('This account cannot submit an organization request.',403);
}
const project=(row:Record<string,unknown>):WorkspaceRequest=>({id:String(row.id),purpose:row.purpose as WorkspaceRequest['purpose'],organizationName:String(row.organization_name),district:String(row.district),description:String(row.description),status:'submitted',createdAt:row.created_at instanceof Date?row.created_at.toISOString():String(row.created_at)});
export async function workspaceRequests(db:Sql,owner:Owner):Promise<WorkspaceRequest[]>{
 await requireOwner(db,owner);
 const result=await db.query('SELECT id,purpose,organization_name,district,description,status,created_at FROM workspace_onboarding_requests WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC',[owner.tenantId,owner.userId]);
 return result.rows.map(project);
}
export async function submitWorkspaceRequest(db:Database,owner:Owner,input:unknown):Promise<WorkspaceRequest>{
 const data=schema.parse(input);
 return db.transaction(async tx=>{
  await requireOwner(tx,owner);
  // A request records intent only. No identity role or membership is created here.
  await tx.query('INSERT INTO workspace_onboarding_requests(id,tenant_id,user_id,purpose,organization_name,district,description) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,user_id,purpose) DO NOTHING',[randomUUID(),owner.tenantId,owner.userId,data.purpose,data.organizationName,data.district,data.description]);
  const result=await tx.query('SELECT id,purpose,organization_name,district,description,status,created_at FROM workspace_onboarding_requests WHERE tenant_id=$1 AND user_id=$2 AND purpose=$3',[owner.tenantId,owner.userId,data.purpose]);
  return project(result.rows[0]);
 });
}
