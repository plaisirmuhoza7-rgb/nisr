import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {DomainError} from './permissions';
import {readFileSync,existsSync} from 'node:fs';

export function firebaseProjectId(){return process.env.FIREBASE_PROJECT_ID||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;}
export function firebaseAdminConfigured(){return Boolean(firebaseProjectId());}
export function isAuthEmulator(){return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);}

export function firebaseAdminAuth(){
 const projectId=firebaseProjectId();if(!projectId)throw new DomainError('Account sign-in is being configured. Please try again later.',503);
 const emulator=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 if(emulator){
  if(!projectId.startsWith('demo-'))throw new Error('Local Authentication Emulator requires a demo- project ID; remove emulator settings for a live project.');
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(emulator))throw new Error('Firebase Authentication Emulator must use a loopback address.');
  if(process.env.NODE_ENV==='production'&&process.env.ALLOW_FIREBASE_EMULATOR!=='true')throw new Error('Firebase Authentication Emulator is disabled in production.');
 }
 let app=getApps().find(a=>a.name==='huriza-server');
 if(!app){
  let credentialOption;
  const email=process.env.FIREBASE_CLIENT_EMAIL,key=process.env.FIREBASE_PRIVATE_KEY;
  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(email && key){
   credentialOption = cert({projectId,clientEmail:email,privateKey:key.replace(/\\n/g,'\n')});
  } else if (rawCreds && rawCreds.trim().startsWith('{')) {
   try {
    const sa = JSON.parse(rawCreds);
    if(sa.client_email && sa.private_key) {
     credentialOption = cert({projectId: sa.project_id || projectId, clientEmail: sa.client_email, privateKey: sa.private_key});
    }
   } catch {}
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
   const credVal = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
   if (credVal.startsWith('{')) {
    try {
     const sa = JSON.parse(credVal);
     if(sa.client_email && sa.private_key) {
      credentialOption = cert({projectId: sa.project_id || projectId, clientEmail: sa.client_email, privateKey: sa.private_key});
     }
    } catch {}
   } else if (existsSync(credVal)) {
    try {
     const sa = JSON.parse(readFileSync(credVal, 'utf8'));
     if(sa.client_email && sa.private_key) {
      credentialOption = cert({projectId: sa.project_id || projectId, clientEmail: sa.client_email, privateKey: sa.private_key});
     }
    } catch {}
   }
  }
  if(!credentialOption && !emulator){
   try {
    credentialOption = applicationDefault();
   } catch {
    credentialOption = undefined;
   }
  }
  app=initializeApp({
   projectId,
   ...(emulator?{}:credentialOption?{credential:credentialOption}:{})
  },'huriza-server');
 }
 return getAuth(app);
}
