import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {DomainError} from './permissions';
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
  const email=process.env.FIREBASE_CLIENT_EMAIL,key=process.env.FIREBASE_PRIVATE_KEY;
  app=initializeApp({projectId,...(emulator?{}:{credential:email&&key?cert({projectId,clientEmail:email,privateKey:key.replace(/\\n/g,'\n')}):applicationDefault()})},'huriza-server');
 }
 return getAuth(app);
}
