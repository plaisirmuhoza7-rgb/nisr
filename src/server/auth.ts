import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {getDb} from './db';
import {DomainError} from './permissions';
import {firebaseAdminAuth,firebaseAdminConfigured,hasAdminCredentials} from './firebase-admin';
import {ensureFirebaseAccount,readAccount} from './accounts';
import type {Actor} from '@/lib/contracts';
import type {AccountUser} from '@/lib/access';
const COOKIE='huriza_firebase_session';
const MAX_AGE=8*60*60;
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');

export async function verifyAuthToken(auth: import('firebase-admin/auth').Auth, token: string): Promise<import('firebase-admin/auth').DecodedIdToken> {
 if (hasAdminCredentials()) {
  try {
   return await auth.verifyIdToken(token, true);
  } catch (err) {
   console.warn('verifyIdToken with checkRevoked failed, falling back to signature verification:', err);
  }
 }
 return await auth.verifyIdToken(token, false);
}

export async function currentUser():Promise<AccountUser|null>{
 try {
  const jar=await cookies();
  const cookie=jar.get(COOKIE)?.value;
  const phoneCookie=jar.get('huriza_phone_session')?.value;
  if(!cookie && !phoneCookie) return null;
  const db=await getDb();
  if(cookie&&cookie.length<=10000&&firebaseAdminConfigured()){
   // Serverless without a persistent DATABASE_URL: each instance has its own in-memory DB, so the
   // session row written at login is not visible to other instances. Trust the verified token instead.
   const stateless=Boolean(process.env.VERCEL)&&!process.env.DATABASE_URL;
   let row=(await db.query('SELECT user_id FROM firebase_sessions WHERE token_hash=$1 AND expires_at>now()',[digest(cookie)])).rows[0];
   if(!row&&stateless){
    try{
     const c=await verifyAuthToken(firebaseAdminAuth(),cookie);
     if(c.email_verified===true&&c.email){
      await ensureFirebaseAccount(db,{uid:c.uid,email:c.email,name:typeof c.name==='string'?c.name:undefined,emailVerified:true});
      row={user_id:c.uid};
     }
    }catch{}
   }
   if(row){
    let claims: import('firebase-admin/auth').DecodedIdToken | null = null;
    const auth = firebaseAdminAuth();
    if (hasAdminCredentials()) {
     try{
      claims=await auth.verifySessionCookie(cookie,true);
     }catch(sessionErr){
      // Handled by token fallback below
     }
    }
    if (!claims) {
     try{
      claims=await verifyAuthToken(auth,cookie);
     }catch(error){
      claims=null;
     }
    }
    if(claims&&claims.uid===row.user_id&&claims.email_verified===true){
     return readAccount(db,claims.uid,true);
    }
   }
  }
  if(phoneCookie&&phoneCookie.length<=1000){
   const row=(await db.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',[digest(phoneCookie)])).rows[0];
   if(row) return readAccount(db,String(row.user_id),true);
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
 try{claims=await verifyAuthToken(auth,idToken);}catch{throw new DomainError('Your sign-in could not be verified. Please sign in again.',401);}
 const age=Math.floor(Date.now()/1000)-claims.auth_time;
 if(age< -300||age>7200)throw new DomainError('Please sign in again to start a fresh secure session.',401);
 if(claims.email_verified!==true||!claims.email)throw new DomainError('Verify your email address before signing in.',403);
 const db=await getDb();const user=await ensureFirebaseAccount(db,{uid:claims.uid,email:claims.email,name:typeof claims.name==='string'?claims.name:undefined,emailVerified:true},workspace);
 let session: string;
 if(hasAdminCredentials()){
  try{
   session=await auth.createSessionCookie(idToken,{expiresIn:MAX_AGE*1000});
  }catch(sessionErr){
   console.warn('createSessionCookie fallback to verified idToken:', sessionErr);
   session=idToken;
  }
 }else{
  session=idToken;
 }
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
