import {parseArgs} from 'node:util';
import {firebaseAdminAuth} from '../src/server/firebase-admin';
import {getDb} from '../src/server/db';
import {provisionAccess} from '../src/server/accounts';
import {z} from 'zod';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());
async function main(){
 const {values}=parseArgs({options:{uid:{type:'string'},role:{type:'string'},tenant:{type:'string'}},strict:true});
 const uid=z.string().min(1).parse(values.uid),role=z.enum(['member','president','treasurer','cooperative','ngo']).parse(values.role);
 const firebaseUser=await firebaseAdminAuth().getUser(uid);if(!firebaseUser.email)throw new Error('This account needs an email address.');
 const db=await getDb();try{const user=await provisionAccess(db,{uid,email:firebaseUser.email,name:firebaseUser.displayName,emailVerified:firebaseUser.emailVerified},{role,tenantId:values.tenant});console.log(JSON.stringify({uid:user.id,role:user.role,tenantId:user.tenantId,workspaces:user.workspaces},null,2));}finally{await db.close?.();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Provisioning failed.');process.exitCode=1;});
