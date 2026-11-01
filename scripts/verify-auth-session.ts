import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {initializeApp as initializeClientApp,deleteApp as deleteClientApp} from 'firebase/app';
import {getAuth as getClientAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut as clientSignOut} from 'firebase/auth';
import {finishEmailVerification} from '../src/lib/verification-flow';

// Deliberately do not load .env.local: this check must never use live credentials.
async function main(){
 const projectId=process.env.FIREBASE_PROJECT_ID;
 const emulator=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 const base=new URL(process.env.HURIZA_BASE_URL||'http://127.0.0.1:3101');
 assert.ok(projectId?.startsWith('demo-'),'Explicit demo- project required.');
 assert.match(emulator||'',/^(127\.0\.0\.1|localhost):\d+$/,'Loopback Auth Emulator required.');
 assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'Local application required.');
 const app=initializeApp({projectId},'session-verification');
 const auth=getAuth(app),uids:string[]=[];
 const clientApp=initializeClientApp({projectId,apiKey:'demo-local',authDomain:'localhost'},'verification-flow-check');
 const clientAuth=getClientAuth(clientApp);
 connectAuthEmulator(clientAuth,`http://${emulator}`,{disableWarnings:true});
 let checks=0;
 const password='Local-Session-Test-2026!';
 async function call(method:string,body?:unknown,cookie?:string,origin=base.origin){
  return fetch(new URL('/api/session',base),{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 }
 async function signIn(email:string){
  const response=await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-local`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  assert.equal(response.status,200,'Emulator sign-in failed');
  return (await response.json()).idToken as string;
 }
 try{
  const user=await auth.createUser({email:`session-${randomUUID()}@example.test`,password,emailVerified:true});uids.push(user.uid);
  const unverified=await auth.createUser({email:`unverified-${randomUUID()}@example.test`,password,emailVerified:false});uids.push(unverified.uid);
  assert.equal((await call('POST',{idToken:await signIn(unverified.email!)})).status,403);checks++;
  const browserUser=(await signInWithEmailAndPassword(clientAuth,unverified.email!,password)).user;
  let redirected=false;
  const verify=()=>finishEmailVerification(browserUser,()=>clientSignOut(clientAuth),()=>{redirected=true;},{missing:'missing',unverified:'not yet verified'});
  await assert.rejects(verify(),/not yet verified/);
  assert.equal(redirected,false);assert.ok(clientAuth.currentUser);checks++;
  await auth.updateUser(unverified.uid,{emailVerified:true});
  await verify();
  assert.equal(redirected,true);assert.equal(clientAuth.currentUser,null);
  assert.equal((await (await call('GET')).json()).user,null);checks++;
  const token=await signIn(user.email!);
  assert.equal((await call('POST',{idToken:token},undefined,'https://untrusted.example')).status,403);checks++;
  const login=await call('POST',{idToken:token});
  assert.equal(login.status,200,await login.clone().text());
  const setCookie=login.headers.getSetCookie().find(c=>c.startsWith('huriza_firebase_session='));
  assert.ok(setCookie);assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Max-Age=28800/);
  const cookie=setCookie.split(';')[0];
  const session=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));
  const claims=await auth.verifySessionCookie(session,true);
  assert.equal(claims.uid,user.uid);assert.equal(claims.exp-claims.iat,28800);checks++;
  const current=await (await call('GET',undefined,cookie)).json();
  assert.equal(current.user?.id,user.uid);checks++;
  const state=await fetch(new URL('/api/state?workspace=personal',base),{headers:{Cookie:cookie}});
  assert.equal(state.status,200);assert.deepEqual((await state.json()).goals,[]);checks++;
  assert.equal((await call('DELETE',{},cookie)).status,200);
  assert.equal((await (await call('GET',undefined,cookie)).json()).user,null);checks++;
  const second=await call('POST',{idToken:await signIn(user.email!)});
  assert.equal(second.status,200);
  const secondCookie=second.headers.getSetCookie().find(c=>c.startsWith('huriza_firebase_session='))!.split(';')[0];
  await auth.updateUser(user.uid,{disabled:true});
  assert.equal((await (await call('GET',undefined,secondCookie)).json()).user,null);checks++;
  assert.equal((await call('POST',{idToken:token})).status,401);checks++;
  assert.equal((await call('POST',{idToken:'fabricated-token-that-is-not-valid'})).status,401);checks++;
  console.log(`Authentication session verification passed: ${checks} checks (verification-to-login flow, real emulator session cookie, unverified email, CSRF, account state, logout replay, disabled account and forged token).`);
 }finally{await deleteClientApp(clientApp);await Promise.all(uids.map(uid=>auth.deleteUser(uid)));await deleteApp(app);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
