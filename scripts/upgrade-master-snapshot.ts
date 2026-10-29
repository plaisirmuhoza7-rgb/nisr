import {loadEnvConfig} from '@next/env';
import {PGlite} from '@electric-sql/pglite';
import path from 'node:path';
import {createDemoMasterTransport} from '../src/server/sheets/demo-master-transport';
import {captureDemoLogicalSnapshot, restoreDemoLogicalSnapshot, parseDemoLogicalSnapshot} from '../src/server/sheets/demo-logical-snapshot';
import {createDemoWriteGuard} from '../src/server/sheets/demo-write-guard';
import {acquireDemoProcessLock} from '../src/server/sheets/demo-process-lock';
import {migrate, type Database} from '../src/server/db';

loadEnvConfig(process.cwd());

function wrap(pg: PGlite): Database {
  return {
    query: (sql, params) => pg.query(sql, params),
    exec: sql => pg.exec(sql),
    transaction: fn => pg.transaction(tx => fn({
      query: (sql, params) => tx.query(sql, params),
      exec: sql => tx.exec(sql)
    })),
    close: () => pg.close()
  };
}

async function main() {
  const masterKey = process.env.HURIZA_DEMO_MASTER_KEY;
  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!masterKey || !sheetId) throw new Error('Missing environment variables');

  const key = Buffer.from(masterKey, 'base64');
  const transport = createDemoMasterTransport(sheetId, key);

  const lockDirectory = path.join(process.cwd(), '.local', 'sheets-primary');
  const release = await acquireDemoProcessLock(lockDirectory);
  try {
    const guard = createDemoWriteGuard(lockDirectory);
    await guard.assertReady();

    const currentEnvelope = await transport.read();
    if (!currentEnvelope) throw new Error('No current demo envelope found in master sheet');

    console.log(`Current envelope slot: ${currentEnvelope.slot}, revision: ${currentEnvelope.revision}`);
    const raw = JSON.parse(currentEnvelope.payload);

    // Prepare upgraded tables
    const upgradedTables = {...raw.tables};
    // 1. account_profiles: ensure workspace column exists on each row
    upgradedTables.account_profiles = (upgradedTables.account_profiles || []).map((row: Record<string, string | null>) => ({
      ...row,
      workspace: row.workspace ?? null
    }));

    // 2. savings group tables from migration 013
    upgradedTables.savings_group_role_history = upgradedTables.savings_group_role_history || [];
    upgradedTables.savings_group_expense_categories = upgradedTables.savings_group_expense_categories || [];
    upgradedTables.savings_group_expenses = upgradedTables.savings_group_expenses || [];

    // 4. cooperative tables from migration 014
    upgradedTables.cooperative_profiles = upgradedTables.cooperative_profiles || [];
    upgradedTables.cooperative_staff_appointments = upgradedTables.cooperative_staff_appointments || [];
    upgradedTables.cooperative_share_accounts = upgradedTables.cooperative_share_accounts || [];
    upgradedTables.cooperative_share_transactions = upgradedTables.cooperative_share_transactions || [];
    upgradedTables.cooperative_deliveries = upgradedTables.cooperative_deliveries || [];
    upgradedTables.cooperative_sales = upgradedTables.cooperative_sales || [];
    upgradedTables.cooperative_surplus_allocations = upgradedTables.cooperative_surplus_allocations || [];
    upgradedTables.cooperative_member_distributions = upgradedTables.cooperative_member_distributions || [];
    upgradedTables.cooperative_investments = upgradedTables.cooperative_investments || [];
    upgradedTables.cooperative_governance_events = upgradedTables.cooperative_governance_events || [];

    // 5. fundraising tables from migration 015
    upgradedTables.fundraising_campaign_profiles = upgradedTables.fundraising_campaign_profiles || [];
    upgradedTables.fundraising_campaign_media = upgradedTables.fundraising_campaign_media || [];
    upgradedTables.fundraising_campaign_updates = upgradedTables.fundraising_campaign_updates || [];
    upgradedTables.fundraising_comments = upgradedTables.fundraising_comments || [];
    upgradedTables.fundraising_reactions = upgradedTables.fundraising_reactions || [];
    upgradedTables.fundraising_followers = upgradedTables.fundraising_followers || [];
    upgradedTables.fundraising_contributions = upgradedTables.fundraising_contributions || [];
    upgradedTables.fundraising_access_grants = upgradedTables.fundraising_access_grants || [];
    upgradedTables.fundraising_team_members = upgradedTables.fundraising_team_members || [];
    upgradedTables.fundraising_milestones = upgradedTables.fundraising_milestones || [];
    upgradedTables.fundraising_expense_details = upgradedTables.fundraising_expense_details || [];
    upgradedTables.fundraising_gift_items = upgradedTables.fundraising_gift_items || [];
    upgradedTables.fundraising_rsvps = upgradedTables.fundraising_rsvps || [];
    upgradedTables.fundraising_matching_pledges = upgradedTables.fundraising_matching_pledges || [];
    upgradedTables.fundraising_moderation_events = upgradedTables.fundraising_moderation_events || [];

    // 6. ngo tables from migration 016
    upgradedTables.ngo_profiles = upgradedTables.ngo_profiles || [];
    upgradedTables.ngo_staff_members = upgradedTables.ngo_staff_members || [];
    upgradedTables.ngo_programs = upgradedTables.ngo_programs || [];
    upgradedTables.ngo_projects = upgradedTables.ngo_projects || [];
    upgradedTables.ngo_grants = upgradedTables.ngo_grants || [];
    upgradedTables.ngo_budget_lines = upgradedTables.ngo_budget_lines || [];
    upgradedTables.ngo_activities = upgradedTables.ngo_activities || [];
    upgradedTables.ngo_expenses = upgradedTables.ngo_expenses || [];
    upgradedTables.ngo_beneficiary_cohorts = upgradedTables.ngo_beneficiary_cohorts || [];
    upgradedTables.ngo_field_visits = upgradedTables.ngo_field_visits || [];
    upgradedTables.ngo_indicators = upgradedTables.ngo_indicators || [];
    upgradedTables.ngo_data_quality_issues = upgradedTables.ngo_data_quality_issues || [];
    upgradedTables.ngo_report_snapshots = upgradedTables.ngo_report_snapshots || [];
    upgradedTables.ngo_donor_access_grants = upgradedTables.ngo_donor_access_grants || [];

    // 3. schema_migrations
    const now = new Date().toISOString();
    const existingMigrations = new Set(upgradedTables.schema_migrations.map((m: {name: string}) => m.name));
    if (!existingMigrations.has('012-dedicated-workspace.sql')) {
      upgradedTables.schema_migrations.push({name: '012-dedicated-workspace.sql', applied_at: now});
    }
    if (!existingMigrations.has('013-savings-group-roles-and-expenses.sql')) {
      upgradedTables.schema_migrations.push({name: '013-savings-group-roles-and-expenses.sql', applied_at: now});
    }
    if (!existingMigrations.has('014-cooperative-management.sql')) {
      upgradedTables.schema_migrations.push({name: '014-cooperative-management.sql', applied_at: now});
    }
    if (!existingMigrations.has('015-fundraising-platform.sql')) {
      upgradedTables.schema_migrations.push({name: '015-fundraising-platform.sql', applied_at: now});
    }
    if (!existingMigrations.has('016-ngo-impact-platform.sql')) {
      upgradedTables.schema_migrations.push({name: '016-ngo-impact-platform.sql', applied_at: now});
    }
    upgradedTables.schema_migrations.sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name));

    const upgradedPayload = JSON.stringify({
      schema: raw.schema,
      tables: upgradedTables
    });

    console.log('Verifying upgraded snapshot format with parseDemoLogicalSnapshot...');
    parseDemoLogicalSnapshot(upgradedPayload);
    console.log('Validation passed.');

    console.log('Verifying restore and capture against fresh migrated PGlite instance...');
    const testPg = new PGlite();
    await testPg.waitReady;
    const testDb = wrap(testPg);
    let capturedPayload: string;
    try {
      await migrate(testDb);
      await restoreDemoLogicalSnapshot(testDb, upgradedPayload);
      capturedPayload = await testDb.transaction(tx => captureDemoLogicalSnapshot(tx));
      console.log('Restore and capture verified successfully!');
    } finally {
      await testPg.close();
    }

    const nextSlot = currentEnvelope.slot === 'A' ? 'B' : 'A';
    const nextRevision = (BigInt(currentEnvelope.revision) + 1n).toString();
    console.log(`Writing upgraded master snapshot to slot ${nextSlot}, revision ${nextRevision}...`);

    await guard.beforeWrite();
    await transport.write(nextSlot, nextRevision, capturedPayload);
    console.log('Write to Google Sheets complete. Verifying read-back...');

    const readBack = await transport.read();
    if (!readBack || readBack.slot !== nextSlot || readBack.revision !== nextRevision) {
      throw new Error('Read-back verification failed!');
    }
    await guard.afterCommit();
    console.log('Successfully upgraded demo master snapshot in Google Sheets to revision', nextRevision);
  } finally {
    await release();
  }
}

main().catch(error => {
  console.error('Upgrade failed:', error);
  process.exitCode = 1;
});
