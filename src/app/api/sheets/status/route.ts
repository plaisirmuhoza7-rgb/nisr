import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireActor} from '@/server/auth';
import {getDb} from '@/server/db';
import {apiError} from '@/server/http';
import {organizationSheetStatus} from '@/server/sheets/status';
import {sharedMasterViewStatus,startGoogleSheetsRunner} from '@/server/sheets/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const orgId = z.string().min(1).max(200).parse(new URL(request.url).searchParams.get('organizationId'));
    const actor = await requireActor();
    const db=await getDb();
    const organizationStatus = await organizationSheetStatus(db, actor, orgId);
    const shared=process.env.HURIZA_SHEETS_PRIMARY==='true' && process.env.HURIZA_SHEETS_AUTO_SYNC==='true';
    if(shared) startGoogleSheetsRunner();
    const status = shared ? await sharedMasterViewStatus(db) : organizationStatus;
    return NextResponse.json({status,mode:shared?'shared':'organization'}, {headers: {'Cache-Control':'no-store'}});
  } catch (error) { return apiError(error); }
}
