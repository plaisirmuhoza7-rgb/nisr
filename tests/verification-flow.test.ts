import test from 'node:test';
import assert from 'node:assert/strict';
import {finishEmailVerification} from '../src/lib/verification-flow';

test('verification reloads and only redirects after a verified user signs out',async()=>{
 const events:string[]=[];
 const user={emailVerified:false,async reload(){events.push('reload');this.emailVerified=true;}};
 await finishEmailVerification(user,async()=>{events.push('signout');},()=>{events.push('redirect');},{missing:'missing',unverified:'unverified'});
 assert.deepEqual(events,['reload','signout','redirect']);
});

test('unverified or missing user stays on verification page',async()=>{
 const events:string[]=[];
 const callbacks=[async()=>{events.push('signout');},()=>{events.push('redirect');}] as const;
 const errors={missing:'missing',unverified:'unverified'};
 await assert.rejects(finishEmailVerification({emailVerified:false,async reload(){events.push('reload');}},...callbacks,errors),/unverified/);
 await assert.rejects(finishEmailVerification(null,...callbacks,errors),/missing/);
 assert.deepEqual(events,['reload']);
});
