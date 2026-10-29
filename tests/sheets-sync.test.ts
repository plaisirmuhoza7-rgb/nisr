import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Actor} from '../src/lib/contracts';
import type {Database, Sql} from '../src/server/db';
import {seedFinance} from '../src/server/finance/service';
import {syncSavingsGroupSummary} from '../src/server/sheets/sync';
import type {SheetRangeUpdate} from '../src/server/sheets/validation';

let pg: PGlite;
let db: Database;
let sequence = 0;
before(async () => {
  pg = new PGlite(); await pg.waitReady;
  db = {query:(q,p)=>pg.query(q,p), exec:q=>pg.exec(q), transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)} as Sql))};
  for (const migration of ['001-identity','002-finance','003-firebase-accounts','004-dual-savings-groups','005-workspace-onboarding','006-google-sheets-bindings']) {
    await db.exec(await readFile(`migrations/${migration}.sql`, 'utf8'));
  }
  for (const role of ['member','president','treasurer','cooperative','ngo']) {
    await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$1,$1)', [role,`PRIVATE NAME ${role}`,`${role}@private.invalid`]);
  }
});
after(async () => { await pg?.close(); });

async function fixture() {
  const tenantId = `sheet-sync-${++sequence}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)', [tenantId]);
  await seedFinance(db, tenantId);
  const actors = {} as Record<'president'|'treasurer'|'member', Actor>;
  for (const role of ['president','treasurer','member'] as const) {
    const userId = `${tenantId}-${role}`;
    await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$1,$4)',[userId,`PRIVATE ${userId}`,`${userId}@private.invalid`,role]);
    await db.query('INSERT INTO account_profiles(user_id,tenant_id) VALUES($1,$2)',[userId,tenantId]);
    await db.query('INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4)',[tenantId,userId,'group-ubumwe',role]);
    actors[role] = {tenantId,userId,role};
  }
  const spreadsheetId = `sheet_for_${tenantId}`;
  await db.query('INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES($1,$2,$3)',[tenantId,'group-ubumwe',spreadsheetId]);
  return {tenantId,spreadsheetId,...actors};
}
function recorder() {
  const calls: {id:string;updates:SheetRangeUpdate[];allowed:string[]}[] = [];
  return {calls,write:async(id:string,updates:SheetRangeUpdate[],allowed:string[])=>{calls.push(structuredClone({id,updates,allowed}));}};
}

test('president and treasurer publish deterministic synthetic aggregates without private records', async () => {
  const f = await fixture(), writer = recorder();
  await syncSavingsGroupSummary(db,f.president,'group-ubumwe',writer.write);
  await syncSavingsGroupSummary(db,f.treasurer,'group-ubumwe',writer.write);
  assert.equal(writer.calls.length,2);
  assert.deepEqual(writer.calls[0],writer.calls[1]);
  const call = writer.calls[0];
  assert.equal(call.id,f.spreadsheetId);
  assert.deepEqual(call.allowed,["'HURIZA setup'!A2","'HURIZA setup'!A5:B14"]);
  assert.deepEqual(call.updates.map(u=>u.range),call.allowed);
  assert.deepEqual(call.updates[1].values,[
    ['SIMULATED — fictional example; not evidence of real-world impact',''],
    ['Savings group aggregate','Value'],['Members',24],['Contribution amount (RWF)',10000],
    ['Contributions (RWF)',800000],['Cash (RWF)',5000000],['Reserve (RWF)',1000000],
    ['Outstanding loans (RWF)',150000],['Pending (RWF)',0],['Distributable (RWF)',3850000],
  ]);
  assert.match(JSON.stringify(call.updates),/Simulated group summary/);
  assert.doesNotMatch(JSON.stringify(call.updates),/PRIVATE|private\.invalid|seed-|loanId|userId|journal|reference|invite/i);
});

test('tenant and organization scope never select another binding or group', async () => {
  const a=await fixture(), b=await fixture(), writer=recorder();
  await assert.rejects(syncSavingsGroupSummary(db,{...a.president,tenantId:b.tenantId},'group-ubumwe',writer.write));
  await assert.rejects(syncSavingsGroupSummary(db,a.president,'group-hope',writer.write));
  await assert.rejects(syncSavingsGroupSummary(db,a.president,'coop-imena',writer.write));
  assert.equal(writer.calls.length,0);
  await syncSavingsGroupSummary(db,b.president,'group-ubumwe',writer.write);
  assert.equal(writer.calls[0].id,b.spreadsheetId);
  await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,'group-hope','president')",[a.tenantId,a.president.userId]);
  await db.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES($1,'group-hope',$2)",[a.tenantId,`${a.spreadsheetId}_hope`]);
  await syncSavingsGroupSummary(db,a.president,'group-hope',writer.write);
  assert.equal(writer.calls[1].id,`${a.spreadsheetId}_hope`);
  assert.deepEqual(writer.calls[1].updates[1].values.find(row=>row[0]==='Cash (RWF)'),['Cash (RWF)',2400000]);
  assert.deepEqual(writer.calls[1].updates[1].values.find(row=>row[0]==='Contributions (RWF)'),['Contributions (RWF)',1200000]);
});

test('member, disabled and revoked accounts cannot write', async () => {
  const f=await fixture(), writer=recorder();
  await assert.rejects(syncSavingsGroupSummary(db,f.member,'group-ubumwe',writer.write));
  await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id=$1",[f.president.userId]);
  await assert.rejects(syncSavingsGroupSummary(db,f.president,'group-ubumwe',writer.write));
  await db.query('DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2',[f.tenantId,f.treasurer.userId]);
  await assert.rejects(syncSavingsGroupSummary(db,f.treasurer,'group-ubumwe',writer.write));
  assert.equal(writer.calls.length,0);
});

test('an authorized group with no binding cannot trigger a spreadsheet write', async () => {
  const f=await fixture(), writer=recorder();
  await db.query('DELETE FROM organization_sheet_bindings WHERE tenant_id=$1',[f.tenantId]);
  await assert.rejects(syncSavingsGroupSummary(db,f.president,'group-ubumwe',writer.write));
  assert.equal(writer.calls.length,0);
});

test('writer failure preserves all tenant journal, payment and audit records', async () => {
  const f=await fixture();
  const snapshot=async()=>{
    const records: Record<string,unknown> = {};
    for (const table of ['finance_entries','finance_lines','finance_payments','finance_loans','finance_audit']) {
      records[table]=(await db.query(`SELECT * FROM ${table} WHERE tenant_id=$1 ORDER BY id`,[f.tenantId])).rows;
    }
    return records;
  };
  const before=await snapshot();
  let calls=0;
  await assert.rejects(syncSavingsGroupSummary(db,f.president,'group-ubumwe',async()=>{calls++;throw new Error('simulated writer failure');}),/simulated writer failure/);
  assert.equal(calls,1);
  assert.deepEqual(await snapshot(),before);
});
