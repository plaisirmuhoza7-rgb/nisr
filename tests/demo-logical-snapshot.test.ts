import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {captureDemoLogicalSnapshot,parseDemoLogicalSnapshot,restoreDemoLogicalSnapshot,DEMO_SNAPSHOT_MAX_BYTES} from '../src/server/sheets/demo-logical-snapshot';

async function fresh(){
  const pg=await PGlite.create();
  for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort()){
    await pg.exec(await readFile(`migrations/${name}`,'utf8'));
    await pg.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
  }
  return pg;
}
function normalize(payload:string){const value=JSON.parse(payload);for(const row of value.tables.finance_entries)delete row.posting_txid;return value;}

test('private synthetic two-tenant snapshot restores exact money, identity, roles, goals and outbox',async()=>{
  const source=await fresh(),target=await fresh();
  try{
    await source.transaction(async tx=>{
      for(const tenant of ['a','b']){
        await tx.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenant]);
        await tx.query("INSERT INTO app_users VALUES($1,$1,$2,'firebase-managed','treasurer')",[tenant,`${tenant}@example.invalid`]);
        await tx.query('INSERT INTO account_profiles(user_id,tenant_id) VALUES($1,$1)',[tenant]);
        await tx.query("INSERT INTO memberships VALUES($1,$1,'same-org','treasurer')",[tenant]);
        await tx.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,savings_model) VALUES($1,'same-org','SIMULATED group','group','ACCUMULATING')",[tenant]);
        await tx.query("INSERT INTO goals VALUES($1,$1,$1,'User goal',1000000000000,999999999999,'2027-01-01')",[tenant]);
        await tx.query("INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES($1,'same-org',$2)",[tenant,`private-sheet-${tenant}`]);
        await tx.query("INSERT INTO finance_entries(id,tenant_id,org_id,description,reference) VALUES($1,$1,'same-org','SIMULATED journal',$1)",[tenant]);
        await tx.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES($1,$3,$3,'same-org','cash',9007199254740991,0),($2,$3,$3,'same-org','savings',0,9007199254740991)",[`${tenant}-d`,`${tenant}-c`,tenant]);
      }
    });
    const payload=await source.transaction(captureDemoLogicalSnapshot);
    assert.equal(payload,await source.transaction(captureDemoLogicalSnapshot));
    assert.ok(payload.includes('9007199254740991'));
    await restoreDemoLogicalSnapshot(target,payload);
    assert.deepEqual(normalize(await target.transaction(captureDemoLogicalSnapshot)),normalize(payload));
    assert.equal((await target.query<{sum:string}>("SELECT SUM(debit)::text AS sum FROM finance_lines WHERE tenant_id='a' AND org_id='same-org'")).rows[0].sum,'9007199254740991');
    await assert.rejects(target.query("UPDATE finance_entries SET description='changed' WHERE id='a'"),/immutable/);
    await assert.rejects(target.query("INSERT INTO finance_lines VALUES('late','a','a','same-org','cash',NULL,1,0)"),/same transaction/);
    await assert.rejects(restoreDemoLogicalSnapshot(target,payload),/empty target/);
  }finally{await source.close();await target.close();}
});

test('reject malformed schema, columns, bounds; corrupt journal rolls back and leaves guards enabled',async()=>{
  const source=await fresh(),target=await fresh();
  try{
    const payload=await source.transaction(captureDemoLogicalSnapshot);
    for(const change of [(v:any)=>v.tables.unknown=[],(v:any)=>v.schema='unknown',(v:any)=>v.tables.demo_tenants=[{id:12,created_at:null}],(v:any)=>v.tables.demo_tenants=[{id:'x',created_at:null,unknown:'x'}]]){
      const value=JSON.parse(payload);change(value);assert.throws(()=>parseDemoLogicalSnapshot(JSON.stringify(value)),/Invalid/);
    }
    assert.throws(()=>parseDemoLogicalSnapshot(' '.repeat(DEMO_SNAPSHOT_MAX_BYTES+1)),/Invalid/);
    const bad=JSON.parse(payload);
    bad.tables.demo_tenants=[{id:'x',created_at:'2026-01-01T00:00:00Z'}];
    bad.tables.finance_orgs=[{tenant_id:'x',org_id:'x',name:'SIMULATED',kind:'fund',district:'Gasabo',member_count:'0',reserve_bps:'2000',loan_limit_bps:'5000',savings_model:null}];
    bad.tables.finance_entries=[{id:'x',tenant_id:'x',org_id:'x',description:'SIMULATED',reference:'x',reversal_of:null,posting_txid:'123',created_at:'2026-01-01T00:00:00Z'}];
    await assert.rejects(restoreDemoLogicalSnapshot(target,JSON.stringify(bad)),/balanced/);
    assert.equal((await target.query('SELECT * FROM demo_tenants')).rows.length,0);
    assert.equal((await target.query("SELECT * FROM pg_trigger WHERE tgname='finance_lines_scope' AND tgenabled='O'")).rows.length,1);
  }finally{await source.close();await target.close();}
});
