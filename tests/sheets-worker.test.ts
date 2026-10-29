import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import type {Database, Sql} from '../src/server/db';
import {deliverOrganizationSheet, type OrganizationSheetSnapshot} from '../src/server/sheets/worker';
import type {SheetRangeUpdate} from '../src/server/sheets/validation';

async function fixture() {
  const pg = new PGlite(); await pg.waitReady;
  await pg.exec(`CREATE TABLE organization_sheet_bindings(tenant_id text,org_id text,spreadsheet_id text);
    CREATE TABLE organization_sheet_outbox(tenant_id text,org_id text,desired_revision bigint,delivered_revision bigint,status text,updated_at timestamptz,attempt_count integer DEFAULT 0,last_error_code text,next_attempt_at timestamptz DEFAULT now());
    INSERT INTO organization_sheet_bindings VALUES('tenant','org','sheet');
    INSERT INTO organization_sheet_outbox(tenant_id,org_id,desired_revision,delivered_revision,status,updated_at) VALUES('tenant','org',9007199254740993,0,'pending',now());`);
  const statements: string[] = [];
  let failAck = false;
  const wrap = (tx: Sql): Sql => ({exec: sql => {statements.push(sql);return tx.exec(sql);},
    query: async (sql, params) => {statements.push(sql);if (failAck && sql.includes('UPDATE organization_sheet_outbox AS o')) throw new Error('ack unavailable');return tx.query(sql,params);}});
  const db: Database = {...wrap(pg), transaction: fn => pg.transaction(tx => fn(wrap(tx)))};
  const loadSnapshot = async (tx: Sql, tenant: string, org: string): Promise<OrganizationSheetSnapshot | null> => {
    const {rows} = await tx.query<{spreadsheet_id:string;desired_revision:bigint;delivered_revision:bigint}>(`
      SELECT b.spreadsheet_id,o.desired_revision,o.delivered_revision
      FROM organization_sheet_bindings b JOIN organization_sheet_outbox o USING(tenant_id,org_id)
      WHERE b.tenant_id=$1 AND b.org_id=$2`,[tenant,org]);
    return rows[0] ? {spreadsheetId:rows[0].spreadsheet_id,desiredRevision:rows[0].desired_revision,
      deliveredRevision:rows[0].delivered_revision,rows:[['SIMULATED',rows[0].desired_revision.toString()]]} : null;
  };
  const state = async () => (await pg.query<{desired_revision:bigint;delivered_revision:bigint;status:string}>('SELECT * FROM organization_sheet_outbox')).rows[0];
  return {pg,db,loadSnapshot,state,statements,failAck:()=>{failAck=true;},resumeAck:()=>{failAck=false;}};
}

test('full snapshot retry is deterministic, exact scope and BigInt revisions survive delivery',async()=>{
  const f=await fixture(); const writes:SheetRangeUpdate[]=[];
  try {
    const dependencies={authorizeDestination:async()=>{},loadSnapshot:f.loadSnapshot,writeSnapshot:async (_id:string,update:SheetRangeUpdate)=>{writes.push(update);}};
    f.failAck(); await assert.rejects(deliverOrganizationSheet(f.db,'tenant','org',dependencies),/ack unavailable/);
    assert.equal((await f.state()).status,'pending'); f.resumeAck();
    assert.deepEqual(await deliverOrganizationSheet(f.db,'tenant','org',dependencies),{status:'synced',revision:'9007199254740993'});
    assert.deepEqual(writes[0],writes[1]); assert.equal(writes[0].values.length,2000);
    assert.deepEqual(await deliverOrganizationSheet(f.db,'tenant','org',dependencies),{status:'idle'});
    assert.deepEqual(await deliverOrganizationSheet(f.db,'other','org',dependencies),{status:'idle'});
    assert.equal(writes.length,2);
    assert.ok(f.statements.some(sql=>sql.includes('READ COMMITTED')));
    assert.ok(f.statements.some(sql=>sql.includes('pg_advisory_xact_lock(42862027')));
    assert.ok(f.statements.every(sql=>! /FOR\s+(UPDATE|SHARE)/i.test(sql)));
  } finally {await f.pg.close();}
});

test('writer failure propagates and never acknowledges delivery',async()=>{
  const f=await fixture(); try {
    await assert.rejects(deliverOrganizationSheet(f.db,'tenant','org',{authorizeDestination:async()=>{},loadSnapshot:f.loadSnapshot,writeSnapshot:async()=>{throw new Error('provider unavailable');}}),/provider unavailable/);
    assert.equal(String((await f.state()).delivered_revision),'0');
    assert.ok(!f.statements.some(sql=>sql.includes('UPDATE organization_sheet_outbox AS o')));
  } finally {await f.pg.close();}
});

test('a newer desired revision before acknowledgment remains pending',async()=>{
  const f=await fixture(); try {
    // Inject a committed mutation at the transaction boundary after delivery.
    const db:Database={...f.db,transaction:async fn=>{
      const value=await f.db.transaction(fn);
      if (value && typeof value==='object' && 'spreadsheetId' in value) {
        await f.pg.query('UPDATE organization_sheet_outbox SET desired_revision=desired_revision+1');
      }
      return value;
    }};
    const result=await deliverOrganizationSheet(db,'tenant','org',{authorizeDestination:async()=>{},loadSnapshot:f.loadSnapshot,writeSnapshot:async()=>{}});
    assert.equal(result.status,'pending');
    assert.equal(String((await f.state()).delivered_revision),'9007199254740993');
    assert.equal(String((await f.state()).desired_revision),'9007199254740994');
  } finally {await f.pg.close();}
});

test('concurrent local deliveries never overlap complete snapshot writes',async()=>{
  const f=await fixture();let active=0,maxActive=0;try {
    const dependencies={authorizeDestination:async()=>{},loadSnapshot:f.loadSnapshot,writeSnapshot:async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(resolve=>setTimeout(resolve,5));active--;}};
    await Promise.all([deliverOrganizationSheet(f.db,'tenant','org',dependencies),deliverOrganizationSheet(f.db,'tenant','org',dependencies)]);
    assert.equal(maxActive,1);assert.equal((await f.state()).status,'synced');
  } finally {await f.pg.close();}
});
