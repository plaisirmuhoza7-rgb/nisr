import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acquireDemoProcessLock} from '../src/server/sheets/demo-process-lock';

test('prevents a second local writer and releases the owned lock',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'huriza-lock-'));
  try {
    const release=await acquireDemoProcessLock(dir);
    await assert.rejects(acquireDemoProcessLock(dir),error=>error instanceof Error && 'status' in error && error.status===503 && /another server/.test(error.message));
    await release();
    const releaseAgain=await acquireDemoProcessLock(dir);
    await releaseAgain();
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('does not delete a lock replaced by another owner',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'huriza-lock-'));
  try {
    const release=await acquireDemoProcessLock(dir);
    const lock=join(dir,'.huriza-demo-primary-process.lock');
    await writeFile(lock,'other owner');await release();
    assert.equal(await readFile(lock,'utf8'),'other owner');
    await assert.rejects(acquireDemoProcessLock(dir),/another server/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
