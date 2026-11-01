import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteApp,getApps} from 'firebase-admin/app';
import {firebaseAdminAuth,resolveAdminCredential} from '../src/server/firebase-admin';

test('inline and paired credential aliases take priority over a stale credentials path',()=>{
 const json=JSON.stringify({project_id:'project',client_email:'service@example.test',private_key:'line1\\nline2'});
 for(const name of ['GOOGLE_SERVICE_ACCOUNT_JSON','GOOGLE_APPLICATION_CREDENTIALS_JSON','FIREBASE_SERVICE_ACCOUNT_JSON','FIREBASE_SERVICE_ACCOUNT']){
  const env={[name]:json,GOOGLE_APPLICATION_CREDENTIALS:'missing-file.json'};
  assert.deepEqual(resolveAdminCredential('project',env),{projectId:'project',clientEmail:'service@example.test',privateKey:'line1\nline2'});
  assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS,'missing-file.json');
 }
 for(const prefix of ['GOOGLE','FIREBASE']){
  assert.equal(resolveAdminCredential('project',{[`${prefix}_CLIENT_EMAIL`]:'service@example.test',[`${prefix}_PRIVATE_KEY`]:'key',GOOGLE_APPLICATION_CREDENTIALS:'missing-file.json'})?.clientEmail,'service@example.test');
 }
 assert.equal(resolveAdminCredential('project',{}),undefined);
 assert.throws(()=>resolveAdminCredential('project',{GOOGLE_APPLICATION_CREDENTIALS:'missing-file.json'}),/credentials file does not exist/);
 assert.throws(()=>resolveAdminCredential('other',{GOOGLE_SERVICE_ACCOUNT_JSON:json}),/does not match/);
});

test('emulator ignores inherited live credential settings without changing them',async()=>{
 const names=['FIREBASE_PROJECT_ID','FIREBASE_AUTH_EMULATOR_HOST','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_SERVICE_ACCOUNT','NODE_ENV'] as const;
 const old=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try{
  process.env.FIREBASE_PROJECT_ID='demo-huriza';
  process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
  process.env.GOOGLE_APPLICATION_CREDENTIALS='missing-inherited-credentials.json';
  process.env.FIREBASE_SERVICE_ACCOUNT='invalid-inherited-account';
  Reflect.set(process.env,'NODE_ENV','test');
  assert.equal(firebaseAdminAuth().app.options.projectId,'demo-huriza');
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,'missing-inherited-credentials.json');
  assert.equal(process.env.FIREBASE_SERVICE_ACCOUNT,'invalid-inherited-account');
 } finally {
  const app=getApps().find(item=>item.name==='huriza-server');
  if(app)await deleteApp(app);
  for(const name of names){if(old[name]===undefined)Reflect.deleteProperty(process.env,name);else Reflect.set(process.env,name,old[name]);}
 }
});
