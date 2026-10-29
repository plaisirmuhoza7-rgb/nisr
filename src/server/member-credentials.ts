import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';

const SALT_BYTES=16;
const KEY_BYTES=64;
const SCRYPT_OPTIONS={N:1<<14,r:8,p:1,maxmem:64*1024*1024} as const;
function deriveKey(password:string,salt:Buffer):Promise<Buffer>{
 return new Promise((resolve,reject)=>scryptCallback(password,salt,KEY_BYTES,SCRYPT_OPTIONS,(error,key)=>error?reject(error):resolve(key)));
}

/** Normalize common Rwandan mobile formats to E.164. Other or incomplete forms are rejected. */
export function normalizeRwandaPhone(value:string):string{
 if(typeof value!=='string')throw new TypeError('Phone number must be text.');
 const input=value.trim();
 const compact=input.replace(/[\s()-]/g,'');
 if(/^07\d{8}$/.test(compact))return `+250${compact.slice(1)}`;
 if(/^\+2507\d{8}$/.test(compact))return compact;
 throw new TypeError('Enter a Rwanda mobile number as 07XXXXXXXX or +2507XXXXXXXX.');
}

function validatePassword(password:string):void{
 if(typeof password!=='string'||password.length<6||password.length>128)throw new TypeError('Member password must be between 6 and 128 characters.');
}

/** Persist the returned versioned string as a credential verifier; never store the password itself. */
export async function hashMemberPassword(password:string):Promise<string>{
 validatePassword(password);
 const salt=randomBytes(SALT_BYTES);
 const key=await deriveKey(password,salt);
 return `scrypt$v1$${salt.toString('hex')}$${key.toString('hex')}`;
}

function parseHash(encoded:string):{salt:Buffer;key:Buffer}|null{
 if(typeof encoded!=='string'||encoded.length>256)return null;
 const parts=encoded.split('$');
 if(parts.length!==4||parts[0]!=='scrypt'||parts[1]!=='v1')return null;
 const [, ,saltHex,keyHex]=parts;
 if(!/^[a-f0-9]{32}$/.test(saltHex)||!/^[a-f0-9]{128}$/.test(keyHex))return null;
 const salt=Buffer.from(saltHex,'hex'),key=Buffer.from(keyHex,'hex');
 if(salt.length!==SALT_BYTES||key.length!==KEY_BYTES)return null;
 return {salt,key};
}

/** Return false for malformed stored credentials so corrupt data cannot authenticate. */
export async function verifyMemberPassword(password:string,encoded:string):Promise<boolean>{
 if(typeof password!=='string'||password.length>128)return false;
 const parsed=parseHash(encoded);
 if(!parsed)return false;
 const candidate=await deriveKey(password,parsed.salt);
 return timingSafeEqual(candidate,parsed.key);
}
