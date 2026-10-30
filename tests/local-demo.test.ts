import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDemoEnabled} from '../src/server/auth';

test('local demo requires development and no external data connections',()=>{
 const keys=['NODE_ENV','DATABASE_URL','HURIZA_SHEETS_PRIMARY','HURIZA_SHEETS_AUTO_SYNC','VERCEL','AWS_LAMBDA_FUNCTION_NAME'] as const;
 const env=process.env as Record<string,string|undefined>;
 const before=Object.fromEntries(keys.map(k=>[k,env[k]]));
 try {
  for(const k of keys)delete env[k];
  env.NODE_ENV='development';
  assert.equal(localDemoEnabled(),true);
  for(const [key,value] of [['NODE_ENV','production'],['DATABASE_URL','postgres://example'],['HURIZA_SHEETS_PRIMARY','true'],['HURIZA_SHEETS_AUTO_SYNC','true'],['VERCEL','1'],['AWS_LAMBDA_FUNCTION_NAME','x']] as const){
   const old=env[key];env[key]=value;assert.equal(localDemoEnabled(),false,key);if(old===undefined)delete env[key];else env[key]=old;
  }
 } finally {for(const k of keys){if(before[k]===undefined)delete env[k];else env[k]=before[k];}}
});

