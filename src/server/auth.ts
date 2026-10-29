import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {getDb} from './db';
import {DomainError} from './permissions';
import {firebaseAdminAuth,firebaseAdminConfigured} from './firebase-admin';
import {ensureFirebaseAccount,readAccount} from './accounts';
import type {Actor} from '@/lib/contracts';
import type {AccountUser} from '@/lib/access';
const COOKIE='huriza_firebase_session';
const MAX_AGE=8*60*60;
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function currentUser():Promise<AccountUser|null>{
 const jar=await cookies();
 const cookie=jar.get(COOKIE)?.value;
 const db=await getDb();
 if(cookie&&cookie.length<=10000&&firebaseAdminConfigured()){
  const row=(await db.query('SELECT user_id FROM firebase_sessions WHERE token_hash=$1 AND expires_at>now()',[digest(cookie)])).rows[0];
  if(row){
   try{
    const claims=await firebaseAdminAuth().verifySessionCookie(cookie,true);
    if(claims.uid===row.user_id&&claims.email_verified===true){
     return readAccount(db,claims.uid,true);
    }
   }catch(error){
    const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';
    if(code.startsWith('auth/')&&!['auth/invalid-credential','auth/internal-error'].includes(code))return null;
    throw error;
   }
  }
 }
 const phoneCookie=jar.get('huriza_phone_session')?.value;
 if(phoneCookie&&phoneCookie.length<=1000){
  const row=(await db.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[digest(phoneCookie)])).rows[0];
  if(row) return readAccount(db,String(row.user_id),true);
 }
 return null;
}
export async function requireAccount():Promise<AccountUser>{const user=await currentUser();if(!user)throw new DomainError('Please sign in to your account.',401);return user;}
export async function requireActor():Promise<Actor>{const user=await requireAccount();return {tenantId:user.tenantId,userId:user.id,role:user.role};}
export async function createFirebaseSession(idToken:string,workspace?:import('@/lib/access').Workspace):Promise<AccountUser>{
 const auth=firebaseAdminAuth();let claims;
 try{claims=await auth.verifyIdToken(idToken,true);}catch{throw new DomainError('Your sign-in could not be verified. Please sign in again.',401);}
 const age=Math.floor(Date.now()/1000)-claims.auth_time;
 if(age< -60||age>300)throw new DomainError('Please sign in again to start a fresh secure session.',401);
 if(claims.email_verified!==true||!claims.email)throw new DomainError('Verify your email address before signing in.',403);
 const db=await getDb();const user=await ensureFirebaseAccount(db,{uid:claims.uid,email:claims.email,name:typeof claims.name==='string'?claims.name:undefined,emailVerified:true},workspace);
 const session=await auth.createSessionCookie(idToken,{expiresIn:MAX_AGE*1000});
 const jar=await cookies();const old=jar.get(COOKIE)?.value;
 await db.transaction(async tx=>{
  if(old)await tx.query('DELETE FROM firebase_sessions WHERE token_hash=$1',[digest(old)]);
  await tx.query('INSERT INTO firebase_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'8 hours\') ON CONFLICT(token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at',[digest(session),user.id]);
 });
 jar.delete('huriza_session');
 jar.set(COOKIE,session,{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'&&process.env.COOKIE_SECURE!=='false',maxAge:MAX_AGE,path:'/'});
 return user;
}
export async function signOut(){
 const jar=await cookies();
 const session=jar.get(COOKIE)?.value;
 const db=await getDb();
 if(session)await db.query('DELETE FROM firebase_sessions WHERE token_hash=$1',[digest(session)]);
 const phoneSession=jar.get('huriza_phone_session')?.value;
 if(phoneSession)await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(phoneSession)]);
 jar.delete(COOKIE);
 jar.delete('huriza_phone_session');
 jar.delete('huriza_session');
}
