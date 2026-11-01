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

type AdminCredential = {projectId:string;clientEmail:string;privateKey:string};
export function resolveAdminCredential(projectId:string,env:Record<string,string|undefined>=process.env):AdminCredential|undefined {
 const convert=(sa:{client_email?:string;private_key?:string;project_id?:string}):AdminCredential=>{
  if(sa.project_id && sa.project_id!==projectId)throw new DomainError('Firebase service account project does not match the configured Firebase project.',503);
  return {projectId,clientEmail:sa.client_email!,privateKey:sa.private_key!.replace(/\\n/g,'\n')};
 };
 const inline=[env.GOOGLE_SERVICE_ACCOUNT_JSON,env.GOOGLE_APPLICATION_CREDENTIALS_JSON,env.FIREBASE_SERVICE_ACCOUNT_JSON,env.FIREBASE_SERVICE_ACCOUNT];
 let invalidInline=false;
 for(const raw of inline){if(raw){const sa=parseServiceAccountJson(raw);if(sa)return convert(sa);invalidInline=true;}}
 for(const [email,key] of [[env.GOOGLE_CLIENT_EMAIL,env.GOOGLE_PRIVATE_KEY],[env.FIREBASE_CLIENT_EMAIL,env.FIREBASE_PRIVATE_KEY]]){
  if(email&&key)return convert({client_email:email,private_key:key});
 }
 if(invalidInline)throw new DomainError('Firebase service account configuration is invalid.',503);
 const gac=env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
 if(!gac)return undefined; // Let the Admin SDK resolve platform ADC.
 const inlineGac=parseServiceAccountJson(gac);
 if(inlineGac)return convert(inlineGac);
 if(!existsSync(gac))throw new DomainError('The configured Google application credentials file does not exist. Configure valid server credentials or remove the stale path.',503);
 try{
  const contents=JSON.parse(readFileSync(gac,'utf8'));
  if(contents.client_email&&contents.private_key)return convert(contents);
  return undefined; // Other supported ADC credential files are handled by the SDK.
 }catch(error){if(error instanceof DomainError)throw error;throw new DomainError('Unable to read the configured Google application credentials.',503);}
}

export function hasAdminCredentials(): boolean {
 try{return Boolean(resolveAdminCredential(firebaseProjectId()||'',process.env));}catch{return false;}
}

export function firebaseAdminAuth(){
 const projectId=firebaseProjectId();if(!projectId)throw new DomainError('Account sign-in is being configured. Please try again later.',503);
 const emulator=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 if(emulator){
  if(!projectId.startsWith('demo-'))throw new DomainError('Local Authentication Emulator requires a demo- project ID; remove emulator settings for a live project.',503);
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(emulator))throw new DomainError('Firebase Authentication Emulator must use a loopback address.',503);
  if(process.env.NODE_ENV==='production'&&process.env.ALLOW_FIREBASE_EMULATOR!=='true')throw new DomainError('Firebase Authentication Emulator is disabled in production.',503);
 }
 let app=getApps().find(a=>a.name==='huriza-server');
 if(!app){
  const explicit=emulator?undefined:resolveAdminCredential(projectId);
  let credentialOption;
  try{credentialOption=explicit?cert(explicit):undefined;}
  catch{throw new DomainError('Firebase service account configuration is invalid. Check the server credentials.',503);}
  app=initializeApp({
   projectId,
   ...(emulator?{}:credentialOption?{credential:credentialOption}:{})
  },'huriza-server');
 }
 return getAuth(app);
}
