import {NextResponse} from 'next/server';
import {requireAccount} from '@/server/auth';
import {getDb} from '@/server/db';
import {submitWorkspaceRequest,workspaceRequests} from '@/server/onboarding';
import {apiError,checkMutation} from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await requireAccount();return NextResponse.json({requests:await workspaceRequests(await getDb(),{userId:user.id,tenantId:user.tenantId})},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{checkMutation(request);const user=await requireAccount();return NextResponse.json({request:await submitWorkspaceRequest(await getDb(),{userId:user.id,tenantId:user.tenantId},await request.json())});}catch(error){return apiError(error);}}
