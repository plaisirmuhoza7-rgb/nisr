import type {Actor} from '../../lib/contracts';
import type {Database} from '../db';
import {DomainError} from '../permissions';

export async function organizationSheetStatus(db: Database, actor: Actor, orgId: string): Promise<'not_connected'|'needs_attention'|'synced'|'pending'> {
  const {rows: membership} = await db.query("SELECT 1 FROM memberships m JOIN account_profiles p ON p.tenant_id=m.tenant_id AND p.user_id=m.user_id AND p.status='active' WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.user_id=$3", [actor.tenantId, orgId, actor.userId]);
  if (!membership.length) throw new DomainError('Your account cannot view this organization.', 403);
  const {rows} = await db.query<{status:string;last_error_code:string|null}>(
    'SELECT status,last_error_code FROM organization_sheet_outbox WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, orgId],
  );
  return !rows.length ? 'not_connected' : rows[0].last_error_code ? 'needs_attention' : rows[0].status === 'synced' ? 'synced' : 'pending';
}
