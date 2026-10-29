import type {Database, Sql} from '../db';

type Slot = 'A'|'B';
type Master = {write(slot:Slot, revision:string, payload:string):Promise<void>};

/** A single-process demo adapter. The caller must prevent other processes or
 * machines from writing this sheet. Sheets has no compare-and-swap operation.
 * SQL must be application-controlled: SELECT is assumed not to call a
 * function that changes durable state. */
export function createDemoPrimaryDatabase(options:{
  db:Database;
  master:Master;
  capture:(sql:Sql)=>Promise<string>;
  slot:Slot;
  revision:string;
  /** Persist an uncertainty marker before any remote write. */
  beforeWrite:()=>Promise<void>;
  /** Clear that marker only after SQL commit has succeeded. */
  afterCommit:()=>Promise<void>;
  onUncertain?:()=>Promise<void>;
}):Database {
  if(!/^(0|[1-9]\d*)$/.test(options.revision)) throw new Error('Invalid demo master revision.');
  let revision=BigInt(options.revision), slot=options.slot, frozen=false;
  let tail:Promise<void>=Promise.resolve();
  async function exclusive<T>(fn:()=>Promise<T>, allowFrozen=false):Promise<T> {
    let release!:()=>void;
    const next=new Promise<void>(resolve=>{release=resolve;});
    const previous=tail; tail=next;
    await previous;
    try {if(frozen && !allowFrozen) throw new Error('Demo database is paused after an uncertain save; reconciliation is required.');return await fn();}
    finally {release();}
  }
  async function freeze() {
    frozen=true;
    try {await options.onUncertain?.();} catch { /* Still block access in this process. */ }
  }
  function isReadOnly(sql:string):boolean {
    // Treat CTEs and all unknown statements as writes. Reject multi-statement
    // SELECTs from the read-only path even when they contain quoted semicolons.
    return /^\s*(?:SELECT|SHOW)\b/i.test(sql) && !sql.trim().replace(/;$/, '').includes(';');
  }
  async function run<T>(fn:(tx:Sql)=>Promise<T>):Promise<T> {
    let uncertaintyStarted=false, remoteSucceeded=false;
    let nextSlot:Slot=slot, nextRevision=revision;
    try {
      const result=await options.db.transaction(async raw=>{
        let dirty=false;
        const tx:Sql={
          async query<R extends Record<string,unknown>>(sql:string,params?:unknown[]) {
            if(!isReadOnly(sql)) dirty=true;
            return raw.query<R>(sql,params);
          },
          async exec(sql:string) {if(!isReadOnly(sql)) dirty=true;return raw.exec(sql);}
        };
        const value=await fn(tx);
        if(dirty) {
          await raw.exec('SET CONSTRAINTS ALL IMMEDIATE');
          const payload=await options.capture(raw);
          nextSlot=slot==='A'?'B':'A'; nextRevision=revision+1n;
          uncertaintyStarted=true;
          await options.beforeWrite();
          await options.master.write(nextSlot,nextRevision.toString(),payload);
          remoteSucceeded=true;
        }
        return value;
      });
      if(remoteSucceeded){await options.afterCommit();slot=nextSlot;revision=nextRevision;}
      return result;
    } catch(error) {
      // Any request failure may be ambiguous, as can a failed local COMMIT
      // after the remote write. Do not allow a later operation to overwrite it.
      if(uncertaintyStarted) await freeze();
      throw error;
    }
  }
  return {
    query:(sql,params)=>exclusive(()=>run(tx=>tx.query(sql,params))),
    exec:sql=>exclusive(()=>run(tx=>tx.exec(sql))),
    transaction:fn=>exclusive(()=>run(fn)),
    close:()=>exclusive(async()=>{await options.db.close?.();},true),
  };
}
