import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Database} from '../src/server/db';
import {startDemoPrimaryDatabase} from '../src/server/sheets/demo-primary-start';

function setup(){
  const events:string[]=[];
  const db:Database={query:async()=>({rows:[]}),exec:async()=>{},async transaction(fn){const value=await fn({query:async()=>({rows:[]}),exec:async()=>{}});events.push('commit');return value;}};
  const master={async read(){events.push('read');return {slot:'A' as const,revision:'5',payload:'authenticated'};},async write(slot:string,revision:string,payload:string){events.push(`write ${slot} ${revision} ${payload}`);}};
  const guard={async assertReady(){events.push('guard');},async beforeWrite(){events.push('mark');},async afterCommit(){events.push('clear');}};
  const restore=async(_db:Database,payload:string)=>{events.push(`restore ${payload}`);};
  const capture=async()=> 'new snapshot';
  return {events,db,master,guard,restore,capture};
}
test('checks guard, restores authenticated snapshot and saves next generation',async()=>{
  const f=setup(); const db=await startDemoPrimaryDatabase(f);
  assert.deepEqual(f.events,['guard','read','restore authenticated']);
  await db.exec('INSERT INTO example VALUES (1)');
  assert.deepEqual(f.events,['guard','read','restore authenticated','mark','write B 6 new snapshot','commit','clear']);
});
test('missing master fails closed without restoring',async()=>{
  const f=setup();
  await assert.rejects(startDemoPrimaryDatabase({...f,master:{...f.master,read:async()=>null}}),/not initialized/);
  assert.deepEqual(f.events,['guard']);
});
test('guard, authentication, and restore errors stop startup',async()=>{
  const f=setup();
  await assert.rejects(startDemoPrimaryDatabase({...f,guard:{...f.guard,assertReady:async()=>{throw Error('uncertain');}}}),/uncertain/);
  assert.deepEqual(f.events,[]);
  await assert.rejects(startDemoPrimaryDatabase({...f,master:{...f.master,read:async()=>{throw Error('authentication failed');}}}),/authentication failed/);
  assert.deepEqual(f.events,['guard']);
  await assert.rejects(startDemoPrimaryDatabase({...f,restore:async()=>{throw Error('schema mismatch');}}),/schema mismatch/);
  assert.deepEqual(f.events,['guard','guard','read']);
});
test('invalid revision fails before restore',async()=>{
  const f=setup();
  await assert.rejects(startDemoPrimaryDatabase({...f,master:{...f.master,read:async()=>({slot:'A',revision:'-1',payload:'bad'})}}),/metadata is invalid/);
  assert.deepEqual(f.events,['guard']);
});
