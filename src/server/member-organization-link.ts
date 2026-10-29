import type {Database} from './db';
import {DomainError} from './permissions';

/** Link an already authenticated/resolved user, without moving their personal
 * profile tenant or changing any existing membership. This helper is not an
 * invitation API: the caller must obtain both IDs from trusted server context. */
export async function linkExistingMemberToOrganization(db:Database,input:{
  administratorUserId:string;memberUserId:string;tenantId:string;orgId:string;
}):Promise<{duplicate:boolean}> {
  if(!input || [input.administratorUserId,input.memberUserId,input.tenantId,input.orgId].some(x=>typeof x!=='string'||!x||x.length>256))throw new DomainError('Organization membership is unavailable.',403);
  return db.transaction(async tx=>{
    const admin=await tx.query<{role:string}>(`SELECT m.role FROM account_profiles p
      JOIN memberships m ON m.user_id=p.user_id
      WHERE p.user_id=$1 AND p.status='active' AND m.tenant_id=$2 AND m.org_id=$3 FOR SHARE OF p,m`,[input.administratorUserId,input.tenantId,input.orgId]);
    if(admin.rows.length!==1)throw new DomainError('Organization membership is unavailable.',403);
    const member=await tx.query("SELECT user_id FROM account_profiles WHERE user_id=$1 AND status='active' FOR SHARE",[input.memberUserId]);
    if(member.rows.length!==1)throw new DomainError('Organization membership is unavailable.',403);
    // The existing invitation join takes this same org lock before capacity check.
    const result=await tx.query<{kind:string;savings_model:string|null}>("SELECT kind,savings_model FROM finance_orgs WHERE tenant_id=$1 AND org_id=$2 FOR UPDATE",[input.tenantId,input.orgId]);
    const org=result.rows[0];
    if(result.rows.length!==1 || !org || !(org.kind==='group'&&['ACCUMULATING','ROTATING'].includes(org.savings_model??'')&&admin.rows[0].role==='president' || org.kind==='cooperative'&&admin.rows[0].role==='cooperative'))throw new DomainError('Organization membership is unavailable.',403);
    const existing=await tx.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3 FOR UPDATE',[input.tenantId,input.orgId,input.memberUserId]);
    if(existing.rows.length)return {duplicate:true};
    if(org.kind==='group'){
      const policy=await tx.query<{expected_members:number}>('SELECT expected_members FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2 FOR SHARE',[input.tenantId,input.orgId]);
      if(policy.rows.length!==1)throw new DomainError('Organization membership is unavailable.',403);
      const count=await tx.query<{n:number}>('SELECT COUNT(*)::int AS n FROM memberships WHERE tenant_id=$1 AND org_id=$2',[input.tenantId,input.orgId]);
      if(count.rows[0].n>=policy.rows[0].expected_members)throw new DomainError('This group has reached its expected membership limit.',409);
    }
    await tx.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'member')",[input.tenantId,input.memberUserId,input.orgId]);
    await tx.query('UPDATE finance_orgs SET member_count=member_count+1 WHERE tenant_id=$1 AND org_id=$2',[input.tenantId,input.orgId]);
    return {duplicate:false};
  });
}
