import type {Sql} from '../db';

/** Hold an active administrator's profile and membership until the sheet write
 * completes. Financial rows and outbox rows are not locked here. */
export async function authorizeOrganizationDelivery(tx: Sql, tenantId: string, orgId: string): Promise<void> {
  const {rows: candidates} = await tx.query<{user_id:string;role:string;kind:string}>(`
    SELECT m.user_id,m.role,CASE WHEN m.org_id='ngo-imizi' THEN 'ngo' ELSE o.kind END AS kind FROM memberships m
    JOIN account_profiles p ON p.tenant_id=m.tenant_id AND p.user_id=m.user_id AND p.status='active'
    LEFT JOIN finance_orgs o ON o.tenant_id=m.tenant_id AND o.org_id=m.org_id
    WHERE m.tenant_id=$1 AND m.org_id=$2 AND
      ((m.org_id<>'ngo-imizi' AND o.kind IN ('group','fund') AND m.role IN ('president','treasurer')) OR
       (m.org_id<>'ngo-imizi' AND o.kind='cooperative' AND m.role='cooperative') OR
       (m.org_id='ngo-imizi' AND m.role='ngo'))
    ORDER BY m.user_id`, [tenantId, orgId]);
  for (const candidate of candidates) {
    // Provisioning locks profiles before changing users and memberships.
    const profile = await tx.query("SELECT 1 FROM account_profiles WHERE tenant_id=$1 AND user_id=$2 AND status='active' FOR SHARE", [tenantId, candidate.user_id]);
    if (!profile.rows.length) continue;
    const account = await tx.query<{role:string}>('SELECT role FROM app_users WHERE id=$1 FOR SHARE', [candidate.user_id]);
    if (!account.rows.length || candidate.kind !== 'group' && account.rows[0].role !== candidate.role) continue;
    const membership = await tx.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3 AND role=$4 FOR SHARE', [tenantId, orgId, candidate.user_id, candidate.role]);
    if (membership.rows.length) return;
  }
  throw new Error('Organization has no active authorized spreadsheet administrator.');
}
