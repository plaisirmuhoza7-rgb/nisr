import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser,createFirebaseSession,signOut} from '@/server/auth';
import {firebaseAdminConfigured,isAuthEmulator} from '@/server/firebase-admin';
import {apiError,checkMutation} from '@/server/http';
import {startGoogleSheetsRunner} from '@/server/sheets/runner';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json({user:await currentUser(),authConfigured:firebaseAdminConfigured(),authEmulator:isAuthEmulator()},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{checkMutation(request);const input=z.object({idToken:z.string().min(20).max(10000),workspace:z.enum(['personal','groups','fundraising','cooperative','impact']).optional()}).parse(await request.json());const user=await createFirebaseSession(input.idToken,input.workspace);if(process.env.HURIZA_SHEETS_PRIMARY==='true'&&process.env.HURIZA_SHEETS_AUTO_SYNC==='true')startGoogleSheetsRunner();return NextResponse.json({user},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function DELETE(request:Request){try{checkMutation(request);await signOut();return NextResponse.json({ok:true});}catch(error){return apiError(error);}}
