import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireActor} from '@/server/auth';
import {getDb} from '@/server/db';
import {apiError, checkMutation} from '@/server/http';
import {DomainError} from '@/server/permissions';
import {availablePersonalSheetOrganizations, choosePersonalSheetDestination, clearPersonalSheetDestination} from '@/server/sheets/personal-destinations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control': 'no-store'};

export async function GET() {
  try {
    const actor = await requireActor();
    return NextResponse.json({organizations: await availablePersonalSheetOrganizations(await getDb(), actor)}, {headers});
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    checkMutation(request);
    const body = await request.text();
    if (body.length > 2048) throw new DomainError('Request is too large.', 413);
    const input = z.object({organizationId: z.string().trim().min(1).max(200)}).strict().parse(JSON.parse(body));
    const actor = await requireActor();
    await choosePersonalSheetDestination(await getDb(), actor, input.organizationId);
    return NextResponse.json({ok: true}, {headers});
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({error: 'Invalid JSON.'}, {status: 400, headers});
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    checkMutation(request);
    const actor = await requireActor();
    await clearPersonalSheetDestination(await getDb(), actor);
    return NextResponse.json({ok: true}, {headers});
  } catch (error) { return apiError(error); }
}
