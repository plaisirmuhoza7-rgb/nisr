import type {Database, Sql} from '../db';
import type {DecodedDemoEnvelope, DemoMasterSlot} from './demo-envelope';
import {createDemoPrimaryDatabase} from './demo-primary-db';

/** Starts a previously bootstrapped demo master. The caller owns the fresh,
 * already-migrated database and holds the single-process lock for its lifetime.
 * master.read must authenticate ciphertext before returning its payload. */
export async function startDemoPrimaryDatabase(options:{
  db:Database;
  master:{read:()=>Promise<DecodedDemoEnvelope|null>;write:(slot:DemoMasterSlot,revision:string,payload:string)=>Promise<void>};
  guard:{assertReady:()=>Promise<void>;beforeWrite:()=>Promise<void>;afterCommit:()=>Promise<void>};
  capture:(sql:Sql)=>Promise<string>;
  restore:(db:Database,payload:string)=>Promise<void>;
}):Promise<Database> {
  await options.guard.assertReady();
  const master=await options.master.read();
  if(!master) throw new Error('Demo master is not initialized; refusing to start.');
  if((master.slot!=='A' && master.slot!=='B') || !/^(0|[1-9]\d*)$/.test(master.revision) || typeof master.payload!=='string') {
    throw new Error('Demo master metadata is invalid; refusing to start.');
  }
  await options.restore(options.db,master.payload);
  return createDemoPrimaryDatabase({
    db:options.db,master:options.master,capture:options.capture,
    slot:master.slot,revision:master.revision,
    beforeWrite:()=>options.guard.beforeWrite(),
    afterCommit:()=>options.guard.afterCommit(),
  });
}
