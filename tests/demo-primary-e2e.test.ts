import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {createDemoMasterTransport,type MasterRequest} from '../src/server/sheets/demo-master-transport';
import {bootstrapDemoPrimary} from '../src/server/sheets/demo-primary-bootstrap';
import {startDemoPrimaryDatabase} from '../src/server/sheets/demo-primary-start';
import {captureDemoLogicalSnapshot,restoreDemoLogicalSnapshot} from '../src/server/sheets/demo-logical-snapshot';
import {createDemoWriteGuard} from '../src/server/sheets/demo-write-guard';

async function fresh(){
  const pg=await PGlite.create();
  for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort()){
    await pg.exec(await readFile(`migrations/${name}`,'utf8'));
    await pg.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
  }
  const db:Database={query:(sql,params)=>pg.query(sql,params),exec:sql=>pg.exec(sql),transaction:fn=>pg.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)})),close:()=>pg.close()};
  return db;
}
function fakeMaster(){
  const grid:unknown[][]=Array.from({length:47},()=>Array<unknown>(11).fill(''));
  const request:MasterRequest=async ({url,method,data})=>{
    if(method==='POST'){
      const update=(data as {data:{range:string;values:unknown[][]}[]}).data[0];
      const start=update.range.includes('G1:K47')?6:0;
      update.values.forEach((row,r)=>row.forEach((cell,c)=>{grid[r][start+c]=cell;}));return {};
    }
    const range=decodeURIComponent(url.split('/values/')[1].split('?')[0]);
    if(range.endsWith('!L1'))return {values:[['HURIZA_ENCRYPTED_DEMO_MASTER_V1']]};
    if(range.endsWith('!A1:K47'))return {values:grid};
    throw Error('Unexpected fake request');
  };
  return {grid,master:createDemoMasterTransport('synthetic_sheet_123',Buffer.alloc(32,51),request)};
}

test('synthetic bootstrap, role data, balanced journal and restart survive encrypted Sheets storage',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'huriza-e2e-'));
  const databases:Database[]=[];
  try{
    const source=await fresh();databases.push(source);
    const {master,grid}=fakeMaster();const guard=createDemoWriteGuard(dir);
    const payload=await source.transaction(captureDemoLogicalSnapshot);
    await bootstrapDemoPrimary({payload,master,guard,verifyRestore:async saved=>{
      const verify=await fresh();databases.push(verify);await restoreDemoLogicalSnapshot(verify,saved);
    }});
    const firstRaw=await fresh();databases.push(firstRaw);
    const db=await startDemoPrimaryDatabase({db:firstRaw,master,guard,capture:captureDemoLogicalSnapshot,restore:restoreDemoLogicalSnapshot});
    await db.transaction(async tx=>{
      await tx.query("INSERT INTO demo_tenants(id) VALUES ('demo')");
      await tx.query("INSERT INTO app_users VALUES('u','Demo user','demo@example.invalid','firebase-managed','treasurer')");
      await tx.query("INSERT INTO account_profiles(user_id,tenant_id) VALUES('u','demo')");
      await tx.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,savings_model) VALUES('demo','org','SIMULATED savings group','group','ACCUMULATING')");
      await tx.query("INSERT INTO memberships VALUES('demo','u','org','treasurer')");
      await tx.query("INSERT INTO goals VALUES('goal','demo','u','Demo goal',10000,1000,'2027-01-01')");
      await tx.query("INSERT INTO finance_entries(id,tenant_id,org_id,description,reference) VALUES('e','demo','org','SIMULATED journal','synthetic-ref')");
      await tx.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES('d','e','demo','org','cash',1000,0),('c','e','demo','org','savings',0,1000)");
    });
    assert.doesNotMatch(JSON.stringify(grid),/Demo user|demo@example\.invalid|SIMULATED journal/);
    await db.close?.();databases.splice(databases.indexOf(firstRaw),1);
    const restartedRaw=await fresh();databases.push(restartedRaw);
    const restarted=await startDemoPrimaryDatabase({db:restartedRaw,master,guard,capture:captureDemoLogicalSnapshot,restore:restoreDemoLogicalSnapshot});
    assert.deepEqual((await restarted.query("SELECT user_id,role FROM memberships WHERE tenant_id='demo' AND org_id='org'")).rows,[{user_id:'u',role:'treasurer'}]);
    assert.equal((await restarted.query("SELECT saved::text AS saved FROM goals WHERE tenant_id='demo' AND user_id='u'")).rows[0].saved,'1000');
    assert.deepEqual((await restarted.query("SELECT SUM(debit)::text AS debit,SUM(credit)::text AS credit FROM finance_lines WHERE tenant_id='demo' AND org_id='org'")).rows,[{debit:'1000',credit:'1000'}]);
    await assert.rejects(restarted.query("UPDATE finance_entries SET description='changed' WHERE id='e'"),/immutable/);
    await assert.rejects(restarted.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES('late','e','demo','org','cash',1,0)"),/same transaction/);
    assert.equal((await master.read())?.revision,'1');
  }finally{for(const db of databases)await db.close?.();await rm(dir,{recursive:true,force:true});}
});
