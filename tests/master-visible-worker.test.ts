import test from 'node:test';
import assert from 'node:assert/strict';
import type {Database,Sql} from '../src/server/db';
import {syncSharedMasterView} from '../src/server/sheets/master-visible-worker';
import type {SheetRangeUpdate} from '../src/server/sheets/validation';

const spreadsheet='fake_spreadsheet_123';
const update={range:"'HURIZA data'!A1:B1",values:[['type','value']]};
function database(){
 let tail=Promise.resolve();
 const tx:Sql={query:async()=>({rows:[]}),exec:async()=>{}};
 const db:Database={...tx,async transaction(fn){let release!:()=>void;const next=new Promise<void>(r=>{release=r;});const before=tail;tail=next;await before;try{return await fn(tx);}finally{release();}}};
 return db;
}
test('writes only changes and never exposes snapshot to the writer',async()=>{
 const db=database(),events:string[]=[];
 const deps={capture:async()=>'{"private":"secret"}',render:()=>update,verifyManagedTab:async()=>{events.push('verify');},write:async(_id:string,u:SheetRangeUpdate)=>{events.push('write');assert.doesNotMatch(JSON.stringify(u),/secret/);}};
 const digest=await syncSharedMasterView(db,spreadsheet,null,deps);
 assert.match(digest,/^[a-f0-9]{64}$/);assert.deepEqual(events,['verify','write']);
 assert.equal(await syncSharedMasterView(db,spreadsheet,digest,deps),digest);assert.deepEqual(events,['verify','write']);
});
test('failed write is never acknowledged and remains retryable',async()=>{
 const db=database();let tries=0;
 const deps={capture:async()=> 'synthetic content',render:()=>update,verifyManagedTab:async()=>{},write:async()=>{if(++tries===1)throw Error('offline');}};
 await assert.rejects(syncSharedMasterView(db,spreadsheet,null,deps),/offline/);
 const result=await syncSharedMasterView(db,spreadsheet,null,deps);assert.match(result,/^[a-f0-9]{64}$/);assert.equal(tries,2);
});
test('serialization prevents an older projection from overtaking a later save',async()=>{
 const db=database(),events:string[]=[];let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>{release=r;}),ready=new Promise<void>(r=>{entered=r;});
 const first=syncSharedMasterView(db,spreadsheet,null,{capture:async()=> 'old',render:()=>update,verifyManagedTab:async()=>{},write:async()=>{events.push('write started');entered();await gate;events.push('write finished');}});
 await ready;
 const save=db.transaction(async()=>{events.push('next save');});
 assert.deepEqual(events,['write started']);release();await Promise.all([first,save]);
 assert.deepEqual(events,['write started','write finished','next save']);
});
