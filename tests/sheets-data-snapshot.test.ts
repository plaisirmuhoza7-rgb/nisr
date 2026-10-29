import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Sql} from '../src/server/db';
import {loadOrganizationSnapshot} from '../src/server/sheets/data-snapshot';

let pg:PGlite;
let sql:Sql;
before(async()=>{
  pg=new PGlite();await pg.waitReady;
  sql={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q)};
  for (const name of ['001-identity','002-finance','003-firebase-accounts','004-dual-savings-groups','005-workspace-onboarding','006-google-sheets-bindings','007-organization-sheet-outbox','008-personal-sheet-destinations','009-sheet-delivery-retries','010-savings-group-administrator-label']) await sql.exec(await readFile(`migrations/${name}.sql`,'utf8'));
  for (const tenant of ['a','b']) {
    await sql.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenant]);
    for (const org of ['one','two']) {
      await sql.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind) VALUES($1,$2,$3,'fund')",[tenant,org,`${tenant}-${org}`]);
      await sql.query('INSERT INTO organization_sheet_bindings(tenant_id,org_id,spreadsheet_id) VALUES($1,$2,$3)',[tenant,org,`spreadsheet_${tenant}_${org}`]);
    }
  }
  await sql.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES('u','SECRET NAME','secret@example.invalid','PASSWORD SECRET','member')");
  await sql.query("INSERT INTO account_profiles(user_id,tenant_id) VALUES('u','a')");
  await sql.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('a','u','one','member'),('a','u','two','member')");
  await sql.query("INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES('goal','a','u','=PRIVATE GOAL',100,10,'2027-01-01')");
  await sql.query("INSERT INTO workspace_onboarding_requests(id,tenant_id,user_id,purpose,organization_name,district,description) VALUES('request','a','u','cooperative','PRIVATE SUBMISSION','Gasabo','Submitted request')");
});
after(async()=>{await pg.close();});

test('one scoped SELECT is deterministic, does not lock finance rows or perform network calls',async()=>{
  const queries:string[]=[];
  const counted:Sql={exec:async()=>{throw new Error('No mutations');},query:async(q,p)=>{queries.push(q);assert.deepEqual(p,['a','one']);return sql.query(q,p);}};
  const prior=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('No network');};
  try {
    const first=await loadOrganizationSnapshot(counted,'a','one');
    assert.equal(queries.length,1);assert.doesNotMatch(queries[0],/FOR\s+(UPDATE|SHARE)|\bLIMIT\b/i);
    assert.deepEqual(first,await loadOrganizationSnapshot(sql,'a','one'));
    assert.equal(first?.spreadsheetId,'spreadsheet_a_one');
    const text=JSON.stringify(first?.rows);
    assert.match(text,/a-one/);assert.doesNotMatch(text,/a-two|b-one|b-two|PRIVATE GOAL|PRIVATE SUBMISSION|SECRET NAME|PASSWORD|secret@example/);
    assert.equal(await loadOrganizationSnapshot(sql,'missing','one'),null);
    assert.equal((await loadOrganizationSnapshot(sql,'b','one'))?.spreadsheetId,'spreadsheet_b_one');
  } finally {globalThis.fetch=prior;}
});

test('personal goals require exact consent, active profile and persistent membership; revoke removes them',async()=>{
  const contains=async(org='one')=>JSON.stringify((await loadOrganizationSnapshot(sql,'a',org))?.rows).includes('=PRIVATE GOAL');
  await sql.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('a','u','one')");
  assert.equal(await contains(),true);assert.equal(await contains('two'),false);
  const optedIn=JSON.stringify((await loadOrganizationSnapshot(sql,'a','one'))?.rows);
  assert.match(optedIn,/SECRET NAME/);assert.match(optedIn,/secret@example/);assert.doesNotMatch(optedIn,/PASSWORD/);
  assert.match(optedIn,/PRIVATE SUBMISSION/);
  assert.doesNotMatch(JSON.stringify((await loadOrganizationSnapshot(sql,'a','two'))?.rows),/PRIVATE SUBMISSION|SECRET NAME|secret@example/);
  await sql.query("UPDATE account_profiles SET status='disabled' WHERE user_id='u'");assert.equal(await contains(),false);
  await sql.query("UPDATE account_profiles SET status='active' WHERE user_id='u'");assert.equal(await contains(),true);
  await sql.query("DELETE FROM personal_sheet_destinations WHERE user_id='u'");assert.equal(await contains(),false);
  assert.doesNotMatch(JSON.stringify((await loadOrganizationSnapshot(sql,'a','one'))?.rows),/PRIVATE SUBMISSION|SECRET NAME|secret@example/);
  await sql.query("INSERT INTO personal_sheet_destinations(tenant_id,user_id,org_id) VALUES('a','u','one')");
  await sql.query("DELETE FROM memberships WHERE tenant_id='a' AND org_id='one' AND user_id='u'");assert.equal(await contains(),false);
});

test('money preserves maximum safe integer exactly and overflow is rejected before delivery',async()=>{
  await sql.query("INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target) VALUES('max','a','two','=Literal','c','d',9007199254740991)");
  const result=await loadOrganizationSnapshot(sql,'a','two');
  assert.ok(result?.rows.some(row=>row.includes('9007199254740991')));
  assert.ok(result?.rows.some(row=>row.includes('=Literal')));
  for (const bad of ['9007199254740992','-1','1.5']) {
    const fake:Sql={exec:async()=>{},query:async()=>({rows:[{spreadsheet_id:'spreadsheet_bad',desired_revision:'1',delivered_revision:'0',records:[{section:'finance_campaigns',data:{id:'x',title:'x',category:'x',description:'x',target:bad,status:'active'}}]}] as never})};
    await assert.rejects(loadOrganizationSnapshot(fake,'a','one'),/safe integer RWF/);
  }
  await sql.query("INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target) SELECT 'overflow-'||n,'a','two','t','c','d',1 FROM generate_series(1,1100) n");
  await assert.rejects(loadOrganizationSnapshot(sql,'a','two'),/at most \d+/);
});
