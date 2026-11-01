import test from 'node:test';
import assert from 'node:assert/strict';
import type {DecodedIdToken} from 'firebase-admin/auth';
import {createSessionCookie,resolveStoredFirebaseSession,verifiedSessionClaims,verifyAuthToken} from '../src/server/firebase-session-policy';

const claims={uid:'user-1',email_verified:true} as DecodedIdToken;

test('ID token verification always checks revocation and never retries a rejected token',async()=>{
 const calls: unknown[][]=[];
 const auth={verifyIdToken:async (...args: [string, boolean?])=>{calls.push(args);throw new Error('revoked');}};
 await assert.rejects(verifyAuthToken(auth,'id-token'),/revoked/);
 assert.deepEqual(calls,[['id-token',true]]);
});

test('deleted session is rejected after its lookup without Firebase verification or reprovisioning',async()=>{
 let lookups=0;
 let adminAccesses=0;
 const result=await resolveStoredFirebaseSession('previously-valid-session',async()=>{lookups++;return undefined;},()=>{adminAccesses++;throw new Error('must not authenticate or reprovision');});
 assert.equal(result,null);
 assert.equal(lookups,1);
 assert.equal(adminAccesses,0);
});

test('session creation requires a real session cookie and propagates failures',async()=>{
 const calls: unknown[][]=[];
 const auth={createSessionCookie:async (...args: [string,{expiresIn:number}])=>{calls.push(args);throw new Error('credential failure');}};
 await assert.rejects(createSessionCookie(auth,'id-token',28800),/credential failure/);
 assert.deepEqual(calls,[['id-token',{expiresIn:28800000}]]);
});

test('session requires a matching stored user and revocation-checked verified email',async()=>{
 let calls=0;
 const auth={verifySessionCookie:async (cookie:string,checkRevoked?:boolean)=>{calls++;assert.equal(cookie,'session');assert.equal(checkRevoked,true);return claims;}};
 assert.equal(await verifiedSessionClaims(auth,'session',undefined),null);
 assert.equal(calls,0);
 assert.equal(await verifiedSessionClaims(auth,'session','different-user'),null);
 assert.equal(await verifiedSessionClaims(auth,'session','user-1'),claims);
 assert.equal(await verifiedSessionClaims({verifySessionCookie:async()=>({...claims,email_verified:false})},'session','user-1'),null);
 assert.equal(await verifiedSessionClaims({verifySessionCookie:async()=>{throw new Error('revoked');}},'session','user-1'),null);
});
