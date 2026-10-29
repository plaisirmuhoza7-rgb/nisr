import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {ensureFirebaseAccount} from '../src/server/accounts';
import {createSavingsGroup,financeState,type NewSavingsGroup} from '../src/server/finance/service';
import {createDemoMasterTransport,type MasterRequest} from '../src/server/sheets/demo-master-transport';
import {captureDemoLogicalSnapshot,restoreDemoLogicalSnapshot} from '../src/server/sheets/demo-logical-snapshot';
import {startDemoPrimaryDatabase} from '../src/server/sheets/demo-primary-start';
import {createDemoWriteGuard} from '../src/server/sheets/demo-write-guard';

async function fresh():Promise<Database>{
 const pg=await PGlite.create();
 for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort()){
  await pg.exec(await readFile(`migrations/${name}`,'utf8'));
  await pg.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
 }
 return {query:(sql,params)=>pg.query(sql,params),exec:sql=>pg.exec(sql),transaction:fn=>pg.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)})),close:()=>pg.close()};
}
function fakeMaster(){
 const grid:unknown[][]=Array.from({length:47},()=>Array<unknown>(11).fill(''));
 const request:MasterRequest=async ({url,method,data})=>{
  if(method==='POST'){
   const update=(data as {data:{range:string;values:unknown[][]}[]}).data[0],start=update.range.includes('G1:K47')?6:0;
   update.values.forEach((row,r)=>row.forEach((value,c)=>{grid[r][start+c]=value;}));return {};
  }
  const range=decodeURIComponent(url.split('/values/')[1].split('?')[0]);
  if(range.endsWith('!L1'))return {values:[['HURIZA_ENCRYPTED_DEMO_MASTER_V1']]};
  if(range.endsWith('!A1:K47'))return {values:grid};
  throw Error('Unexpected fake request');
 };
 return createDemoMasterTransport('synthetic_sheet_123',Buffer.alloc(32,28),request);
}
test('new verified member creates a savings group, then sees it after sheet restore and login',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'huriza-group-persistence-'));
 const databases:Database[]=[];
 try{
  const initial=await fresh();databases.push(initial);
  const master=fakeMaster(),guard=createDemoWriteGuard(dir);
  const payload=await initial.transaction(captureDemoLogicalSnapshot);
  await master.write('A','0',payload);
  const raw=await fresh();databases.push(raw);
  const app=await startDemoPrimaryDatabase({db:raw,master,guard,capture:captureDemoLogicalSnapshot,restore:restoreDemoLogicalSnapshot});
  const identity={uid:'simulated-new-user',email:'synthetic@example.invalid',name:'Synthetic Creator',emailVerified:true};
  const account=await ensureFirebaseAccount(app,identity);
  const input:NewSavingsGroup={model:'ROTATING',name:'SIMULATED Demo Ikimina',description:'Synthetic test',location:'Gasabo',contact:'0780000000',expectedMembers:2,contributionAmount:1000,frequency:'monthly',startDate:'2026-01-01',endDate:'2026-12-01',shareOutDate:'2026-02-01',rotationOrder:['Synthetic Creator','Synthetic Member'],reserveBps:0,accepted:true};
  const beforeInvalid=await master.read();
  await assert.rejects(createSavingsGroup(app,{tenantId:account.tenantId,userId:account.id,role:account.role},{...input,model:'ACCUMULATING',endDate:input.startDate,rotationOrder:[]}),/Cycle dates must/);
  assert.equal((await master.read())?.revision,beforeInvalid?.revision);
  const created=await createSavingsGroup(app,{tenantId:account.tenantId,userId:account.id,role:account.role},input);
  const itsinda=await createSavingsGroup(app,{tenantId:account.tenantId,userId:account.id,role:account.role},{...input,model:'ACCUMULATING',name:'SIMULATED Demo Itsinda',expectedMembers:10,contributionAmount:5000,frequency:'weekly',startDate:'2026-11-01',endDate:'2027-11-01',shareOutDate:'2027-11-01',rotationOrder:[],reserveBps:1000});
  await app.close?.();databases.splice(databases.indexOf(raw),1);
  const rawAfter=await fresh();databases.push(rawAfter);
  const restarted=await startDemoPrimaryDatabase({db:rawAfter,master,guard,capture:captureDemoLogicalSnapshot,restore:restoreDemoLogicalSnapshot});
  const signedIn=await ensureFirebaseAccount(restarted,identity);
  assert.equal(signedIn.tenantId,account.tenantId);
  assert.ok(signedIn.memberships.some(m=>m.orgId===created.orgId&&m.role==='president'));
  assert.ok(signedIn.memberships.some(m=>m.orgId===itsinda.orgId&&m.role==='president'));
  assert.ok(signedIn.workspaces.includes('groups'));
  const state=await financeState(restarted,{tenantId:signedIn.tenantId,userId:signedIn.id,role:signedIn.role},{orgId:created.orgId});
  assert.equal(state.savingsGroup?.id,created.orgId);
  assert.equal(state.savingsGroup?.name,input.name);
  assert.equal(state.savingsGroup?.memberRole,'president');
  const itsindaState=await financeState(restarted,{tenantId:signedIn.tenantId,userId:signedIn.id,role:signedIn.role},{orgId:itsinda.orgId});
  assert.equal(itsindaState.savingsGroup?.model,'ACCUMULATING');
  assert.equal(itsindaState.savingsGroup?.contributionAmount,5000);
 }finally{for(const db of databases)await db.close?.();await rm(dir,{recursive:true,force:true});}
});
