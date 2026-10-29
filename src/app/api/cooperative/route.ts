import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAccount} from '@/server/auth';
import {getDb} from '@/server/db';
import {createCooperative,joinCooperative} from '@/server/finance/service';
import {checkMutation,apiError} from '@/server/http';

export const runtime='nodejs';

const coopCreateSchema = z.object({
  name: z.string().trim().min(3).max(100),
  category: z.enum(['agriculture','processing','service','commercial','multipurpose']).default('agriculture'),
  district: z.string().trim().min(2).max(80),
  sector: z.string().trim().min(2).max(80).default(''),
  description: z.string().trim().max(500).default(''),
  contact: z.string().trim().max(50).default(''),
  registrationNumber: z.string().trim().max(50).optional(),
  nominalShareValue: z.number().int().min(100).max(10_000_000).default(10000),
  minSharesPerMember: z.number().int().min(1).max(1000).default(5),
  statutoryReserveBps: z.number().int().min(0).max(10000).default(2000),
  socialFundBps: z.number().int().min(0).max(10000).default(1000),
  dividendPoolBps: z.number().int().min(0).max(10000).default(4000),
  bonusPoolBps: z.number().int().min(0).max(10000).default(6000),
});

export async function POST(request:Request){try{
 checkMutation(request);
 const user=await requireAccount();
 const body=await request.json();
 const intent=z.discriminatedUnion('intent',[
   z.object({intent:z.literal('create')}).merge(coopCreateSchema),
   z.object({intent:z.literal('join'),orgId:z.string().trim().min(5)})
 ]).parse(body);
 const db=await getDb();

 if(intent.intent==='join') {
   return NextResponse.json({ok:true,result:await joinCooperative(db,{tenantId:user.tenantId,userId:user.id,role:user.role},intent.orgId)});
 }
 const result=await createCooperative(db,{tenantId:user.tenantId,userId:user.id,role:user.role},intent);
 return NextResponse.json({ok:true,result});
}catch(error){
 return apiError(error);
}}
