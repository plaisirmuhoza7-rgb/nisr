import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {bindSpreadsheetForOrganization} from '../src/server/sheets/bindings';
import {processPendingSheetDeliveries} from '../src/server/sheets/pending';
import {deliverOrganizationSheet} from '../src/server/sheets/worker';
import {authorizeOrganizationDelivery} from '../src/server/sheets/authorization';
import {loadOrganizationSnapshot} from '../src/server/sheets/data-snapshot';
import {choosePersonalSheetDestination,clearPersonalSheetDestination} from '../src/server/sheets/personal-destinations';
import {renderManagedSnapshot} from '../src/server/sheets/snapshot';
import {createSavingsGroup} from '../src/server/finance/service';
import type {SheetRangeUpdate} from '../src/server/sheets/validation';

test('saved data flows through durable scoped queue to complete replacement snapshots and retry',async()=>{
  const pg=new PGlite();await pg.waitReady;
  const db:Database={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)}))};
  const sheets=new Map<string,SheetRangeUpdate>();
  const owner={tenantId:'pipeline',userId:'pipeline-user'};
  const priorFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('This pipeline test must never access network');};
  let providerFails=false,writes=0;
  const run=()=>processPendingSheetDeliveries(db,(tenant,org)=>deliverOrganizationSheet(db,tenant,org,{
    authorizeDestination:authorizeOrganizationDelivery,
    loadSnapshot:loadOrganizationSnapshot,
    writeSnapshot:async(id,update)=>{
      writes++;
      if(providerFails)throw new Error('provider failure containing private payload must not persist');
      sheets.set(id,structuredClone(update));
    },
  }));
  const text=(id='spreadsheet_pipeline_one')=>JSON.stringify(sheets.get(id));
  const queue=async()=> (await db.query<{status:string;desired_revision:bigint;delivered_revision:bigint;attempt_count:number;last_error_code:string|null;waiting:boolean}>("SELECT *,next_attempt_at>now() AS waiting FROM organization_sheet_outbox WHERE tenant_id='pipeline' AND org_id='one'")).rows[0];
  try {
    for(const name of ['001-identity','002-finance','003-firebase-accounts','004-dual-savings-groups','005-workspace-onboarding','006-google-sheets-bindings','007-organization-sheet-outbox','008-personal-sheet-destinations','009-sheet-delivery-retries','010-savings-group-administrator-label'])await db.exec(await readFile(`migrations/${name}.sql`,'utf8'));
    await db.query("INSERT INTO demo_tenants(id) VALUES('pipeline')");
    await db.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES('pipeline-user','SYNTHETIC PERSON','pipeline@example.invalid','PASSWORD NEVER EXPORTED','president')");
    await db.query("INSERT INTO account_profiles(user_id,tenant_id) VALUES('pipeline-user','pipeline')");
    for(const org of ['one','two']){
      await db.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind) VALUES('pipeline',$1,$2,'fund')",[org,`SIMULATED organization ${org}`]);
      await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES('pipeline','pipeline-user',$1,'president')",[org]);
      await bindSpreadsheetForOrganization(db,'pipeline',org,`spreadsheet_pipeline_${org}`);
    }
    assert.equal((await queue()).status,'pending');
    const initial=await loadOrganizationSnapshot(db,'pipeline','one');
    await run();
    assert.equal((await queue()).status,'synced');
    assert.deepEqual(sheets.get('spreadsheet_pipeline_one'),renderManagedSnapshot(initial!.rows));
    assert.equal(sheets.get('spreadsheet_pipeline_one')!.values.length,renderManagedSnapshot([]).values.length);
    const writesBeforeIdle=writes;await run();assert.equal(writes,writesBeforeIdle);
    assert.doesNotMatch(text(),/PASSWORD NEVER EXPORTED/);

    // A real database save triggers the durable queue without a manual export.
    await db.query("INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target) VALUES('pipeline-campaign','pipeline','one','SIMULATED saved campaign','school','Synthetic test',12345)");
    assert.equal((await queue()).status,'pending');await run();
    assert.match(text(),/SIMULATED saved campaign/);assert.match(text(),/12345/);
    assert.doesNotMatch(text('spreadsheet_pipeline_two'),/SIMULATED saved campaign/);

    await db.query("INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES('pipeline-goal','pipeline','pipeline-user','=SIMULATED chosen goal',10000,300,'2027-01-01')");
    await choosePersonalSheetDestination(db,owner,'one');await run();
    assert.match(text(),/=SIMULATED chosen goal/);
    assert.doesNotMatch(text('spreadsheet_pipeline_two'),/=SIMULATED chosen goal|pipeline@example/);
    await db.query("UPDATE goals SET saved=700 WHERE id='pipeline-goal'");await run();
    assert.ok(sheets.get('spreadsheet_pipeline_one')!.values.some(row=>row.includes('saved (RWF)')&&row.includes('700')));
    await clearPersonalSheetDestination(db,owner);await run();
    assert.doesNotMatch(text(),/=SIMULATED chosen goal|pipeline@example/);
    const replacement=await loadOrganizationSnapshot(db,'pipeline','one');
    assert.deepEqual(sheets.get('spreadsheet_pipeline_one'),renderManagedSnapshot(replacement!.rows));

    await db.transaction(async tx=>{
      await tx.query("INSERT INTO finance_entries(id,tenant_id,org_id,description,reference) VALUES('pipeline-journal','pipeline','one','SIMULATED ledger fixture','pipeline-fixture-reference')");
      await tx.query("INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,debit,credit) VALUES('pipeline-debit','pipeline-journal','pipeline','one','cash',500,0),('pipeline-credit','pipeline-journal','pipeline','one','capital',0,500)");
    });
    await run();
    const ledgerBefore=(await db.query('SELECT * FROM finance_entries ORDER BY id')).rows;
    const linesBefore=(await db.query('SELECT * FROM finance_lines ORDER BY id')).rows;
    const successfulSnapshot=structuredClone(sheets.get('spreadsheet_pipeline_one'));
    await db.query("UPDATE finance_campaigns SET title='SIMULATED retry campaign' WHERE id='pipeline-campaign'");
    const deliveredBefore=String((await queue()).delivered_revision);
    providerFails=true;await run();
    const failed=await queue();
    assert.equal(failed.status,'pending');assert.equal(String(failed.delivered_revision),deliveredBefore);
    assert.equal(failed.attempt_count,1);assert.equal(failed.last_error_code,'connection');assert.equal(failed.waiting,true);
    assert.deepEqual(sheets.get('spreadsheet_pipeline_one'),successfulSnapshot);
    assert.deepEqual((await db.query('SELECT * FROM finance_entries ORDER BY id')).rows,ledgerBefore);
    assert.deepEqual((await db.query('SELECT * FROM finance_lines ORDER BY id')).rows,linesBefore);
    const writesBeforeBackoff=writes;await run();assert.equal(writes,writesBeforeBackoff);
    providerFails=false;await db.query("UPDATE organization_sheet_outbox SET next_attempt_at=now()-interval '1 second' WHERE tenant_id='pipeline' AND org_id='one'");await run();
    assert.match(text(),/SIMULATED retry campaign/);
    assert.equal((await queue()).status,'synced');assert.equal((await queue()).last_error_code,null);assert.equal((await queue()).attempt_count,0);
    const administratorLabel='  Named coordinator = nobody receives a role  ';
    const group=await createSavingsGroup(db,{...owner,role:'member'},{model:'ACCUMULATING',name:'Label snapshot',description:'Synthetic setup',location:'Gasabo',contact:'0780000000',administratorLabel,expectedMembers:2,contributionAmount:1000,frequency:'monthly',startDate:'2026-01-01',endDate:'2027-01-01',shareOutDate:'2027-01-01',rotationOrder:[],reserveBps:0,accepted:true});
    await bindSpreadsheetForOrganization(db,owner.tenantId,group.orgId,'spreadsheet_pipeline_label');
    const labelSnapshot=await loadOrganizationSnapshot(db,owner.tenantId,group.orgId);
    assert.ok(labelSnapshot!.rows.some(row=>row.includes('administrator_label')&&row.includes(administratorLabel)));
  }finally{globalThis.fetch=priorFetch;await pg.close();}
});
