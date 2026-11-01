import {createHash,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {getDb} from './db';
import {DomainError} from './permissions';
import {firebaseAdminAuth,firebaseAdminConfigured} from './firebase-admin';
import {verifyAuthToken,createSessionCookie,resolveStoredFirebaseSession} from './firebase-session-policy';
import {ensureFirebaseAccount,readAccount} from './accounts';
import type {Actor} from '@/lib/contracts';
import type {AccountUser} from '@/lib/access';
const COOKIE='huriza_firebase_session';
const MAX_AGE=8*60*60;
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');

export function localDemoEnabled(){return process.env.NODE_ENV==='development'&&!process.env.DATABASE_URL&&process.env.HURIZA_SHEETS_PRIMARY!=='true'&&process.env.HURIZA_SHEETS_AUTO_SYNC!=='true'&&!process.env.VERCEL&&!process.env.AWS_LAMBDA_FUNCTION_NAME;}

export async function currentUser():Promise<AccountUser|null>{
 try {
  const jar=await cookies();
  const phoneCookie=jar.get('huriza_phone_session')?.value;
  const demoCookie=localDemoEnabled()?jar.get('huriza_local_demo')?.value:undefined;
  const cookie=jar.get(COOKIE)?.value;
  if(!cookie && !phoneCookie && !demoCookie) return null;
  const db=await getDb();
  if(demoCookie&&demoCookie.length<=1000){
   const row=(await db.query("SELECT s.user_id FROM sessions s JOIN account_profiles p ON p.user_id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND p.is_test_account=true AND s.user_id LIKE 'local-demo-%'",[digest(demoCookie)])).rows[0];
   if(row)return readAccount(db,String(row.user_id),true);
  }
  if(phoneCookie&&phoneCookie.length<=1000){
   const row=(await db.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[digest(phoneCookie)])).rows[0];
   if(row) return readAccount(db,String(row.user_id),true);
  }
  if(cookie&&cookie.length<=10000&&firebaseAdminConfigured()){
   const claims=await resolveStoredFirebaseSession(cookie,async()=>
    (await db.query('SELECT user_id FROM firebase_sessions WHERE token_hash=$1 AND expires_at>now()',[digest(cookie)])).rows[0]?.user_id,
    firebaseAdminAuth
   );
   if(claims)return readAccount(db,claims.uid,true);
  }
  return null;
 } catch (error) {
  if (typeof error === 'object' && error !== null && 'digest' in error) {
   throw error;
  }
  console.warn('Unable to resolve currentUser, treating as guest:', error);
  return null;
 }
}
export async function requireAccount():Promise<AccountUser>{const user=await currentUser();if(!user)throw new DomainError('Please sign in to your account.',401);return user;}
export async function requireActor():Promise<Actor>{const user=await requireAccount();return {tenantId:user.tenantId,userId:user.id,role:user.role};}
export async function createFirebaseSession(idToken:string,workspace?:import('@/lib/access').Workspace):Promise<AccountUser>{
 const auth=firebaseAdminAuth();let claims;
 try{claims=await verifyAuthToken(auth,idToken);}catch(error){
  const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
  if(code==='auth/invalid-credential'||code==='auth/insufficient-permission'||code==='app/invalid-credential'){
   console.error('Firebase token verification configuration failed:',error);
   throw new DomainError('Secure sign-in is unavailable. Check the server Firebase configuration and try again.',503);
  }
  throw new DomainError('Your sign-in could not be verified. Please sign in again.',401);
 }
 const age=Math.floor(Date.now()/1000)-claims.auth_time;
 if(age< -300||age>7200)throw new DomainError('Please sign in again to start a fresh secure session.',401);
 if(claims.email_verified!==true||!claims.email)throw new DomainError('Verify your email address before signing in.',403);
 let session: string;
 try{session=await createSessionCookie(auth,idToken,MAX_AGE);}
 catch(error){console.error('Firebase session creation failed:',error);throw new DomainError('Secure sign-in is unavailable. Check the server Firebase configuration and try again.',503);}
 const jar=await cookies();const old=jar.get(COOKIE)?.value;
 const db=await getDb();
 const user=await ensureFirebaseAccount(
  db,
  {uid:claims.uid,email:claims.email,name:typeof claims.name==='string'?claims.name:undefined,emailVerified:true},
  workspace,
  {oldHash:old?digest(old):undefined,newHash:digest(session)}
 );
 jar.delete('huriza_session');
 jar.delete('huriza_phone_session');
 jar.delete('huriza_local_demo');
 jar.set(COOKIE,session,{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'&&process.env.COOKIE_SECURE!=='false',maxAge:MAX_AGE,path:'/'});
 return user;
}
export async function createLocalDemoSession(workspace:'personal'|'groups'|'fundraising'|'cooperative'){
 if(!localDemoEnabled())throw new DomainError('Local demo access is unavailable.',404);
 const db=await getDb();
 const uid=`local-demo-${workspace}`;
 const user=await ensureFirebaseAccount(db,{uid,email:`${uid}@example.invalid`,name:`Demo ${workspace}`,emailVerified:true},workspace);
 await db.query('UPDATE account_profiles SET is_test_account=true WHERE user_id=$1',[uid]);
 const token=randomBytes(32).toString('hex');
 await db.query("INSERT INTO sessions(token_hash,user_id,tenant_id,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[digest(token),uid,user.tenantId]);
 const jar=await cookies();
 jar.delete(COOKIE);jar.delete('huriza_phone_session');
 jar.set('huriza_local_demo',token,{httpOnly:true,sameSite:'lax',secure:false,maxAge:MAX_AGE,path:'/'});
}
export async function signOut(){
 const jar=await cookies();
 const demoSession=jar.get('huriza_local_demo')?.value;
 const session=jar.get(COOKIE)?.value;
 const db=await getDb();
 if(demoSession)await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(demoSession)]);
 if(session)await db.query('DELETE FROM firebase_sessions WHERE token_hash=$1',[digest(session)]);
 const phoneSession=jar.get('huriza_phone_session')?.value;
 if(phoneSession)await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(phoneSession)]);
 jar.delete(COOKIE);
 jar.delete('huriza_local_demo');
 jar.delete('huriza_phone_session');
 jar.delete('huriza_session');
}
