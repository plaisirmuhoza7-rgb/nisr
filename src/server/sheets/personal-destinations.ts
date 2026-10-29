import type {Database,Sql} from '../db';
import {DomainError} from '../permissions';

/** Must be derived from a verified server session, never request JSON. */
export type PersonalSheetOwner={tenantId:string;userId:string};
export type PersonalSheetOrganization={orgId:string;name:string;selected:boolean;syncStatus:'pending'|'synced'|'needs_attention'};

async function requireOwner(tx:Sql,owner:PersonalSheetOwner){
 if(!owner.tenantId||!owner.userId)throw new DomainError('This account cannot share personal goals.',403);
 const profile=await tx.query("SELECT 1 FROM account_profiles WHERE tenant_id=$1 AND user_id=$2 AND status='active' FOR UPDATE",[owner.tenantId,owner.userId]);
 if(!profile.rows.length)throw new DomainError('This account cannot share personal goals.',403);
}

/** Lists only this person's current memberships with trusted sheet bindings. */
export async function availablePersonalSheetOrganizations(db:Database,owner:PersonalSheetOwner):Promise<PersonalSheetOrganization[]>{
 return db.transaction(async tx=>{
  await requireOwner(tx,owner);
  const result=await tx.query<{org_id:string;name:string;selected:boolean;sync_status:'pending'|'synced'|'needs_attention'}>(`SELECT m.org_id,o.name,EXISTS(SELECT 1 FROM personal_sheet_destinations d WHERE d.tenant_id=m.tenant_id AND d.user_id=m.user_id AND d.org_id=m.org_id) AS selected,
   CASE WHEN q.last_error_code IS NOT NULL THEN 'needs_attention' WHEN q.status='synced' THEN 'synced' ELSE 'pending' END AS sync_status
   FROM memberships m JOIN organization_sheet_bindings b ON b.tenant_id=m.tenant_id AND b.org_id=m.org_id
   JOIN finance_orgs o ON o.tenant_id=m.tenant_id AND o.org_id=m.org_id
   LEFT JOIN organization_sheet_outbox q ON q.tenant_id=m.tenant_id AND q.org_id=m.org_id
   WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.org_id<>'ngo-imizi' ORDER BY o.name,m.org_id FOR SHARE OF m,b,o`,[owner.tenantId,owner.userId]);
  return result.rows.map(r=>({orgId:r.org_id,name:r.name,selected:r.selected,syncStatus:r.sync_status}));
 });
}

/** Explicitly consents to sharing submitted goals with the chosen sheet audience. */
export async function choosePersonalSheetDestination(db:Database,owner:PersonalSheetOwner,orgId:string):Promise<void>{
 if(typeof orgId!=='string'||!orgId.trim()||orgId.length>200||orgId==='ngo-imizi')throw new DomainError('Choose an available organization.',403);
 await db.transaction(async tx=>{
  await requireOwner(tx,owner);
  const access=await tx.query(`SELECT 1 FROM memberships m JOIN organization_sheet_bindings b ON b.tenant_id=m.tenant_id AND b.org_id=m.org_id
   WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.org_id=$3 FOR SHARE OF m,b`,[owner.tenantId,owner.userId,orgId]);
  if(!access.rows.length)throw new DomainError('Choose an available organization.',403);
  await tx.query(`INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES($1,$2,$3)
   ON CONFLICT(tenant_id,user_id) DO UPDATE SET org_id=EXCLUDED.org_id
   WHERE personal_sheet_destinations.org_id IS DISTINCT FROM EXCLUDED.org_id`,[owner.tenantId,owner.userId,orgId]);
 });
}

export async function clearPersonalSheetDestination(db:Database,owner:PersonalSheetOwner):Promise<void>{
 await db.transaction(async tx=>{
  await requireOwner(tx,owner);
  await tx.query('DELETE FROM personal_sheet_destinations WHERE tenant_id=$1 AND user_id=$2',[owner.tenantId,owner.userId]);
 });
}
