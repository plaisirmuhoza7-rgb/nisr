import {parseDemoLogicalSnapshot} from './demo-logical-snapshot';
import type {DecodedDemoEnvelope} from './demo-envelope';

/** Initialize a previously prepared, empty master. A caller must first capture
 * and verify a consistent offline copy of the existing database. The guard is
 * durable across process restarts and is never cleared after an uncertain write.
 * This function must run with the same exclusive process lock as the app. */
export async function bootstrapDemoPrimary(options: {
  payload: string;
  master: {read(): Promise<DecodedDemoEnvelope|null>; write(slot:'A', revision:string, payload:string):Promise<void>};
  guard: {assertReady():Promise<void>; beforeWrite():Promise<void>; afterCommit():Promise<void>};
  verifyRestore(payload:string):Promise<void>;
}):Promise<void> {
  await options.guard.assertReady();
  parseDemoLogicalSnapshot(options.payload);
  await options.verifyRestore(options.payload);
  if(await options.master.read() !== null) throw new Error('Demo master already contains data; bootstrap refused.');
  await options.guard.beforeWrite();
  await options.master.write('A','0',options.payload);
  const saved=await options.master.read();
  if(!saved || saved.slot!=='A' || saved.revision!=='0' || saved.payload!==options.payload)
    throw new Error('Demo master read-back did not match; reconciliation required.');
  await options.guard.afterCommit();
}
