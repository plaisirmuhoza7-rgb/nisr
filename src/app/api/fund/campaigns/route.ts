import { NextResponse } from 'next/server';
import { requireActor } from '@/server/auth';
import { getDb } from '@/server/db';
import { financeAction, seedFinance } from '@/server/finance/service';
import { loadFundDiscoveryState } from '@/server/fundraising/public-loader';
import { checkMutation, apiError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await loadFundDiscoveryState();
    return NextResponse.json(
      {
        ok: true,
        ...data,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    checkMutation(request);
    const actor = await requireActor();
    const db = await getDb();
    await seedFinance(db, actor.tenantId);

    // Ensure the user is enrolled in the fundraising organization for their tenant
    await db.query(
      "INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count) VALUES($1,'fund-school','School Futures Fund','fund','Gasabo',24) ON CONFLICT DO NOTHING",
      [actor.tenantId]
    );
    await db.query(
      "INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,'fund-school',$3) ON CONFLICT (tenant_id,user_id,org_id) DO UPDATE SET role=EXCLUDED.role",
      [actor.tenantId, actor.userId, actor.role]
    );

    const body = (await request.json()) as Record<string, unknown>;
    const result = await financeAction(db, actor, {
      ...body,
      action: 'createCampaign',
      orgId: 'fund-school',
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return apiError(error);
  }
}
