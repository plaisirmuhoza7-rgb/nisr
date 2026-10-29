import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadEnvConfig} from '@next/env';
import {firebaseAdminAuth,firebaseProjectId,isAuthEmulator} from '../src/server/firebase-admin';
import {getDb} from '../src/server/db';
import {DEMO_USERS,ensureSeed,newDemoTenant} from '../src/server/seed';
import {provisionAccess} from '../src/server/accounts';
loadEnvConfig(process.cwd());
async function main(){
 if(!isAuthEmulator()||!firebaseProjectId()?.startsWith('demo-'))throw new Error('This script runs only against a local Firebase emulator with a demo- project ID. It cannot create live accounts.');
 const auth=firebaseAdminAuth(),db=await getDb();
 try{
  await ensureSeed(db);const tenantId=await newDemoTenant(db);const accounts=[];
  for(const fixture of DEMO_USERS){
   const password=`Huriza-${fixture.role}-Local2026!`;
   try{await auth.getUser(fixture.id);await auth.updateUser(fixture.id,{email:fixture.email,displayName:fixture.name,password,emailVerified:true,disabled:false});}
   catch(error){if(!(error&&typeof error==='object'&&'code' in error&&error.code==='auth/user-not-found'))throw error;await auth.createUser({uid:fixture.id,email:fixture.email,displayName:fixture.name,password,emailVerified:true});}
   await provisionAccess(db,{uid:fixture.id,email:fixture.email,name:fixture.name,emailVerified:true},{role:fixture.role,tenantId,testAccount:true});
   accounts.push({email:fixture.email,password,role:fixture.role,uid:fixture.id});
  }
  const directory=path.join(process.cwd(),'.local');await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'firebase-test-accounts.json'),JSON.stringify({projectId:firebaseProjectId(),tenantId,accounts},null,2)+'\n');
  console.log('Five separate local Firebase test accounts created. Credentials are in ignored .local/firebase-test-accounts.json. These are emulator-only fictional accounts.');
 }finally{await db.close?.();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local account setup failed.');process.exitCode=1;});
