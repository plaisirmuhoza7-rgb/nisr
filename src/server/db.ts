import type { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MIGRATIONS_DATA } from './migrations-data';
import {DomainError} from './permissions';

export interface Sql {
  query<T extends Record<string,unknown> = Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>;
  exec(sql:string):Promise<unknown>;
}
export interface Database extends Sql {transaction<T>(fn:(tx:Sql)=>Promise<T>):Promise<T>;close?():Promise<void>}
const globalDb = globalThis as typeof globalThis & {hurizaDb?:Promise<Database>};

async function initialize():Promise<Database> {
  if(process.env.HURIZA_SHEETS_PRIMARY==='true') return initializeSheetsPrimary();
  let db:Database;
  if(process.env.DATABASE_URL) {
    const pool = new Pool({connectionString:process.env.DATABASE_URL,max:8});
    db = {
      async query<T extends Record<string,unknown>>(sql:string,params?:unknown[]) {return {rows:(await pool.query(sql,params)).rows as T[]};},
      exec:sql=>pool.query(sql),close:()=>pool.end(),
      async transaction<T>(fn:(tx:Sql)=>Promise<T>) {
        const client=await pool.connect();
        try {await client.query('BEGIN');const value=await fn({async query<R extends Record<string,unknown>>(sql:string,params?:unknown[]){return {rows:(await client.query(sql,params)).rows as R[]};},exec:sql=>client.query(sql)});await client.query('COMMIT');return value;}
        catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
      }
    };
  } else {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if(process.env.NODE_ENV==='production' && !isServerless && process.env.ALLOW_EMBEDDED_DB!=='true') throw new DomainError('Sign-in is temporarily unavailable because the server database is not configured.',503);
    const defaultDataPath = isServerless
      ? path.join(os.tmpdir(), 'huriza_pglite')
      : path.join(process.cwd(), '.local', 'postgres');
    const dataPath = process.env.HURIZA_DB_PATH || defaultDataPath;
    await mkdir(dataPath,{recursive:true});
    const { PGlite } = await import('@electric-sql/pglite');
    const pg=new PGlite(dataPath);await pg.waitReady;
    db={query:(sql,params)=>pg.query(sql,params),exec:sql=>pg.exec(sql),transaction:fn=>pg.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)})),close:()=>pg.close()};
  }
  await migrate(db);
  return db;
}

export async function migrate(db:Database):Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const migrationNames = [
    '001-identity.sql','002-finance.sql','003-firebase-accounts.sql','004-dual-savings-groups.sql',
    '005-workspace-onboarding.sql','006-google-sheets-bindings.sql','007-organization-sheet-outbox.sql',
    '008-personal-sheet-destinations.sql','009-sheet-delivery-retries.sql','010-savings-group-administrator-label.sql',
    '011-ngo-sheet-bindings.sql','012-dedicated-workspace.sql','013-savings-group-roles-and-expenses.sql',
    '014-cooperative-management.sql','015-fundraising-platform.sql','016-ngo-impact-platform.sql',
    '017-personal-finance-extensions.sql'
  ];
  for(const name of migrationNames) {
    let sql = MIGRATIONS_DATA[name];
    if (!sql) {
      try {
        sql = await readFile(path.join(process.cwd(),'migrations',name),'utf8');
      } catch (err) {
        console.warn(`Could not read migration ${name} from disk:`, err);
        continue;
      }
    }
    await db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(42862026)');
      const {rows}=await tx.query('SELECT name FROM schema_migrations WHERE name=$1',[name]);
      if(rows.length===0){await tx.exec(sql);await tx.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);}
    });
  }
}

async function initializeSheetsPrimary():Promise<Database> {
  if(process.env.DATABASE_URL) throw new Error('Demo Sheets primary cannot be combined with DATABASE_URL.');
  const encoded=process.env.HURIZA_DEMO_MASTER_KEY ?? '';
  if(!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('Demo Sheets primary requires a canonical 32-byte base64 master key.');
  const key=Buffer.from(encoded,'base64');
  if(key.length!==32 || key.toString('base64')!==encoded) throw new Error('Demo Sheets primary requires a canonical 32-byte base64 master key.');
  const spreadsheetId=process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '';
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheetId)) throw new Error('Demo Sheets primary requires a valid spreadsheet ID.');
  const [{acquireDemoProcessLock},{createDemoWriteGuard},{createDemoMasterTransport},{startDemoPrimaryDatabase},{captureDemoLogicalSnapshot,restoreDemoLogicalSnapshot}]=await Promise.all([
    import('./sheets/demo-process-lock'),import('./sheets/demo-write-guard'),import('./sheets/demo-master-transport'),import('./sheets/demo-primary-start'),import('./sheets/demo-logical-snapshot'),
  ]);
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const baseDir = isServerless ? os.tmpdir() : process.cwd();
  const lockDirectory = path.join(baseDir, '.local', 'sheets-primary');
  await mkdir(lockDirectory, { recursive: true });
  const release=await acquireDemoProcessLock(lockDirectory);
  let pg:PGlite|undefined;
  try {
    const guard=createDemoWriteGuard(lockDirectory);
    await guard.assertReady();
    const { PGlite: PGliteClass } = await import('@electric-sql/pglite');
    pg=new PGliteClass();await pg.waitReady;
    const instance=pg;
    const raw:Database={query:(sql,params)=>instance.query(sql,params),exec:sql=>instance.exec(sql),transaction:fn=>instance.transaction((tx:any)=>fn({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)})),close:()=>instance.close()};
    await migrate(raw);
    const master=createDemoMasterTransport(spreadsheetId,key);
    const db=await startDemoPrimaryDatabase({db:raw,master,guard,capture:captureDemoLogicalSnapshot,restore:restoreDemoLogicalSnapshot});
    return {...db,close:async()=>{await db.close?.();await release();}};
  } catch(error) {
    await pg?.close().catch(()=>undefined);
    await release();
    throw error;
  }
}
export function getDb():Promise<Database> {return globalDb.hurizaDb ??= initialize().catch(error=>{delete globalDb.hurizaDb;throw error;});}
