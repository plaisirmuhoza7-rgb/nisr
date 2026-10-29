import {loadEnvConfig} from '@next/env';
import {PGlite} from '@electric-sql/pglite';
import {cp,lstat,mkdir,mkdtemp,readFile,readdir,realpath,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {migrate, type Database} from '../src/server/db';
import {captureDemoLogicalSnapshot,restoreDemoLogicalSnapshot} from '../src/server/sheets/demo-logical-snapshot';
import {createDemoMasterTransport,prepareDemoMasterTab} from '../src/server/sheets/demo-master-transport';
import {bootstrapDemoPrimary} from '../src/server/sheets/demo-primary-bootstrap';
import {acquireDemoProcessLock} from '../src/server/sheets/demo-process-lock';
import {createDemoWriteGuard} from '../src/server/sheets/demo-write-guard';

loadEnvConfig(process.cwd());
let stage='configuration';
const migrations=['001-identity.sql','002-finance.sql','003-firebase-accounts.sql','004-dual-savings-groups.sql','005-workspace-onboarding.sql','006-google-sheets-bindings.sql','007-organization-sheet-outbox.sql','008-personal-sheet-destinations.sql','009-sheet-delivery-retries.sql','010-savings-group-administrator-label.sql','011-ngo-sheet-bindings.sql','012-dedicated-workspace.sql','013-savings-group-roles-and-expenses.sql'];
function wrap(pg:PGlite):Database{return {query:(sql,params)=>pg.query(sql,params),exec:sql=>pg.exec(sql),transaction:fn=>pg.transaction(tx=>fn({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)})),close:()=>pg.close()};}
function inside(child:string,parent:string){const rel=path.relative(parent,child);return rel==='' || (!rel.startsWith('..'+path.sep) && rel!=='..' && !path.isAbsolute(rel));}
async function checkNoLinks(dir:string):Promise<void>{
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const name=path.join(dir,entry.name); const item=await lstat(name);
    if(item.isSymbolicLink())throw new Error('Offline copy must not contain symbolic links.');
    if(item.isDirectory())await checkNoLinks(name);
    else if(!item.isFile())throw new Error('Offline copy contains an unsupported filesystem entry.');
  }
}
async function verifyRestore(payload:string):Promise<void>{
  const pg=new PGlite();await pg.waitReady;const db=wrap(pg);
  try {
    await db.exec('CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for(const name of migrations){const sql=await readFile(path.join(process.cwd(),'migrations',name),'utf8');await db.transaction(async tx=>{await tx.exec(sql);await tx.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);});}
    await restoreDemoLogicalSnapshot(db,payload);
  } finally {await pg.close();}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==3 || args[0]!=='--offline-copy' || args[2]!=='--confirm-app-stopped') throw new Error('Usage: npx tsx scripts/bootstrap-sheets-primary.ts --offline-copy <path> --confirm-app-stopped');
  const encoded=process.env.HURIZA_DEMO_MASTER_KEY??'';
  const key=Buffer.from(encoded,'base64');
  if(!/^[A-Za-z0-9+/]{43}=$/.test(encoded)||key.length!==32||key.toString('base64')!==encoded)throw new Error('Configure an existing canonical 32-byte base64 HURIZA_DEMO_MASTER_KEY.');
  const spreadsheet=process.env.GOOGLE_SHEETS_SPREADSHEET_ID??'';
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(spreadsheet))throw new Error('Configure a valid GOOGLE_SHEETS_SPREADSHEET_ID.');
  const source=await realpath(args[1]);
  if(!(await stat(source)).isDirectory())throw new Error('Offline copy must be a database directory.');
  const originalPath=process.env.HURIZA_DB_PATH||path.join(process.cwd(),'.local','postgres');
  const original=await realpath(originalPath).catch(()=>path.resolve(originalPath));
  if(inside(source,original)||inside(original,source))throw new Error('Use a separate offline copy, not the configured source database or its parent.');
  const lockDirectory=path.join(process.cwd(),'.local','sheets-primary');
  await mkdir(lockDirectory,{recursive:true});
  const lockReal=await realpath(lockDirectory);
  if(inside(source,lockReal)||inside(lockReal,source))throw new Error('Offline copy must be outside the Sheets primary working directory.');
  await stat(path.join(source,'PG_VERSION'));
  await checkNoLinks(source);
  const release=await acquireDemoProcessLock(lockReal);
  let work:string|undefined;
  try {
    const guard=createDemoWriteGuard(lockReal);await guard.assertReady();
    stage='copying offline data';
    work=await mkdtemp(path.join(lockReal,'bootstrap-copy-'));
    await cp(source,work,{recursive:true,errorOnExist:false,force:false});
    stage='reading the offline database';
    const pg=new PGlite(work);await pg.waitReady;
    let payload:string;
    try{await migrate(wrap(pg));payload=await pg.transaction(tx=>captureDemoLogicalSnapshot({query:(sql,params)=>tx.query(sql,params),exec:sql=>tx.exec(sql)}));}
    finally{await pg.close();}
    stage='verifying snapshot restoration';
    await verifyRestore(payload);
    stage='preparing the master sheet tab';
    await prepareDemoMasterTab(spreadsheet);
    stage='writing and verifying the master snapshot';
    await bootstrapDemoPrimary({payload,master:createDemoMasterTransport(spreadsheet,key),guard,verifyRestore});
    console.log('Encrypted demo master initialized and verified. Primary mode has not been enabled.');
  } finally {
    if(work && inside(work,lockReal) && path.basename(work).startsWith('bootstrap-copy-'))await rm(work,{recursive:true,force:true});
    await release();
  }
}
main().catch((error:unknown)=>{const known=error instanceof Error && ['Private demo snapshot schema requires an explicit format upgrade.','Invalid private demo snapshot.','Snapshot migration version mismatch.'].includes(error.message) ? ` ${error.message}` : '';console.error(`Bootstrap failed during ${stage}.${known} Existing source data and primary settings were not changed. Check the offline copy, credentials, master tab, and write guard before retrying.`);process.exitCode=1;});
