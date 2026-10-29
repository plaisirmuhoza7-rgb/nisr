import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {firebaseAdminAuth,firebaseProjectId,isAuthEmulator} from '../src/server/firebase-admin';
loadEnvConfig(process.cwd());
const base=process.env.HURIZA_BASE_URL||'http://127.0.0.1:3000';
const emulator=()=>`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
type TestAccount={email:string;password:string;role:string;uid:string};
class Client{
 cookie='';
 async call(path:string,body?:unknown,expected=200){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:base}),...(this.cookie?{Cookie:this.cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await response.text();let json:Record<string,any>;try{json=JSON.parse(raw);}catch{throw new Error(`Non-JSON response from ${path}: ${raw.slice(0,100)}`);}assert.equal(response.status,expected,`${path}: ${raw}`);const cookie=response.headers.getSetCookie().find(value=>value.startsWith('huriza_firebase_session='));if(cookie){assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=lax/i);this.cookie=cookie.split(';')[0];}return json;}
 async login(account:{email:string;password:string},expected=200){const response=await fetch(emulator()+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...account,returnSecureToken:true})});const token=await response.json();assert.equal(response.status,200,'Local Firebase email/password sign-in failed.');return this.call('/api/session',{idToken:token.idToken},expected);}
 state(workspace='personal'){return this.call('/api/state?workspace='+workspace);}
 act(action:string,input:Record<string,unknown>={},expected=200){return this.call('/api/actions',{action,...input},expected);}
}
async function verify(){
 if(!isAuthEmulator()||!firebaseProjectId()?.startsWith('demo-'))throw new Error('Local Firebase Auth emulator required. This script never creates live users.');
 const fixtures=JSON.parse(await readFile('.local/firebase-test-accounts.json','utf8')) as {accounts:TestAccount[]};
 const fixture=(role:string)=>{const found=fixtures.accounts.find(a=>a.role===role);if(!found)throw new Error('Missing local fixture.');return found;};
 const admin=firebaseAdminAuth();let checks=0;const anonymous=new Client();
 await anonymous.call('/api/state?workspace=personal',undefined,401);await anonymous.call('/api/session',{role:'president'},400);await anonymous.call('/api/session',{idToken:'fabricated-token-that-is-not-valid'},401);checks++;
 const csrf=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({role:'ngo'})});assert.equal(csrf.status,403);checks++;
 const redirected=await fetch(base+'/app/groups',{redirect:'manual'});assert.equal(redirected.status,307);assert.match(redirected.headers.get('location')||'',/^\/login\?/);checks++;
 const suffix=randomUUID().slice(0,8),password='Local-Account-2026!';const newEmail=`new-${suffix}@example.test`;
 const signup=await fetch(emulator()+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:newEmail,password,returnSecureToken:true})});assert.equal(signup.status,200);const signupResult=await signup.json();
 const a=new Client();await a.call('/api/session',{idToken:signupResult.idToken},403);checks++;
 await admin.updateUser(signupResult.localId,{emailVerified:true,displayName:'New Personal Account'});
 const signed=await a.login({email:newEmail,password});assert.equal(signed.user.role,'member');assert.deepEqual(signed.user.workspaces,['personal','guardian','simulator']);assert.equal(signed.user.homeWorkspace,'personal');const state=await a.state();assert.deepEqual(state.goals,[]);assert.deepEqual(state.loans,[]);assert.deepEqual(state.campaigns,[]);assert.equal(state.treasury.cash,0);checks++;
 await a.call('/api/state?workspace=impact',undefined,403);await a.call('/api/state?workspace=groups',undefined,403);await a.act('requestLoan',{amount:1000,months:1,role:'president'},403);await a.act('createCampaign',{title:'Forbidden',target:50000,description:'No authority',category:'Education'},403);await a.act('resetDemo',{},400);checks++;
 const deniedExport=await fetch(base+'/api/export?type=group',{headers:{Cookie:a.cookie}});assert.equal(deniedExport.status,403);const deniedRoute=await fetch(base+'/app/impact',{headers:{Cookie:a.cookie},redirect:'manual'});assert.equal(deniedRoute.status,307);assert.equal(deniedRoute.headers.get('location'),'/app');checks++;
 const goal=(await a.act('createGoal',{name:'Private savings plan',target:100000,saved:0,deadline:'2027-06-01'})).result;await a.act('addGoalSavings',{goalId:goal.id,amount:10000});assert.equal((await a.state()).goals[0].saved,10000);checks++;
 const other=await admin.createUser({email:`other-${suffix}@example.test`,password,emailVerified:true,displayName:'Other Personal Account'});const b=new Client();const otherLogin=await b.login({email:other.email!,password});assert.notEqual(otherLogin.user.tenantId,signed.user.tenantId);assert.deepEqual((await b.state()).goals,[]);await b.act('addGoalSavings',{goalId:goal.id,amount:1},404);checks++;
 const clients:Record<string,Client>={};
 for(const role of ['member','president','treasurer','cooperative','ngo']){const client=new Client();const user=(await client.login(fixture(role))).user;assert.equal(user.role,role);assert.equal(user.id,fixture(role).uid);assert.equal(user.homeWorkspace,role==='ngo'?'impact':role==='cooperative'?'cooperative':role==='president'||role==='treasurer'?'groups':'personal');clients[role]=client;}checks++;
 const member=clients.member,president=clients.president,treasurer=clients.treasurer,ngo=clients.ngo,coop=clients.cooperative;
 assert.ok((await member.state()).contributions.every((c:any)=>c.member==='Aline Uwase'));const officerPersonal=await president.state();assert.equal(officerPersonal.ledger.length,0);assert.ok(officerPersonal.contributions.every((c:any)=>c.member==='Jean Mugisha'));assert.ok(officerPersonal.loans.every((l:any)=>l.userId==='president'));checks++;
 // Fixture-only cleanup keeps repeated verification runs independent of prior test loans.
 for(const previous of (await member.state()).loans){if(previous.status==='active'){const paid=previous.schedule.reduce((sum:number,row:any)=>sum+row.paid,0);const remaining=previous.amount-paid;if(remaining>0)await member.act('repay',{loanId:previous.id,amount:remaining,outcome:'success',reference:'cleanup-'+suffix+'-'+previous.id});}}
 const groupBefore=await member.state('groups'),reference='firebase-'+suffix;await member.act('contribute',{amount:10000,outcome:'success',reference});const loan=(await member.act('requestLoan',{amount:150000,months:3})).result;await member.act('approveLoan',{loanId:loan.id,decision:'approve'},403);await treasurer.act('approveLoan',{loanId:loan.id,decision:'approve'},403);checks++;
 const payment=(await president.act('approveLoan',{loanId:loan.id,decision:'approve'})).result;assert.equal((await member.state('groups')).treasury.pending,150000);await president.act('confirmPayment',{paymentId:payment.id,outcome:'success'});await president.act('confirmPayment',{paymentId:payment.id,outcome:'success'});assert.equal((await member.state('groups')).treasury.cash,groupBefore.treasury.cash+10000-150000);await member.act('repay',{loanId:loan.id,amount:50000,outcome:'success',reference:reference+'-repay'});assert.equal((await member.state()).member.outstanding,100000);checks++;
 const impact=await ngo.state('impact');assert.equal(impact.loans.length,0);assert.equal(impact.contributions.length,0);assert.equal(impact.ledger.length,0);assert.ok(impact.impact.groups>=1);await ngo.call('/api/state?workspace=groups',undefined,403);await member.call('/api/state?workspace=impact',undefined,403);const coopState=await coop.state('cooperative');assert.ok(coopState.cooperative.cash>0);await coop.call('/api/state?workspace=groups',undefined,403);checks++;
 for(const [client,type] of [[president,'group'],[ngo,'impact']] as const){const report=await fetch(base+'/api/export?type='+type,{headers:{Cookie:client.cookie}});assert.equal(report.status,200);assert.match(report.headers.get('content-type')||'',/text\/csv/);assert.ok((await report.text()).split('\r\n').length>2);}checks++;
 const keepCookie=a.cookie;const logout=await fetch(base+'/api/session',{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json',Cookie:a.cookie},body:'{}'});assert.equal(logout.status,200);a.cookie=keepCookie;await a.call('/api/state?workspace=personal',undefined,401);checks++;
 await admin.updateUser(other.uid,{disabled:true});await b.call('/api/state?workspace=personal',undefined,401);checks++;
 for(const route of ['/','/login','/signup?workspace=cooperative','/forgot-password','/verify-email','/insights','/methodology','/solutions']){const response=await fetch(base+route);assert.equal(response.status,200,route);}checks++;
 console.log(`Firebase verification passed: ${checks} integration checks. Separate accounts, verified email, blocked role spoofing, personal privacy, organization permissions, officer approvals, logout, disabled users, financial flows, and public routes verified against the local Firebase Authentication Emulator.`);
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
