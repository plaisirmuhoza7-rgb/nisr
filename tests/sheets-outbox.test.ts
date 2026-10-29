import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

let db:PGlite;
const row=async(tenant='outbox-a',org='group-one')=>(await db.query<{desired_revision:bigint;delivered_revision:bigint;status:string}>('SELECT desired_revision,delivered_revision,status FROM organization_sheet_outbox WHERE tenant_id=$1 AND org_id=$2',[tenant,org])).rows[0];
const revision=async(tenant='outbox-a',org='group-one')=>String((await row(tenant,org))?.desired_revision);
before(async()=>{
 db=new PGlite();await db.waitReady;
 for(const name of ['001-identity','002-finance','003-firebase-accounts','004-dual-savings-groups','005-workspace-onboarding','006-google-sheets-bindings'])await db.exec(await readFile(`migrations/${name}.sql`,'utf8'));
 for(const tenant of ['outbox-a','outbox-b']){
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenant]);
  for(const org of ['group-one','group-two'])await db.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,savings_model) VALUES($1,$2,$2,'group','ACCUMULATING')",[tenant,org]);
 }
 await db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('outbox-b','group-one','spreadsheet_existing')");
 await db.exec(await readFile('migrations/007-organization-sheet-outbox.sql','utf8'));
});
after(async()=>{await db?.close();});

test('migration backfills existing bindings and a new binding atomically queues its initial revision',async()=>{
 assert.equal(await revision('outbox-b'),'1');
 assert.equal(await row(),undefined);
 await db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('outbox-a','group-one','spreadsheet_new')");
 const state=await row();assert.equal(String(state.desired_revision),'1');assert.equal(String(state.delivered_revision),'0');assert.equal(state.status,'pending');
 await assert.rejects(db.transaction(async tx=>{
  await tx.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('outbox-a','group-two','spreadsheet_rollback')");
  throw new Error('rollback bind');
 }),/rollback bind/);
 assert.equal(await row('outbox-a','group-two'),undefined);
});

test('updates increment only the exact bound tenant and organization; rollback leaves revision untouched',async()=>{
 const before=BigInt(await revision()),other=await revision('outbox-b');
 await db.query("UPDATE finance_orgs SET name='Changed' WHERE tenant_id='outbox-a' AND org_id='group-one'");
 assert.equal(await revision(),String(before+1n));assert.equal(await revision('outbox-b'),other);
 await db.query("UPDATE finance_orgs SET name='Unbound' WHERE org_id='group-two'");
 assert.equal(await row('outbox-a','group-two'),undefined);assert.equal(await row('outbox-b','group-two'),undefined);
 await assert.rejects(db.transaction(async tx=>{
  await tx.query("UPDATE finance_orgs SET name='Rolled back' WHERE tenant_id='outbox-a' AND org_id='group-one'");throw new Error('rollback change');
 }),/rollback change/);
 assert.equal(await revision(),String(before+1n));
});

test('membership insert update delete queue metadata only, and requeue preserves delivered revision',async()=>{
 await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES('outbox-person','PRIVATE','private@example.invalid','SECRET','member')");
 await db.query("UPDATE organization_sheet_outbox SET delivered_revision=desired_revision,status='synced' WHERE tenant_id='outbox-a' AND org_id='group-one'");
 const before=BigInt(await revision());
 await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('outbox-a','outbox-person','group-one','member')");
 await db.query("UPDATE memberships SET role='treasurer' WHERE user_id='outbox-person'");
 await db.query("DELETE FROM memberships WHERE user_id='outbox-person'");
 assert.equal(await revision(),String(before+3n));assert.equal(String((await row()).delivered_revision),String(before));assert.equal((await row()).status,'pending');
 const columns=(await db.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_name='organization_sheet_outbox' ORDER BY ordinal_position")).rows.map(r=>r.column_name);
 assert.deepEqual(columns,['tenant_id','org_id','desired_revision','delivered_revision','status','updated_at']);
});

test('scope-moving updates enqueue old and new bindings without cross-tenant leakage',async()=>{
 await db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES('outbox-a','group-two','spreadsheet_second')");
 await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('outbox-a','outbox-person','group-one','member')");
 const first=BigInt(await revision()),second=BigInt(await revision('outbox-a','group-two')),other=await revision('outbox-b');
 await db.query("UPDATE memberships SET org_id='group-two' WHERE user_id='outbox-person'");
 assert.equal(await revision(),String(first+1n));assert.equal(await revision('outbox-a','group-two'),String(second+1n));assert.equal(await revision('outbox-b'),other);
});

test('all required tables have transactional INSERT UPDATE DELETE triggers; no secret tables are watched',async()=>{
 const triggers=(await db.query<{table_name:string;operation:string}>(`SELECT c.relname AS table_name,t.tgtype::int AS operation FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='organization_sheet_changed' ORDER BY c.relname`)).rows;
 assert.deepEqual(triggers.map(t=>t.table_name),['finance_audit','finance_campaigns','finance_entries','finance_expenses','finance_lines','finance_loans','finance_orgs','finance_payments','finance_proposals','finance_votes','interventions','memberships','savings_cycles','savings_group_policies','savings_obligations','savings_rotation_rounds']);
 for(const trigger of triggers)assert.equal(Number(trigger.operation),29); // ROW + INSERT + DELETE + UPDATE; AFTER.
 await assert.rejects(db.query("INSERT INTO organization_sheet_outbox(tenant_id,org_id) VALUES('missing','group-missing')"),/foreign key/i);
});

test('multiple committed updates coalesce without losing revisions',async()=>{
 const before=BigInt(await revision());
 await Promise.all(Array.from({length:8},()=>db.transaction(async tx=>{
  await tx.query("UPDATE finance_orgs SET member_count=member_count+1 WHERE tenant_id='outbox-a' AND org_id='group-one'");
 })));
 assert.equal(await revision(),String(before+8n));
 assert.equal((await db.query("SELECT * FROM organization_sheet_outbox WHERE tenant_id='outbox-a' AND org_id='group-one'")).rows.length,1);
});

test('balanced journal inserts enqueue while immutability and failed-post rollback remain enforced',async()=>{
 const before=BigInt(await revision());
 await db.transaction(async tx=>{
  await tx.query("INSERT INTO finance_entries(id,tenant_id,org_id,description,reference) VALUES('outbox-entry','outbox-a','group-one','SIMULATED test','outbox-reference')");
  await tx.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES('outbox-debit','outbox-entry','outbox-a','group-one','cash',100,0),('outbox-credit','outbox-entry','outbox-a','group-one','capital',0,100)");
 });
 assert.equal(await revision(),String(before+3n));
 await assert.rejects(db.query("UPDATE finance_entries SET description='forbidden' WHERE id='outbox-entry'"),/immutable/i);
 await assert.rejects(db.transaction(async tx=>{
  await tx.query("INSERT INTO finance_entries(id,tenant_id,org_id,description,reference) VALUES('outbox-invalid','outbox-a','group-one','SIMULATED invalid','outbox-invalid')");
 }),/balanced/i);
 assert.equal(await revision(),String(before+3n));
 assert.equal((await db.query("SELECT id FROM finance_entries WHERE id='outbox-invalid'")).rows.length,0);
});
