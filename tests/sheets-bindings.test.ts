import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {bindSpreadsheetForOrganization} from '../src/server/sheets/bindings';

let pg: PGlite;
let db: Database;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = {
    query: (query, params) => pg.query(query, params),
    exec: query => pg.exec(query),
    transaction: fn => pg.transaction(tx => fn({
      query: (query, params) => tx.query(query, params),
      exec: query => tx.exec(query),
    })),
  };
  for (const migration of ['001-identity.sql', '002-finance.sql', '006-google-sheets-bindings.sql']) {
    await db.exec(await readFile(`migrations/${migration}`, 'utf8'));
  }
  await db.query('INSERT INTO demo_tenants(id) VALUES($1),($2)', ['tenant-a', 'tenant-b']);
  await db.query(
    "INSERT INTO finance_orgs(tenant_id,org_id,name,kind) VALUES($1,$2,'Group A','group'),($3,$4,'Group B','group')",
    ['tenant-a', 'group-a', 'tenant-b', 'group-b'],
  );
});

after(async () => { await pg?.close(); });

test('binding requires exact tenant and organization and can be repeated unchanged', async () => {
  await assert.rejects(bindSpreadsheetForOrganization(db, 'tenant-b', 'group-a', 'spreadsheet_123456'), /Organization not found/);
  await bindSpreadsheetForOrganization(db, 'tenant-a', 'group-a', 'spreadsheet_123456');
  await bindSpreadsheetForOrganization(db, 'tenant-a', 'group-a', 'spreadsheet_123456');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM organization_sheet_bindings')).rows[0].n, 1);
});

test('a spreadsheet ID cannot be bound to organizations in another tenant', async () => {
  await assert.rejects(bindSpreadsheetForOrganization(db, 'tenant-b', 'group-b', 'spreadsheet_123456'), /already bound/);
  assert.equal((await db.query('SELECT tenant_id,org_id FROM organization_sheet_bindings')).rows[0].tenant_id, 'tenant-a');
});

test('an existing organization binding cannot be reassigned', async () => {
  await assert.rejects(bindSpreadsheetForOrganization(db, 'tenant-a', 'group-a', 'replacement_123456'), /reassignment is not allowed/);
  assert.equal((await db.query('SELECT spreadsheet_id FROM organization_sheet_bindings WHERE tenant_id=$1 AND org_id=$2', ['tenant-a', 'group-a'])).rows[0].spreadsheet_id, 'spreadsheet_123456');
});

test('spreadsheet IDs are validated before any write', async () => {
  await assert.rejects(bindSpreadsheetForOrganization(db, 'tenant-b', 'group-b', 'not valid!'), /Invalid Google spreadsheet ID/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM organization_sheet_bindings')).rows[0].n, 1);
});
