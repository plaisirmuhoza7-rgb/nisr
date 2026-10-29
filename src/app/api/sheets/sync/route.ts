import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireActor} from '@/server/auth';
import {getDb} from '@/server/db';
import {apiError, checkMutation} from '@/server/http';
import {DomainError} from '@/server/permissions';
import {batchUpdateKnownTabRanges, requireManagedSetupTab} from '@/server/sheets/client';
import {syncSavingsGroupSummary} from '@/server/sheets/sync';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkMutation(request);
    const body = await request.text();
    if (body.length > 2048) throw new DomainError('Request is too large.', 413);
    const input = z.object({organizationId: z.string().min(7).max(106)}).strict().parse(JSON.parse(body));
    const actor = await requireActor();
    await syncSavingsGroupSummary(await getDb(), actor, input.organizationId, async (id, updates, ranges) => {
      await requireManagedSetupTab(id);
      await batchUpdateKnownTabRanges(id, updates, ranges);
    });
    return NextResponse.json({ok: true, simulated: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({error: 'Invalid JSON.'}, {status: 400});
    return apiError(error);
  }
}
