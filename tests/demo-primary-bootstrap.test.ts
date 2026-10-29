import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapDemoPrimary} from '../src/server/sheets/demo-primary-bootstrap';
import {DEMO_SNAPSHOT_SCHEMA, DEMO_SNAPSHOT_TABLES} from '../src/server/sheets/demo-logical-snapshot';
import type {DecodedDemoEnvelope} from '../src/server/sheets/demo-envelope';

const names=Object.keys(DEMO_SNAPSHOT_TABLES);
const payload=JSON.stringify({schema:DEMO_SNAPSHOT_SCHEMA,tables:Object.fromEntries(names.map(name=>[name,[]]))});
function fixture() {
  let saved:DecodedDemoEnvelope|null=null, marked=false;
  const guard={async assertReady(){if(marked)throw Error('pending');},async beforeWrite(){marked=true;},async afterCommit(){marked=false;}};
  const master={async read(){return saved;},async write(slot:'A',revision:string,value:string){saved={slot,revision,payload:value};}};
  return {guard,master,isMarked:()=>marked,setSaved:(value:DecodedDemoEnvelope)=>{saved=value;}};
}
test('bootstrap verifies and reads back the initial master before clearing marker',async()=>{
  const f=fixture();let verified=false;
  await bootstrapDemoPrimary({payload,...f,async verifyRestore(){verified=true;}});
  assert.equal(verified,true);assert.equal(f.isMarked(),false);assert.equal((await f.master.read())?.payload,payload);
});
test('bootstrap refuses an existing master and retains marker on uncertain write',async()=>{
  const f=fixture();f.setSaved({slot:'A',revision:'0',payload});
  await assert.rejects(bootstrapDemoPrimary({payload,...f,async verifyRestore(){}}),/already contains/);
  assert.equal(f.isMarked(),false);
  const g=fixture();
  await assert.rejects(bootstrapDemoPrimary({payload,...g,master:{...g.master,async write(){throw Error('timeout');}},async verifyRestore(){}}),/timeout/);
  assert.equal(g.isMarked(),true);
});
