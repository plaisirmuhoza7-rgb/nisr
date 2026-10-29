import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database,Sql} from '../src/server/db';
import {availablePersonalSheetOrganizations,choosePersonalSheetDestination,clearPersonalSheetDestination} from '../src/server/sheets/personal-destinations';
import {organizationSheetStatus} from '../src/server/sheets/status';
import {authorizeOrganizationDelivery} from '../src/server/sheets/authorization';

let pg:PGlite,db:Database;
const alice={tenantId:'personal-a',userId:'alice'},bob={tenantId:'personal-a',userId:'bob'};
const revision=async(org:string,tenant='personal-a')=>BigInt(String((await db.query('SELECT desired_revision FROM organization_sheet_outbox WHERE tenant_id=$1 AND org_id=$2',[tenant,org])).rows[0].desired_revision));
const choice=async(user='alice')=>(await db.query('SELECT org_id FROM personal_sheet_destinations WHERE user_id=$1',[user])).rows[0]?.org_id;
before(async()=>{
 pg=new PGlite();await pg.waitReady;
 db={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)} as Sql))};
 for(const name of ['001-identity','002-finance','003-firebase-accounts','004-dual-savings-groups','005-workspace-onboarding','006-google-sheets-bindings','007-organization-sheet-outbox','008-personal-sheet-destinations','009-sheet-delivery-retries'])await db.exec(await readFile(`migrations/${name}.sql`,'utf8'));
 for(const tenant of ['personal-a','personal-b']){
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenant]);
  for(const org of ['group-one','group-two','group-unbound']){
   await db.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,savings_model) VALUES($1,$2,$2,'group','ACCUMULATING')",[tenant,org]);
   if(org!=='group-unbound')await db.query('INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES($1,$2,$3)',[tenant,org,`sheet_${tenant}_${org}`]);
  }
 }
 for(const user of ['alice','bob','empty','other']){
  const tenant=user==='other'?'personal-b':'personal-a';
  await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$1,$2,'SECRET','member')",[user,`${user}@private.invalid`]);
  await db.query('INSERT INTO account_profiles(user_id,tenant_id) VALUES($1,$2)',[user,tenant]);
  const orgs=user==='alice'?['group-one','group-two','group-unbound']:user==='empty'?[]:['group-one'];
  for(const org of orgs)await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'member')",[tenant,user,org]);
 }
});
after(async()=>{await pg?.close();});

test('available choices disclose only owner memberships and bound organizations, never spreadsheet IDs',async()=>{
 const list=await availablePersonalSheetOrganizations(db,alice);
 assert.deepEqual(list,[{orgId:'group-one',name:'group-one',selected:false,syncStatus:'pending'},{orgId:'group-two',name:'group-two',selected:false,syncStatus:'pending'}]);
 assert.deepEqual(await availablePersonalSheetOrganizations(db,bob),[{orgId:'group-one',name:'group-one',selected:false,syncStatus:'pending'}]);
 assert.deepEqual(await availablePersonalSheetOrganizations(db,{tenantId:'personal-a',userId:'empty'}),[]);
 await assert.rejects(availablePersonalSheetOrganizations(db,{...alice,tenantId:'personal-b'}));
});

test('choices fail closed for nonmembership, unbound organizations, empty accounts and mismatched tenants',async()=>{
 await assert.rejects(choosePersonalSheetDestination(db,bob,'group-two'));
 await assert.rejects(choosePersonalSheetDestination(db,alice,'group-unbound'));
 await assert.rejects(choosePersonalSheetDestination(db,{tenantId:'personal-a',userId:'empty'},'group-one'));
 await assert.rejects(choosePersonalSheetDestination(db,{...alice,tenantId:'personal-b'},'group-one'));
 assert.equal(await choice(),undefined);
});

test('one choice per person; changing choice queues both old and new and retry is idempotent',async()=>{
 await choosePersonalSheetDestination(db,alice,'group-one');await choosePersonalSheetDestination(db,bob,'group-one');
 const one=await revision('group-one'),two=await revision('group-two'),other=await revision('group-one','personal-b');
 await choosePersonalSheetDestination(db,alice,'group-two');
 assert.equal(await choice(),'group-two');assert.equal(await choice('bob'),'group-one');
 assert.equal(await revision('group-one'),one+1n);assert.equal(await revision('group-two'),two+1n);assert.equal(await revision('group-one','personal-b'),other);
 await choosePersonalSheetDestination(db,alice,'group-two');assert.equal(await revision('group-two'),two+1n);
 const list=await availablePersonalSheetOrganizations(db,alice);assert.equal(list.filter(x=>x.selected).length,1);
});

test('submitted goal insert update delete queue only the selected destination and rollback queues nothing',async()=>{
 const one=await revision('group-one'),two=await revision('group-two');
 await db.query("INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES('alice-goal','personal-a','alice','PRIVATE goal',100,0,'2030-01-01')");
 await db.query("UPDATE goals SET saved=1 WHERE id='alice-goal'");
 await db.query("DELETE FROM goals WHERE id='alice-goal'");
 assert.equal(await revision('group-one'),one);assert.equal(await revision('group-two'),two+3n);
 await assert.rejects(db.transaction(async tx=>{
  await tx.query("INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES('rolled-goal','personal-a','alice','PRIVATE',100,0,'2030-01-01')");throw new Error('rollback goal');
 }),/rollback goal/);
 assert.equal(await revision('group-two'),two+3n);
 await db.query("INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES('empty-goal','personal-a','empty','PRIVATE',100,0,'2030-01-01')");
 assert.equal(await revision('group-one'),one);assert.equal(await revision('group-two'),two+3n);
});

test('rollback restores choice and queue; membership deletion revokes and dirties prior target',async()=>{
 const before=await revision('group-two');
 await assert.rejects(db.transaction(async tx=>{
  await tx.query("DELETE FROM personal_sheet_destinations WHERE user_id='alice'");throw new Error('rollback choice');
 }),/rollback choice/);
 assert.equal(await choice(),'group-two');assert.equal(await revision('group-two'),before);
 await db.query("DELETE FROM memberships WHERE tenant_id='personal-a' AND user_id='alice' AND org_id='group-two'");
 assert.equal(await choice(),undefined);assert.ok(await revision('group-two')>before);
 await assert.rejects(choosePersonalSheetDestination(db,alice,'group-two'));
});

test('clear affects only owner and disabled accounts cannot list choose or clear',async()=>{
 await clearPersonalSheetDestination(db,alice);assert.equal(await choice('bob'),'group-one');
 await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id='alice'");
 await assert.rejects(availablePersonalSheetOrganizations(db,alice));
 await assert.rejects(choosePersonalSheetDestination(db,alice,'group-one'));
 await assert.rejects(clearPersonalSheetDestination(db,alice));
 const before=await revision('group-one');
 await clearPersonalSheetDestination(db,bob);assert.equal(await choice('bob'),undefined);
 assert.equal(await revision('group-one'),before+1n);
});

test('database constraints enforce profile tenant, membership and binding even outside the service',async()=>{
 await assert.rejects(db.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('personal-b','bob','group-one')"),/foreign key/i);
 await assert.rejects(db.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('personal-a','empty','group-one')"),/foreign key/i);
 await assert.rejects(db.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('personal-a','alice','group-unbound')"),/foreign key/i);
});

test('consented account edits and profile disable queue removal without tracking credentials',async()=>{
 await choosePersonalSheetDestination(db,bob,'group-one');
 const before=await revision('group-one');
 await db.query("UPDATE app_users SET name='Updated name' WHERE id='bob'");
 assert.equal(await revision('group-one'),before+1n);
 await db.query("UPDATE app_users SET password_hash='private change' WHERE id='bob'");
 assert.equal(await revision('group-one'),before+1n);
 await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id='bob'");
 assert.equal(await revision('group-one'),before+2n);
});

test('sheet status is visible only to an active member of the exact tenant and organization',async()=>{
 const active={tenantId:'personal-a',userId:'empty',role:'member' as const};
 await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('personal-a','empty','group-unbound','member')");
 assert.equal(await organizationSheetStatus(db,active,'group-unbound'),'not_connected');
 await assert.rejects(organizationSheetStatus(db,active,'group-one'),/cannot view/);
 await assert.rejects(organizationSheetStatus(db,{...active,tenantId:'personal-b'},'group-one'),/cannot view/);
 await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id='empty'");
 await assert.rejects(organizationSheetStatus(db,active,'group-unbound'),/cannot view/);
});

test('automatic delivery requires an active authorized administrator of the exact organization',async()=>{
 await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES('sheet-admin','Admin','sheet-admin@example.invalid','SECRET','member')");
 await db.query("INSERT INTO account_profiles(user_id,tenant_id) VALUES('sheet-admin','personal-a')");
 await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('personal-a','sheet-admin','group-one','president')");
 await db.transaction(tx=>authorizeOrganizationDelivery(tx,'personal-a','group-one'));
 await assert.rejects(db.transaction(tx=>authorizeOrganizationDelivery(tx,'personal-b','group-one')),/no active authorized/);
 await db.query("UPDATE memberships SET role='member' WHERE tenant_id='personal-a' AND org_id='group-one' AND user_id='sheet-admin'");
 await assert.rejects(db.transaction(tx=>authorizeOrganizationDelivery(tx,'personal-a','group-one')),/no active authorized/);
 await db.query("UPDATE memberships SET role='treasurer' WHERE tenant_id='personal-a' AND org_id='group-one' AND user_id='sheet-admin'");
 await db.transaction(tx=>authorizeOrganizationDelivery(tx,'personal-a','group-one'));
 await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id='sheet-admin'");
 await assert.rejects(db.transaction(tx=>authorizeOrganizationDelivery(tx,'personal-a','group-one')),/no active authorized/);
});
