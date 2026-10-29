import { NextResponse } from 'next/server';
import { currentUser, requireActor } from '@/server/auth';
import { getDb } from '@/server/db';
import { DomainError } from '@/server/permissions';
import { financeAction, seedFinance } from '@/server/finance/service';
import { loadCampaignBySlugOrId } from '@/server/fundraising/public-loader';
import { checkMutation, apiError } from '@/server/http';
import type { Actor } from '@/lib/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_SUPPORTER_ACTIONS = new Set([
  'donate',
  'addCampaignComment',
  'submitCampaignRsvp',
  'toggleCampaignReaction',
  'toggleCampaignFollow',
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const data = await loadCampaignBySlugOrId(slug);
    if (!data.campaign) {
      throw new DomainError(
        'Campaign not found or access is restricted to invited contributors.',
        404
      );
    }
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

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    checkMutation(request);
    const { slug } = await context.params;
    const cleanKey = slug.trim().toLowerCase();
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : 'donate';
    const db = await getDb();

    // If it's a supporter action on a shared campaign link, resolve the campaign first
    if (PUBLIC_SUPPORTER_ACTIONS.has(action)) {
      const sessionUser = await currentUser();

      // 1. Check in sessionUser's tenant if logged in
      let row = sessionUser
        ? (
            await db.query(
              `SELECT p.campaign_id, p.tenant_id, p.org_id, p.visibility
               FROM fundraising_campaign_profiles p
               WHERE p.tenant_id = $1 AND (LOWER(p.slug) = $2 OR LOWER(p.campaign_id) = $2)
               LIMIT 1`,
              [sessionUser.tenantId, cleanKey]
            )
          ).rows[0]
        : undefined;

      // 2. Otherwise check if a shared public/unlisted campaign with this slug exists
      if (!row) {
        row = (
          await db.query(
            `SELECT p.campaign_id, p.tenant_id, p.org_id, p.visibility
             FROM fundraising_campaign_profiles p
             WHERE (LOWER(p.slug) = $1 OR LOWER(p.campaign_id) = $1)
               AND p.visibility IN ('public', 'unlisted')
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [cleanKey]
          )
        ).rows[0];
      }

      if (!row) {
        throw new DomainError('Campaign not found or restricted.', 404);
      }

      const targetTenantId = String(row.tenant_id);
      const campaignId = String(row.campaign_id);
      const orgId = String(row.org_id || 'fund-school');

      await seedFinance(db, targetTenantId);

      // Determine actor for this campaign's tenant
      let actor: Actor;
      if (sessionUser && sessionUser.tenantId === targetTenantId) {
        actor = {
          tenantId: targetTenantId,
          userId: sessionUser.id,
          role: sessionUser.role,
        };
      } else {
        // Shared link guest or cross-tenant supporter: use a dedicated supporter identity in targetTenantId
        const guestUserId = sessionUser ? `supporter-${sessionUser.id}` : 'public-supporter';
        const guestName =
          typeof body.contributorName === 'string' && body.contributorName.trim()
            ? body.contributorName.trim().slice(0, 100)
            : typeof body.guestName === 'string' && body.guestName.trim()
            ? body.guestName.trim().slice(0, 100)
            : typeof body.authorName === 'string' && body.authorName.trim()
            ? body.authorName.trim().slice(0, 100)
            : sessionUser?.name || 'Community Supporter';

        await db.query(
          "INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,'shared-link-supporter','member') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name",
          [guestUserId, guestName, `${guestUserId}@huriza.demo`]
        );
        actor = {
          tenantId: targetTenantId,
          userId: guestUserId,
          role: 'member',
        };
      }

      await db.query(
        "INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count) VALUES($1,$2,'School Futures Fund','fund','Gasabo',24) ON CONFLICT DO NOTHING",
        [targetTenantId, orgId]
      );
      await db.query(
        'INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4) ON CONFLICT (tenant_id,user_id,org_id) DO UPDATE SET role=EXCLUDED.role',
        [targetTenantId, actor.userId, orgId, actor.role]
      );

      const result = await financeAction(db, actor, {
        ...body,
        action,
        campaignId,
        orgId,
      });
      const refreshed = await loadCampaignBySlugOrId(slug);
      return NextResponse.json({
        ok: true,
        result,
        campaign: refreshed.campaign,
      });
    }

    // Organizer / Management actions strictly require authenticated actor in the campaign's tenant
    const actor = await requireActor();
    await seedFinance(db, actor.tenantId);

    await db.query(
      "INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count) VALUES($1,'fund-school','School Futures Fund','fund','Gasabo',24) ON CONFLICT DO NOTHING",
      [actor.tenantId]
    );
    await db.query(
      "INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,'fund-school',$3) ON CONFLICT (tenant_id,user_id,org_id) DO UPDATE SET role=EXCLUDED.role",
      [actor.tenantId, actor.userId, actor.role]
    );

    const row = (
      await db.query(
        `SELECT p.campaign_id, p.org_id
         FROM fundraising_campaign_profiles p
         WHERE p.tenant_id = $1 AND (LOWER(p.slug) = $2 OR LOWER(p.campaign_id) = $2)
         LIMIT 1`,
        [actor.tenantId, cleanKey]
      )
    ).rows[0];

    const campaignId =
      typeof body.campaignId === 'string' && body.campaignId.trim()
        ? body.campaignId.trim()
        : row
        ? String(row.campaign_id)
        : slug;
    const orgId = row ? String(row.org_id) : 'fund-school';

    const result = await financeAction(db, actor, {
      ...body,
      action,
      campaignId,
      orgId,
    });
    const refreshed = await loadCampaignBySlugOrId(slug);
    return NextResponse.json({
      ok: true,
      result,
      campaign: refreshed.campaign,
    });
  } catch (error) {
    return apiError(error);
  }
}
