import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {ensureFirebaseAccount,readAccount} from '../src/server/accounts';
import {submitWorkspaceRequest,workspaceRequests} from '../src/server/onboarding';
import type {AccountUser} from '../src/lib/access';
let pg:PGlite,db:Database,a:AccountUser,b:AccountUser;
before(async()=>{
 pg=new PGlite();await pg.waitReady;
 db={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)}))};
 for(const migration of ['001-identity.sql','002-finance.sql','003-firebase-accounts.sql','004-dual-savings-groups.sql','005-workspace-onboarding.sql','012-dedicated-workspace.sql'])await db.exec(await readFile('migrations/'+migration,'utf8'));
 a=await ensureFirebaseAccount(db,{uid:'onboarding-a',email:'onboarding-a@example.test',emailVerified:true});
 b=await ensureFirebaseAccount(db,{uid:'onboarding-b',email:'onboarding-b@example.test',emailVerified:true});
});
after(async()=>{await pg?.close();});
const request={purpose:'impact',organizationName:'Synthetic Community Program',district:'Gasabo',description:'Synthetic organization request for aggregate reporting tools.'};
test('organization onboarding persists an idempotent own request without assigning privileges',async()=>{
 const owner={userId:a.id,tenantId:a.tenantId};
 const saved=await submitWorkspaceRequest(db,owner,request);
 assert.equal(saved.status,'submitted');assert.equal(saved.purpose,'impact');
 assert.equal((await submitWorkspaceRequest(db,owner,request)).id,saved.id);
 assert.equal((await workspaceRequests(db,owner)).length,1);
 const account=await readAccount(db,a.id);assert.equal(account?.role,'member');assert.deepEqual(account?.memberships,[]);assert.deepEqual(account?.workspaces,['personal','guardian','simulator']);
});
test('organization requests reject identity injection and remain scoped to active account and tenant',async()=>{
 assert.deepEqual(await workspaceRequests(db,{userId:b.id,tenantId:b.tenantId}),[]);
 await assert.rejects(workspaceRequests(db,{userId:b.id,tenantId:a.tenantId}),/cannot submit/);
 await assert.rejects(submitWorkspaceRequest(db,{userId:a.id,tenantId:a.tenantId},{...request,userId:b.id,role:'ngo'}));
 await assert.rejects(submitWorkspaceRequest(db,{userId:a.id,tenantId:a.tenantId},{...request,purpose:'admin'}));
 await db.query("UPDATE account_profiles SET status='disabled' WHERE user_id=$1",[b.id]);
 await assert.rejects(submitWorkspaceRequest(db,{userId:b.id,tenantId:b.tenantId},request),/cannot submit/);
 assert.equal((await db.query('SELECT 1 FROM workspace_onboarding_requests WHERE tenant_id=$1 AND user_id=$2',[b.tenantId,b.id])).rows.length,0);
});
