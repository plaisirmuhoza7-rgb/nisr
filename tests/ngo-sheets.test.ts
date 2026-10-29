import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database,Sql} from '../src/server/db';
import {bindSpreadsheetForOrganization} from '../src/server/sheets/bindings';
import {authorizeOrganizationDelivery} from '../src/server/sheets/authorization';
import {loadOrganizationSnapshot} from '../src/server/sheets/data-snapshot';
import {availablePersonalSheetOrganizations,choosePersonalSheetDestination} from '../src/server/sheets/personal-destinations';
import {deliverOrganizationSheet} from '../src/server/sheets/worker';

let pg:PGlite,db:Database;
const owner={tenantId:'ngo-a',userId:'ngo-person-a'};
const rev=async()=>BigInt(String((await db.query("SELECT desired_revision FROM organization_sheet_outbox WHERE tenant_id='ngo-a' AND org_id='ngo-imizi'")).rows[0].desired_revision));
before(async()=>{
 pg=new PGlite();await pg.waitReady;
 db={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)} as Sql))};
 for(const name of ['001-identity','002-finance','003-firebase-accounts','004-dual-savings-groups','005-workspace-onboarding','006-google-sheets-bindings','007-organization-sheet-outbox','008-personal-sheet-destinations','009-sheet-delivery-retries','010-savings-group-administrator-label','011-ngo-sheet-bindings'])await db.exec(await readFile(`migrations/${name}.sql`,'utf8'));
 for(const tenant of ['ngo-a','ngo-b']){
  const user=`ngo-person-${tenant.slice(-1)}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenant]);
  await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,'PRIVATE NAME',$2,'SECRET','ngo')",[user,`${user}@private.invalid`]);
  await db.query('INSERT INTO account_profiles(user_id,tenant_id) VALUES($1,$2)',[user,tenant]);
  await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,'ngo-imizi','ngo')",[tenant,user]);
  await db.query("INSERT INTO interventions(id,tenant_id,org_id,title) VALUES($1,$2,'ngo-imizi',$3)",[`${tenant}-intervention`,tenant,`SUBMITTED ${tenant} intervention`]);
  await db.query("INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES($1,$2,$3,'PRIVATE GOAL',100,0,'2030-01-01')",[`${tenant}-goal`,tenant,user]);
 }
});
after(async()=>{await pg?.close();});

test('NGO binds without financial organization; exact tenant snapshots contain only interventions',async()=>{
 await bindSpreadsheetForOrganization(db,'ngo-a','ngo-imizi','spreadsheet_ngo_a');
 await bindSpreadsheetForOrganization(db,'ngo-b','ngo-imizi','spreadsheet_ngo_b');
 assert.equal((await db.query("SELECT 1 FROM finance_orgs WHERE org_id='ngo-imizi'")).rows.length,0);
 const snapshot=await loadOrganizationSnapshot(db,'ngo-a','ngo-imizi');
 assert.equal(snapshot!.spreadsheetId,'spreadsheet_ngo_a');
 assert.match(JSON.stringify(snapshot!.rows),/SUBMITTED ngo-a intervention/);
 assert.doesNotMatch(JSON.stringify(snapshot!.rows),/ngo-b|PRIVATE|SECRET|ngo-person|memberships|personal_accounts|goals/);
 assert.ok(snapshot!.rows.slice(3).every(row=>row[0]==='interventions'));
 await assert.rejects(bindSpreadsheetForOrganization(db,'ngo-a','ngo-imizi','spreadsheet_ngo_b'));
});

test('conditional foreign key still rejects every nonexistent non-NGO financial destination',async()=>{
 await assert.rejects(db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('ngo-a','arbitrary-missing','spreadsheet_missing')"),/foreign key/i);
 await db.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind) VALUES('ngo-a','fund-real','Real fund','fund')");
 await bindSpreadsheetForOrganization(db,'ngo-a','fund-real','spreadsheet_real_fund');
 await assert.rejects(db.query("DELETE FROM finance_orgs WHERE tenant_id='ngo-a' AND org_id='fund-real'"),/foreign key/i);
 await assert.rejects(db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('ngo-b','fund-real','spreadsheet_wrong_tenant')"),/foreign key/i);
});

test('NGO destinations cannot receive opted personal records in service, UI options or database',async()=>{
 assert.deepEqual(await availablePersonalSheetOrganizations(db,owner),[]);
 await assert.rejects(choosePersonalSheetDestination(db,owner,'ngo-imizi'));
 await assert.rejects(db.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('ngo-a','ngo-person-a','ngo-imizi')"),/check constraint/i);
});

test('disabled or cross-tenant profiles cannot bind or deliver; status changes requeue the exact organizations',async()=>{
 let writes=0;
 const deliver=()=>deliverOrganizationSheet(db,'ngo-a','ngo-imizi',{authorizeDestination:authorizeOrganizationDelivery,loadSnapshot:loadOrganizationSnapshot,writeSnapshot:async()=>{writes++;}});
 await deliver();assert.equal(writes,1);
 const prior=await rev();
 await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id='ngo-person-a'");
 assert.equal(await rev(),prior+1n);
 await assert.rejects(deliver(),/active authorized/);assert.equal(writes,1);
 await assert.rejects(bindSpreadsheetForOrganization(db,'ngo-a','ngo-imizi','spreadsheet_ngo_a'));
 await assert.rejects(db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('ngo-a','ngo-imizi','spreadsheet_disabled')"),/active administrator/);
 await db.query("UPDATE account_profiles SET status='active' WHERE user_id='ngo-person-a'");
 await deliver();assert.equal(writes,2);
 await db.query("INSERT INTO demo_tenants(id) VALUES('ngo-empty')");
 await assert.rejects(db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('ngo-empty','ngo-imizi','spreadsheet_ngo_empty')"),/active administrator/);
});

test('revoking exact NGO membership blocks delivery despite another tenant active NGO membership',async()=>{
 await db.query("DELETE FROM memberships WHERE tenant_id='ngo-a' AND user_id='ngo-person-a' AND org_id='ngo-imizi'");
 await assert.rejects(db.transaction(tx=>authorizeOrganizationDelivery(tx,'ngo-a','ngo-imizi')),/active authorized/);
 await db.transaction(tx=>authorizeOrganizationDelivery(tx,'ngo-b','ngo-imizi'));
 await assert.rejects(bindSpreadsheetForOrganization(db,'ngo-a','ngo-imizi','spreadsheet_ngo_a'));
});

test('NGO binding retains its tenant FK after profile and membership removal',async()=>{
 await db.query("INSERT INTO demo_tenants(id) VALUES('ngo-orphan-test')");
 await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES('ngo-orphan-admin','PRIVATE','orphan@private.invalid','SECRET','ngo')");
 await db.query("INSERT INTO account_profiles(user_id,tenant_id) VALUES('ngo-orphan-admin','ngo-orphan-test')");
 await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('ngo-orphan-test','ngo-orphan-admin','ngo-imizi','ngo')");
 await bindSpreadsheetForOrganization(db,'ngo-orphan-test','ngo-imizi','spreadsheet_orphan_test');
 await db.query("DELETE FROM memberships WHERE tenant_id='ngo-orphan-test'");
 await db.query("DELETE FROM account_profiles WHERE tenant_id='ngo-orphan-test'");
 await assert.rejects(db.query("DELETE FROM demo_tenants WHERE id='ngo-orphan-test'"),/organization_sheet_tenant_fk/);
});

test('NGO projection excludes personal and member data even if an old consent row bypasses the new check',async()=>{
 await db.transaction(async tx=>{
  await tx.exec('ALTER TABLE personal_sheet_destinations DROP CONSTRAINT personal_sheet_financial_destination_only');
  await tx.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('ngo-b','ngo-person-b','ngo-imizi')");
  const snapshot=await loadOrganizationSnapshot(tx,'ngo-b','ngo-imizi');
  assert.doesNotMatch(JSON.stringify(snapshot!.rows),/PRIVATE|ngo-person|personal_accounts|memberships|goals|private.invalid/);
  assert.ok(snapshot!.rows.slice(3).every(row=>row[0]==='interventions'));
  await tx.query("DELETE FROM personal_sheet_destinations WHERE tenant_id='ngo-b'");
  await tx.exec("ALTER TABLE personal_sheet_destinations ADD CONSTRAINT personal_sheet_financial_destination_only CHECK(org_id<>'ngo-imizi')");
 });
});

test('a membership with a mismatched profile tenant or non-NGO account role cannot authorize NGO binding',async()=>{
 await db.query("INSERT INTO demo_tenants(id) VALUES('ngo-mismatch')");
 await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('ngo-mismatch','ngo-person-b','ngo-imizi','ngo')");
 await assert.rejects(bindSpreadsheetForOrganization(db,'ngo-mismatch','ngo-imizi','spreadsheet_mismatch'));
 await assert.rejects(db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('ngo-mismatch','ngo-imizi','spreadsheet_mismatch')"),/active administrator/);
 await db.query("UPDATE app_users SET role='member' WHERE id='ngo-person-b'");
 await assert.rejects(db.transaction(tx=>authorizeOrganizationDelivery(tx,'ngo-b','ngo-imizi')),/active authorized/);
 await assert.rejects(db.query("UPDATE organization_sheet_bindings SET spreadsheet_id=spreadsheet_id WHERE tenant_id='ngo-b' AND org_id='ngo-imizi'"),/active administrator/);
});
