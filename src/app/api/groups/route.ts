import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAccount} from '@/server/auth';
import {getDb} from '@/server/db';
import {createSavingsGroup,joinSavingsGroup} from '@/server/finance/service';
import {checkMutation,apiError} from '@/server/http';
import {groupCreateSchema} from '@/lib/group-create-schema';

export const runtime='nodejs';
export async function POST(request:Request){try{
 checkMutation(request);const user=await requireAccount();const body=await request.json();const intent=z.discriminatedUnion('intent',[z.object({intent:z.literal('create')}).merge(groupCreateSchema),z.object({intent:z.literal('join'),inviteCode:z.string().trim().regex(/^[A-Z0-9]{24}$/)})]).parse(body);const db=await getDb();
 if(intent.intent==='join')return NextResponse.json({ok:true,result:await joinSavingsGroup(db,{tenantId:user.tenantId,userId:user.id,role:user.role},intent.inviteCode)});
 const result=await createSavingsGroup(db,{tenantId:user.tenantId,userId:user.id,role:user.role},{...intent,accepted:true});return NextResponse.json({ok:true,result});
 }catch(error){
  if(error instanceof z.ZodError) console.warn('Group request validation failed:',error.issues.map(issue=>({field:issue.path.join('.'),code:issue.code})));
  else if(error && typeof error==='object' && 'code' in error && typeof error.code==='string' && /^[0-9A-Z]{5}$/.test(error.code)) console.warn('Group request database error:',error.code);
  return apiError(error);
 }}
