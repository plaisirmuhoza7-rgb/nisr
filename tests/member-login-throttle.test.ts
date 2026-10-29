import test from 'node:test';
import assert from 'node:assert/strict';
import {MEMBER_LOGIN_BLOCKED_MESSAGE,MemberLoginThrottle} from '../src/server/member-login-throttle';

function clock(){let now=1_000;return {now:()=>now,advance:(ms:number)=>{now+=ms;}};}

test('per-phone threshold blocks at the limit and expires exactly at the window boundary',()=>{
 const time=clock(),throttle=new MemberLoginThrottle({clock:time.now,perPhoneLimit:2,perPhoneWindowMs:1_000,globalLimit:20,globalWindowMs:10_000});
 assert.equal(throttle.check('+250781234567').blocked,false);
 throttle.recordAttempt('+250781234567',false);
 assert.equal(throttle.check('+250781234567').blocked,false);
 throttle.recordAttempt('+250781234567',false);
 const blocked=throttle.check('+250781234567');
 assert.deepEqual(blocked,{blocked:true,retryAfterMs:1_000,message:MEMBER_LOGIN_BLOCKED_MESSAGE});
 time.advance(999);assert.equal(throttle.check('+250781234567').blocked,true);
 time.advance(1);assert.equal(throttle.check('+250781234567').blocked,false);
});

test('global failed-attempt threshold blocks distinct phones with the same generic response',()=>{
 const time=clock(),throttle=new MemberLoginThrottle({clock:time.now,perPhoneLimit:9,perPhoneWindowMs:10_000,globalLimit:2,globalWindowMs:500});
 throttle.recordAttempt('phone-a',false);throttle.recordAttempt('phone-b',false);
 const a=throttle.check('phone-c'),b=throttle.check('phone-d');
 assert.equal(a.blocked,true);assert.equal(b.blocked,true);
 assert.equal(a.message,b.message);assert.equal(a.message,MEMBER_LOGIN_BLOCKED_MESSAGE);
 time.advance(500);assert.equal(throttle.check('phone-c').blocked,false);
});

test('successful attempts do not increase phone or global failure counts',()=>{
 const time=clock(),throttle=new MemberLoginThrottle({clock:time.now,perPhoneLimit:1,globalLimit:1});
 throttle.recordAttempt('phone-a',true);
 assert.equal(throttle.check('phone-a').blocked,false);
 assert.equal(throttle.check('phone-b').blocked,false);
 throttle.recordAttempt('phone-a',false);
 assert.equal(throttle.check('phone-a').blocked,true);
 assert.equal(throttle.check('phone-b').blocked,true);
});

test('expired phone entries are cleaned and a full key cap fails closed until cleanup',()=>{
 const time=clock(),throttle=new MemberLoginThrottle({clock:time.now,perPhoneLimit:2,perPhoneWindowMs:100,globalLimit:100,globalWindowMs:10_000,maxPhoneKeys:2});
 throttle.recordAttempt('phone-a',false);throttle.recordAttempt('phone-b',false);
 const denied=throttle.check('phone-c');assert.equal(denied.blocked,true);
 assert.equal(denied.message,MEMBER_LOGIN_BLOCKED_MESSAGE);
 time.advance(100);
 assert.equal(throttle.check('phone-c').blocked,false);
 throttle.recordAttempt('phone-c',false);
 assert.equal(throttle.check('phone-c').blocked,false);
});

test('keeps at most the configured number of phone keys under high-cardinality attempts',()=>{
 const throttle=new MemberLoginThrottle({perPhoneLimit:10,globalLimit:100,maxPhoneKeys:3});
 for(let i=0;i<20;i++)throttle.recordAttempt(`phone-${i}`,false);
 assert.equal(throttle.check('phone-new').blocked,true);
});

test('rejects invalid identifiers and invalid configuration',()=>{
 assert.throws(()=>new MemberLoginThrottle({globalLimit:0}),RangeError);
 const throttle=new MemberLoginThrottle();
 assert.throws(()=>throttle.check(''),TypeError);
 assert.throws(()=>throttle.recordAttempt('x'.repeat(65),false),TypeError);
});
