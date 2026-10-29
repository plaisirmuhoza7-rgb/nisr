import type {Database, Sql} from '../db';
import {renderManagedSnapshot} from './snapshot';
import type {SheetCell, SheetRangeUpdate} from './validation';

export type OrganizationSheetSnapshot = {
  spreadsheetId: string;
  desiredRevision: string | bigint;
  deliveredRevision: string | bigint;
  rows: readonly (readonly SheetCell[])[];
};

export type OrganizationSheetWorkerDependencies = {
  /** Recheck and lock an active authorized administrator before delivery. */
  authorizeDestination(tx: Sql, tenantId: string, orgId: string): Promise<void>;
  /** One SQL statement must read the binding, revisions and complete projection.
   * Called after destination locking; never acquire financial/outbox row locks. */
  loadSnapshot(tx: Sql, tenantId: string, orgId: string): Promise<OrganizationSheetSnapshot | null>;
  /** Replace the complete managed range using RAW values; must await completion. */
  writeSnapshot(spreadsheetId: string, update: SheetRangeUpdate): Promise<unknown>;
};

export type OrganizationSheetDelivery = {status: 'idle' | 'pending' | 'synced'; revision?: string};

function revision(value: string | bigint): bigint {
  if (typeof value !== 'bigint' && !/^\d+$/.test(value)) throw new Error('Invalid sheet revision.');
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error('Invalid sheet revision.');
  return parsed;
}

/** Trusted administrator/worker entry point, never a browser authorization boundary.
 * PostgreSQL serializes writers for each exact tenant/org. Hash collisions only
 * serialize unrelated destinations; they cannot mix scopes. Namespace 42862027
 * is separate from the database migration lock and from financial row locking.
 */
export async function deliverOrganizationSheet(
  db: Database, tenantId: string, orgId: string, dependencies: OrganizationSheetWorkerDependencies,
): Promise<OrganizationSheetDelivery> {
  if (!tenantId || !orgId) throw new Error('An exact sheet destination scope is required.');
  const sent = await db.transaction(async tx => {
    await tx.exec('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await tx.query('SELECT pg_advisory_xact_lock(42862027, hashtext($1))', [JSON.stringify([tenantId, orgId])]);
    await dependencies.authorizeDestination(tx, tenantId, orgId);
    const snapshot = await dependencies.loadSnapshot(tx, tenantId, orgId);
    if (!snapshot) return null;
    const desired = revision(snapshot.desiredRevision), delivered = revision(snapshot.deliveredRevision);
    if (desired <= delivered) return null;
    await dependencies.writeSnapshot(snapshot.spreadsheetId, renderManagedSnapshot(snapshot.rows));
    return {spreadsheetId: snapshot.spreadsheetId, revision: desired.toString()};
  });
  if (!sent) return {status: 'idle'};

  // The destination lock has committed. This brief independent UPDATE never
  // holds the coalescing outbox row while waiting for the external writer.
  // GREATEST tolerates a later worker acknowledging first.
  return db.transaction(async tx => {
    const {rows} = await tx.query<{status: 'pending' | 'synced'}>(`
      UPDATE organization_sheet_outbox AS o
      SET delivered_revision=GREATEST(o.delivered_revision,$3::bigint),
          status=CASE WHEN o.desired_revision>GREATEST(o.delivered_revision,$3::bigint)
                      THEN 'pending' ELSE 'synced' END,
          attempt_count=0, last_error_code=NULL, next_attempt_at=now(),
          updated_at=now()
      WHERE o.tenant_id=$1 AND o.org_id=$2 AND o.desired_revision >= $3::bigint
        AND EXISTS (SELECT 1 FROM organization_sheet_bindings b
                    WHERE b.tenant_id=o.tenant_id AND b.org_id=o.org_id AND b.spreadsheet_id=$4)
      RETURNING status`, [tenantId, orgId, sent.revision, sent.spreadsheetId]);
    return rows[0] ? {status: rows[0].status, revision: sent.revision} : {status: 'idle'};
  });
}
