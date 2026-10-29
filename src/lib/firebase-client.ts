'use client';
import {getApps,initializeApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,type Auth} from 'firebase/auth';
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID};
export function firebaseClientConfigured(){return Boolean(config.apiKey&&config.projectId&&config.authDomain&&config.appId);}
export const firebaseEmulatorEnabled=()=>Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL);
let authInstance:Auth|undefined;
export function firebaseAuth():Auth {
 if(!firebaseClientConfigured())throw new Error('Account sign-in is being configured. Please try again later.');
 if(authInstance)return authInstance;
 const app=getApps().find(a=>a.name==='huriza-browser')||initializeApp(config,'huriza-browser');
 const auth=getAuth(app);const emulator=process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
 if(emulator){const url=new URL(emulator);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('The local authentication emulator must use a loopback address.');connectAuthEmulator(auth,url.origin,{disableWarnings:true});}
 authInstance=auth;return auth;
}
