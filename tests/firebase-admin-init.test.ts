import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteApp,getApps} from 'firebase-admin/app';
import {firebaseAdminAuth} from '../src/server/firebase-admin';

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
