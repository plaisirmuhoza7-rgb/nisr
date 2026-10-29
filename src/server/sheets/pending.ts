import type {Database} from '../db';

type Delivery = (tenantId: string, orgId: string) => Promise<unknown>;

/** Trusted worker scan; business data is fetched later under each exact scope. */
export async function processPendingSheetDeliveries(db: Database, deliver: Delivery, limit = 10): Promise<void> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid delivery batch size.');
  const {rows} = await db.query<{tenant_id:string;org_id:string}>(
    `SELECT tenant_id,org_id FROM organization_sheet_outbox
     WHERE status='pending' AND desired_revision>delivered_revision AND next_attempt_at<=now()
     ORDER BY next_attempt_at,tenant_id,org_id LIMIT $1`, [limit],
  );
  for (const {tenant_id: tenantId, org_id: orgId} of rows) {
    try {
      await deliver(tenantId, orgId);
    } catch (error) {
      // Store only a fixed classification; API errors can contain secrets or data.
      const code = error instanceof RangeError ? 'capacity' : 'connection';
      await db.query(`UPDATE organization_sheet_outbox
        SET attempt_count=LEAST(attempt_count+1,20), last_error_code=$3,
            next_attempt_at=now()+(LEAST(1800,15*power(2,LEAST(attempt_count,7))) * interval '1 second'),
            updated_at=now()
        WHERE tenant_id=$1 AND org_id=$2 AND desired_revision>delivered_revision`, [tenantId, orgId, code]);
    }
  }
}
