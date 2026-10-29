import type {Actor} from '../../lib/contracts';
import type {Database} from '../db';
import {DomainError} from '../permissions';
import {financeStateInTransaction} from '../finance/service';
import {projectSavingsGroupForSheets} from './projection';
import type {SheetRangeUpdate} from './validation';

type SheetWriter = (spreadsheetId: string, updates: SheetRangeUpdate[], allowedRanges: string[]) => Promise<unknown>;
const SUMMARY_RANGE = "'HURIZA setup'!A5:B14";
const STATUS_RANGE = "'HURIZA setup'!A2";

/**
 * Manually publish a simulated group aggregate. The caller must derive actor from
 * a verified server session and supply a server-controlled writer. Spreadsheet
 * IDs come only from a trusted administrator's binding.
 */
export async function syncSavingsGroupSummary(db: Database, actor: Actor, orgId: string, write: SheetWriter): Promise<void> {
  if (!actor.tenantId || !actor.userId || !/^group-[A-Za-z0-9_-]{1,100}$/.test(orgId)) {
    throw new DomainError('Your account cannot sync this savings group.', 403);
  }
  await db.transaction(async tx => {
    // Finance operations lock the org first; use the same order for a consistent
    // snapshot and to serialize exports with changes to this group's ledger.
    const org = await tx.query("SELECT 1 FROM finance_orgs WHERE tenant_id=$1 AND org_id=$2 AND kind='group' FOR UPDATE", [actor.tenantId, orgId]);
    if (!org.rows.length) throw new DomainError('Your account cannot sync this savings group.', 403);
    const access = await tx.query<{spreadsheet_id: string}>(
      `SELECT b.spreadsheet_id FROM organization_sheet_bindings b
       JOIN memberships m ON m.tenant_id=b.tenant_id AND m.org_id=b.org_id
       JOIN account_profiles p ON p.tenant_id=m.tenant_id AND p.user_id=m.user_id
       WHERE b.tenant_id=$1 AND b.org_id=$2 AND m.user_id=$3
         AND m.role IN ('president','treasurer') AND p.status='active'
       FOR SHARE OF b,m,p`,
      [actor.tenantId, orgId, actor.userId],
    );
    if (!access.rows.length) throw new DomainError('Your group is not connected to a sheet, or your account cannot sync it.', 403);
    const state = await financeStateInTransaction(tx, actor, {orgId});
    const projection = projectSavingsGroupForSheets(state, orgId);
    const rows = projection.values.map(row => [row[0] ?? '', row[1] ?? '']);
    // Exactly these app-owned cells are replaced; retries converge on the same
    // snapshot and never append duplicate entries. A failed write never posts money.
    await write(access.rows[0].spreadsheet_id, [
      {range: STATUS_RANGE, values: [['Simulated group summary synchronized.']]},
      {range: SUMMARY_RANGE, values: rows},
    ], [STATUS_RANGE, SUMMARY_RANGE]);
  });
}
