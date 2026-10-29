import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {createDemoPrimaryDatabase} from '../src/server/sheets/demo-primary-db';

async function fixture() {
  const pg=new PGlite(); await pg.waitReady;
  await pg.exec('CREATE TABLE items (id integer PRIMARY KEY, value text NOT NULL)');
  const raw:Database={query:(sql,params)=>pg.query(sql,params),exec:sql=>pg.exec(sql),transaction:fn=>pg.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)})),close:()=>pg.close()};
  return {pg,raw};
}
test('writes the committed snapshot in alternate slots and leaves reads alone',async()=>{
  const {pg,raw}=await fixture(); const writes:{slot:string;revision:string;payload:string}[]=[];
  const db=createDemoPrimaryDatabase({beforeWrite:async()=>{},afterCommit:async()=>{},db:raw,slot:'A',revision:'0',capture:async tx=>JSON.stringify((await tx.query('SELECT * FROM items ORDER BY id')).rows),master:{async write(slot,revision,payload){writes.push({slot,revision,payload});}}});
  await db.query('SELECT * FROM items');
  await db.query('INSERT INTO items VALUES ($1,$2)',[1,'one']);
  await db.transaction(async tx=>{await tx.query('INSERT INTO items VALUES (2,$1)',['two']);await tx.query('UPDATE items SET value=$1 WHERE id=1',['updated']);});
  assert.deepEqual(writes.map(w=>[w.slot,w.revision]),[['B','1'],['A','2']]);
  assert.deepEqual(JSON.parse(writes[1].payload),[{id:1,value:'updated'},{id:2,value:'two'}]);
  await pg.close();
});
test('pre-write errors roll back without pausing the database',async()=>{
  const {pg,raw}=await fixture(); let attempts=0;
  const db=createDemoPrimaryDatabase({beforeWrite:async()=>{},afterCommit:async()=>{},db:raw,slot:'A',revision:'0',capture:async()=>{if(!attempts++) throw Error('capture failed');return 'ok';},master:{async write(){}}});
  await assert.rejects(db.query("INSERT INTO items VALUES (1,'one')"),/capture failed/);
  assert.equal((await db.query('SELECT * FROM items')).rows.length,0);
  await db.query("INSERT INTO items VALUES (1,'one')");
  assert.equal((await db.query('SELECT * FROM items')).rows.length,1);
  await pg.close();
});
test('remote failure freezes later operations and invokes uncertainty handler',async()=>{
  const {pg,raw}=await fixture(); let marked=0;
  const db=createDemoPrimaryDatabase({beforeWrite:async()=>{},afterCommit:async()=>{},db:raw,slot:'A',revision:'0',capture:async()=> 'ok',onUncertain:async()=>{marked++;},master:{async write(){throw Error('timeout');}}});
  await assert.rejects(db.query("INSERT INTO items VALUES (1,'one')"),/timeout/);
  await assert.rejects(db.query('SELECT * FROM items'),/paused/);
  assert.equal(marked,1);
  assert.equal((await pg.query('SELECT * FROM items')).rows.length,0);
  await pg.close();
});
test('serializes concurrent transactions until the remote write finishes',async()=>{
  const {pg,raw}=await fixture(); const writes:string[]=[];
  let unblock!:()=>void; const gate=new Promise<void>(resolve=>{unblock=resolve;});
  let entered!:()=>void; const firstEntered=new Promise<void>(resolve=>{entered=resolve;});
  const db=createDemoPrimaryDatabase({beforeWrite:async()=>{},afterCommit:async()=>{},db:raw,slot:'A',revision:'0',capture:async tx=>JSON.stringify((await tx.query('SELECT * FROM items ORDER BY id')).rows),master:{async write(_s,r,p){writes.push(p);if(r==='1'){entered();await gate;}}}});
  const first=db.query("INSERT INTO items VALUES (1,'one')"); await firstEntered;
  const second=db.query("INSERT INTO items VALUES (2,'two')");
  assert.equal(writes.length,1); unblock(); await Promise.all([first,second]);
  assert.equal(JSON.parse(writes[0]).length,1);assert.equal(JSON.parse(writes[1]).length,2);
  await pg.close();
});
test('a failed commit following a remote write freezes access',async()=>{
  let marked=0;
  const raw:Database={query:async()=>({rows:[]}),exec:async()=>{},async transaction(fn){await fn({query:async()=>({rows:[]}),exec:async()=>{}});throw Error('commit failed');}};
  const db=createDemoPrimaryDatabase({beforeWrite:async()=>{},afterCommit:async()=>{},db:raw,slot:'A',revision:'0',capture:async()=> 'ok',onUncertain:async()=>{marked++;},master:{async write(){}}});
  await assert.rejects(db.exec('INSERT INTO items VALUES (1)'),/commit failed/);
  await assert.rejects(db.query('SELECT 1'),/paused/);assert.equal(marked,1);
});
test('sets the durable marker before the remote request and clears it only after commit',async()=>{
  const events:string[]=[];
  const raw:Database={query:async()=>({rows:[]}),exec:async()=>{},async transaction(fn){const value=await fn({query:async()=>({rows:[]}),exec:async()=>{}});events.push('commit');return value;}};
  const db=createDemoPrimaryDatabase({db:raw,slot:'A',revision:'0',capture:async()=> 'ok',beforeWrite:async()=>{events.push('marker');},afterCommit:async()=>{events.push('clear');},master:{async write(){events.push('remote');}}});
  await db.exec('INSERT INTO items VALUES (1)');
  assert.deepEqual(events,['marker','remote','commit','clear']);
});
test('failure to clear the marker freezes the database after commit',async()=>{
  let marked=false;
  const raw:Database={query:async()=>({rows:[]}),exec:async()=>{},async transaction(fn){return fn({query:async()=>({rows:[]}),exec:async()=>{}});}};
  const db=createDemoPrimaryDatabase({db:raw,slot:'A',revision:'0',capture:async()=> 'ok',beforeWrite:async()=>{marked=true;},afterCommit:async()=>{throw Error('cannot clear');},master:{async write(){}}});
  await assert.rejects(db.exec('INSERT INTO items VALUES (1)'),/cannot clear/);
  assert.equal(marked,true);
  await assert.rejects(db.query('SELECT 1'),/paused/);
});
