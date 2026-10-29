import type { Database } from '../db';
import {authorizeOrganizationDelivery} from './authorization';

const SPREADSHEET_ID = /^[A-Za-z0-9_-]{10,200}$/;

export class SpreadsheetBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpreadsheetBindingError';
  }
}

/**
 * Bind a spreadsheet from a trusted local administrative workflow.
 * This function does not authenticate an end user; never expose it through a
 * public route or accept its arguments directly from an untrusted client.
 * Repeating the exact existing binding is idempotent; all reassignment fails.
 */
export async function bindSpreadsheetForOrganization(
  db: Database,
  tenantId: string,
  orgId: string,
  spreadsheetId: string,
): Promise<void> {
  if (!tenantId.trim() || tenantId.length > 200) {
    throw new SpreadsheetBindingError('A valid tenant ID is required.');
  }
  if (!orgId.trim() || orgId.length > 200) {
    throw new SpreadsheetBindingError('A valid organization ID is required.');
  }
  if (!SPREADSHEET_ID.test(spreadsheetId)) {
    throw new SpreadsheetBindingError('Invalid Google spreadsheet ID.');
  }

  await db.transaction(async tx => {
    const org = orgId==='ngo-imizi' ? null : await tx.query(
      'SELECT 1 FROM finance_orgs WHERE tenant_id=$1 AND org_id=$2 FOR SHARE',
      [tenantId, orgId],
    );
    if (orgId==='ngo-imizi') await authorizeOrganizationDelivery(tx,tenantId,orgId);
    else if (!org?.rows.length) {
      throw new SpreadsheetBindingError('Organization not found in the specified tenant.');
    }

    const existing = await tx.query<{ spreadsheet_id: string }>(
      'SELECT spreadsheet_id FROM organization_sheet_bindings WHERE tenant_id=$1 AND org_id=$2 FOR UPDATE',
      [tenantId, orgId],
    );
    if (existing.rows.length) {
      if (existing.rows[0].spreadsheet_id === spreadsheetId) return;
      throw new SpreadsheetBindingError('This organization already has a spreadsheet binding; reassignment is not allowed.');
    }

    const collision = await tx.query(
      'SELECT 1 FROM organization_sheet_bindings WHERE spreadsheet_id=$1',
      [spreadsheetId],
    );
    if (collision.rows.length) {
      throw new SpreadsheetBindingError('This spreadsheet is already bound to another organization.');
    }

    // The UNIQUE constraint remains the race-safe authority if another trusted
    // binding transaction claims this ID after the collision check.
    await tx.query(
      'INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES($1,$2,$3)',
      [tenantId, orgId, spreadsheetId],
    );
  });
}
