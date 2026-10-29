import {open, readFile, unlink} from 'node:fs/promises';
import {readFileSync, unlinkSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {DomainError} from '../permissions';

/** An intentionally non-self-healing local lock. A stale lock must be examined
 * by an operator; it is never removed just because its PID looks inactive. */
export async function acquireDemoProcessLock(directory:string):Promise<()=>Promise<void>> {
  const lockPath=join(directory,'.huriza-demo-primary-process.lock');
  const token=`${randomBytes(32).toString('hex')}\n`;
  let file;
  try {
    file=await open(lockPath,'wx',0o600);
    await file.writeFile(token,'utf8');
    await file.sync();
    await file.close();
  } catch {
    if(file) await file.close().catch(()=>undefined);
    throw new DomainError('This demo is already running in another server, or its previous server did not shut down cleanly. Use the running demo or ask the administrator to restart it.',503);
  }
  let owned=true;
  const releaseOnExit=()=>{
    if(!owned)return;
    try {if(readFileSync(lockPath,'utf8')===token) unlinkSync(lockPath);} catch { /* preserve an unverified lock */ }
    owned=false;
  };
  process.once('exit',releaseOnExit);
  return async()=>{
    if(!owned)return;
    // A missing or replaced lock is never deleted blindly.
    try {if(await readFile(lockPath,'utf8')===token) await unlink(lockPath);} catch(error) {
      if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;
    }
    owned=false;process.removeListener('exit',releaseOnExit);
  };
}
