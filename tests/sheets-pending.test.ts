import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import type {Database, Sql} from '../src/server/db';
import {processPendingSheetDeliveries} from '../src/server/sheets/pending';

test('retries failures with scoped backoff and continues to other organizations', async () => {
  const pg = new PGlite(); await pg.waitReady;
  const db: Database = {query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)} as Sql))};
  try {
    await db.exec(`CREATE TABLE organization_sheet_outbox(tenant_id text,org_id text,desired_revision bigint,delivered_revision bigint,status text,next_attempt_at timestamptz,attempt_count integer,last_error_code text,updated_at timestamptz);
      INSERT INTO organization_sheet_outbox VALUES('tenant-a','group-a',1,0,'pending',now(),0,NULL,now()),('tenant-b','group-b',1,0,'pending',now(),0,NULL,now());`);
    const calls: string[] = [];
    await processPendingSheetDeliveries(db, async (tenant,org) => {
      calls.push(`${tenant}/${org}`);
      if (tenant === 'tenant-a') throw new Error('secret provider error must not be stored');
      await db.query("UPDATE organization_sheet_outbox SET delivered_revision=desired_revision,status='synced' WHERE tenant_id=$1 AND org_id=$2",[tenant,org]);
    });
    assert.deepEqual(calls,['tenant-a/group-a','tenant-b/group-b']);
    const {rows} = await db.query<{tenant_id:string;status:string;last_error_code:string|null;attempt_count:number;future:boolean}>("SELECT tenant_id,status,last_error_code,attempt_count,next_attempt_at>now() AS future FROM organization_sheet_outbox ORDER BY tenant_id");
    assert.equal(rows[0].last_error_code,'connection'); assert.equal(rows[0].attempt_count,1); assert.equal(rows[0].future,true);
    assert.equal(rows[1].status,'synced'); assert.equal(rows[1].last_error_code,null);
    assert.doesNotMatch(JSON.stringify(rows),/secret provider/);
    const retried: string[] = [];
    await processPendingSheetDeliveries(db, async tenant => {retried.push(tenant);});
    assert.deepEqual(retried,[]);
  } finally { await pg.close(); }
});
