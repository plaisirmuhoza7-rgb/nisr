import {createHash} from 'node:crypto';

export const MEMBER_LOGIN_BLOCKED_MESSAGE='Sign-in is temporarily unavailable. Please try again later.';

export interface MemberLoginThrottleOptions{
 clock?:()=>number;
 perPhoneLimit?:number;
 perPhoneWindowMs?:number;
 globalLimit?:number;
 globalWindowMs?:number;
 maxPhoneKeys?:number;
}
export interface ThrottleDecision{blocked:boolean;retryAfterMs:number;message?:string}

const positiveInteger=(value:number|undefined,fallback:number,name:string)=>{
 const resolved=value??fallback;
 if(!Number.isSafeInteger(resolved)||resolved<1)throw new RangeError(`${name} must be a positive safe integer.`);
 return resolved;
};

/** Single-process, bounded throttle. It is not shared across workers or restarts. */
export class MemberLoginThrottle{
 private readonly clock:()=>number;
 private readonly perPhoneLimit:number;
 private readonly perPhoneWindowMs:number;
 private readonly globalLimit:number;
 private readonly globalWindowMs:number;
 private readonly maxPhoneKeys:number;
 private readonly failuresByPhone=new Map<string,number[]>();
 private globalFailures:number[]=[];

 constructor(options:MemberLoginThrottleOptions={}){
  this.clock=options.clock??Date.now;
  this.perPhoneLimit=positiveInteger(options.perPhoneLimit,5,'perPhoneLimit');
  this.perPhoneWindowMs=positiveInteger(options.perPhoneWindowMs,15*60_000,'perPhoneWindowMs');
  this.globalLimit=positiveInteger(options.globalLimit,100,'globalLimit');
  this.globalWindowMs=positiveInteger(options.globalWindowMs,60_000,'globalWindowMs');
  this.maxPhoneKeys=positiveInteger(options.maxPhoneKeys,10_000,'maxPhoneKeys');
 }

 private phoneKey(phone:string):string{
  if(typeof phone!=='string'||phone.length<1||phone.length>64)throw new TypeError('Phone identifier must be a non-empty string.');
  // Store only a one-way digest; never log or retain the supplied phone number.
  return createHash('sha256').update(phone,'utf8').digest('hex');
 }

 private prune(now:number):void{
  this.globalFailures=this.globalFailures.filter(at=>now-at<this.globalWindowMs);
  for(const [key,times] of this.failuresByPhone){
   const current=times.filter(at=>now-at<this.perPhoneWindowMs);
   if(current.length)this.failuresByPhone.set(key,current);
   else this.failuresByPhone.delete(key);
  }
 }

 check(phone:string):ThrottleDecision{
  const key=this.phoneKey(phone),now=this.clock();this.prune(now);
  const phoneFailures=this.failuresByPhone.get(key)??[];
  const phoneBlocked=phoneFailures.length>=this.perPhoneLimit;
  const globalBlocked=this.globalFailures.length>=this.globalLimit;
  const capacityBlocked=!this.failuresByPhone.has(key)&&this.failuresByPhone.size>=this.maxPhoneKeys;
  if(!phoneBlocked&&!globalBlocked&&!capacityBlocked)return {blocked:false,retryAfterMs:0};
  const nextPhone=phoneBlocked?phoneFailures[0]+this.perPhoneWindowMs:0;
  const nextGlobal=globalBlocked?this.globalFailures[0]+this.globalWindowMs:0;
  const nextCapacity=capacityBlocked?Math.min(...Array.from(this.failuresByPhone.values(),times=>times[0]+this.perPhoneWindowMs)):0;
  const unlockAt=Math.max(nextPhone,nextGlobal,nextCapacity);
  return {blocked:true,retryAfterMs:Math.max(1,unlockAt-now),message:MEMBER_LOGIN_BLOCKED_MESSAGE};
 }

 /** Record failed attempts only; successful authentication does not alter failure counters. */
 recordAttempt(phone:string,succeeded:boolean):void{
  if(succeeded)return;
  const decision=this.check(phone);
  if(decision.blocked)return;
  const key=this.phoneKey(phone),now=this.clock();
  const failures=this.failuresByPhone.get(key)??[];
  if(failures.length<this.perPhoneLimit)failures.push(now);
  this.failuresByPhone.set(key,failures);
  if(this.globalFailures.length<this.globalLimit)this.globalFailures.push(now);
 }
}
