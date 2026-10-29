import {createHash} from 'node:crypto';
import type {Database,Sql} from '../db';
import {captureDemoLogicalSnapshot,parseDemoLogicalSnapshot} from './demo-logical-snapshot';
import {renderMasterVisibleProjection} from './master-visible-projection';
import type {SheetRangeUpdate} from './validation';

type Dependencies={
 verifyManagedTab:(spreadsheetId:string)=>Promise<void>;
 write:(spreadsheetId:string,update:SheetRangeUpdate)=>Promise<unknown>;
 /** Optional seams for isolated tests; callers normally use the audited defaults. */
 capture?:(tx:Sql)=>Promise<string>;
 render?:(payload:string)=>SheetRangeUpdate;
};

/** The shared-file view is an asynchronous projection, never the durable master.
 * The primary database adapter serializes this transaction with saves, so an
 * older projection cannot overtake a newer one within this process. Return a
 * digest only after the entire bounded tab replacement succeeds; failures are
 * retried by the caller and must not be acknowledged. */
export async function syncSharedMasterView(db:Database,spreadsheetId:string,previousDigest:string|null,dependencies:Dependencies):Promise<string>{
 if(!/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId))throw new Error('Invalid shared spreadsheet ID.');
 return db.transaction(async tx=>{
  const payload=await (dependencies.capture??captureDemoLogicalSnapshot)(tx);
  const digest=createHash('sha256').update(payload,'utf8').digest('hex');
  if(digest===previousDigest)return digest;
  const update=dependencies.render?dependencies.render(payload):renderMasterVisibleProjection(parseDemoLogicalSnapshot(payload));
  await dependencies.verifyManagedTab(spreadsheetId);
  await dependencies.write(spreadsheetId,update);
  return digest;
 });
}
