import type {Actor,Role} from '../lib/contracts';
import type {Sql} from './db';
import {DomainError} from './permissions';

const roles:ReadonlySet<string>=new Set(['member','president','treasurer','cooperative','ngo']);
const unavailable=()=>new DomainError('Your account cannot access this organization.',403);

/** Resolve a selected organization from the authenticated identity and stored
 * membership, never from a role supplied by the caller. Use inside the same
 * transaction as the authorized operation so these SHARE locks remain held.
 * The selected orgId must also be passed to and enforced by the service; Actor
 * itself does not contain an organization ID. The profile's tenant is the
 * person's existing private-data tenant and is intentionally not changed. */
export async function resolveMemberOrganizationContext(
  tx:Sql, authenticatedUserId:string, selection:{tenantId:string;orgId:string},
):Promise<{actor:Actor;orgId:string}> {
  if(typeof authenticatedUserId!=='string' || !authenticatedUserId || authenticatedUserId.length>256 ||
    !selection || typeof selection.tenantId!=='string' || !selection.tenantId || selection.tenantId.length>256 ||
    typeof selection.orgId!=='string' || !selection.orgId || selection.orgId.length>256) throw unavailable();
  const result=await tx.query<{role:string}>(`
    SELECT m.role FROM account_profiles p
    JOIN memberships m ON m.user_id=p.user_id
    JOIN finance_orgs o ON o.tenant_id=m.tenant_id AND o.org_id=m.org_id
    WHERE p.user_id=$1 AND p.status='active' AND m.tenant_id=$2 AND m.org_id=$3
    FOR SHARE OF p,m,o`,[authenticatedUserId,selection.tenantId,selection.orgId]);
  if(result.rows.length!==1 || !roles.has(result.rows[0].role))throw unavailable();
  return {actor:{userId:authenticatedUserId,tenantId:selection.tenantId,role:result.rows[0].role as Role},orgId:selection.orgId};
}
