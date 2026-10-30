import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {DomainError} from './permissions';
import {readFileSync,existsSync} from 'node:fs';

export function firebaseProjectId(){return process.env.FIREBASE_PROJECT_ID||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;}
export function firebaseAdminConfigured(){return Boolean(firebaseProjectId());}
export function isAuthEmulator(){return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);}

function parseServiceAccountJson(raw: string): { client_email?: string; private_key?: string; project_id?: string } | null {
  try {
    const trimmed = raw.trim();
    const str = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
    if (str.startsWith('{')) {
      const parsed = JSON.parse(str);
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function hasAdminCredentials(): boolean {
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) return true;
  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawCreds && parseServiceAccountJson(rawCreds)) return true;
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac) {
    if (parseServiceAccountJson(gac)) return true;
    const trimmed = gac.trim();
    if (existsSync(trimmed)) {
      try {
        const sa = JSON.parse(readFileSync(trimmed, 'utf8'));
        if (sa.client_email && sa.private_key) return true;
      } catch {}
    }
  }
  return false;
}

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
  } else if (rawCreds) {
   const sa = parseServiceAccountJson(rawCreds);
   if (sa?.client_email && sa?.private_key) {
    credentialOption = cert({projectId: sa.project_id || projectId, clientEmail: sa.client_email, privateKey: sa.private_key});
   }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
   const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
   const parsed = parseServiceAccountJson(gac);
   if (parsed?.client_email && parsed?.private_key) {
    credentialOption = cert({projectId: parsed.project_id || projectId, clientEmail: parsed.client_email, privateKey: parsed.private_key});
   } else {
    const trimmed = gac.trim();
    if (existsSync(trimmed)) {
     try {
      const sa = JSON.parse(readFileSync(trimmed, 'utf8'));
      if(sa.client_email && sa.private_key) {
       credentialOption = cert({projectId: sa.project_id || projectId, clientEmail: sa.client_email, privateKey: sa.private_key});
      }
     } catch {}
    } else {
      // Avoid google-auth-library failing on non-existent file path (e.g. Windows path deployed to Linux Vercel)
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
   }
  }
  app=initializeApp({
   projectId,
   ...(emulator?{}:credentialOption?{credential:credentialOption}:{})
  },'huriza-server');
 }
 return getAuth(app);
}
