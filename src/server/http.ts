import {NextResponse} from 'next/server';
import {DomainError} from './permissions';
import {ZodError} from 'zod';
const buckets=new Map<string,{count:number;until:number}>();
export function checkMutation(request:Request){
 const origin=request.headers.get('origin');let originHost='';
 try{const parsed=new URL(origin||'');if(parsed.protocol==='http:'||parsed.protocol==='https:')originHost=parsed.host;}catch{}
 const fHost=request.headers.get('x-forwarded-host');
 const rawHost=request.headers.get('host');
 let urlHost='';
 try{urlHost=new URL(request.url).host;}catch{}
 const matches = Boolean(originHost && (originHost === fHost || originHost === rawHost || originHost === urlHost));
 if(!matches)throw new DomainError('The request must originate from this application.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new DomainError('JSON request required.',415);
 const key=request.headers.get('x-forwarded-for')?.split(',')[0]||'local';const now=Date.now();const entry=buckets.get(key);
 if(!entry||entry.until<now){if(buckets.size>5000)buckets.clear();buckets.set(key,{count:1,until:now+60000});}
 else if(++entry.count>120)throw new DomainError('Too many requests. Please wait a minute.',429);
}
export function apiError(error:unknown){
 if(error instanceof ZodError)return NextResponse.json({error:error.issues.map(x=>x.message).join(' ')},{status:400});
 if(error instanceof DomainError)return NextResponse.json({error:error.message},{status:error.status});
 const message=error instanceof Error?error.message:'Unexpected error';
 if(/not allowed|permission|unauthorized|forbidden|not a member|membership role/i.test(message))return NextResponse.json({error:message},{status:403});
 if(/invalid|insufficient|cannot|not found|already|eligible|reserve|amount|pending|outstanding|must|only|policy|duplicate|unresolved|required|limit/i.test(message))return NextResponse.json({error:message},{status:400});
 console.error('HURIZA request failed:',error);return NextResponse.json({error:'The operation could not be completed. Please try again.'},{status:500});
}
