import {FUNDRAISING_ENABLED} from '@/lib/competition';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createLocalDemoSession,localDemoEnabled} from '@/server/auth';
import {apiError,checkMutation} from '@/server/http';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!localDemoEnabled())return NextResponse.json({error:'Not found'},{status:404});
 try{checkMutation(request);const {workspace}=z.object({workspace:z.enum(['personal','groups','fundraising','cooperative'])}).strict().parse(await request.json());if(workspace==='fundraising'&&!FUNDRAISING_ENABLED)return NextResponse.json({error:'Not found'},{status:404});await createLocalDemoSession(workspace);return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}
}
