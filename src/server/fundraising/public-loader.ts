import { getDb } from '@/server/db';
import { currentUser } from '@/server/auth';
import { seedFinance } from '@/server/finance/service';
import { buildFundraisingState, projectCampaignForViewer } from './service';
import type { Actor, FundraisingCampaignDetail, FundraisingState } from '@/lib/contracts';
import type { AccountUser } from '@/lib/access';

export async function resolvePublicOrSessionActor(): Promise<{
  actor: Actor;
  user: AccountUser | null;
  isAuthenticated: boolean;
}> {
  const db = await getDb();
  const user = await currentUser();
  if (user) {
    await seedFinance(db, user.tenantId);
    return {
      actor: { tenantId: user.tenantId, userId: user.id, role: user.role },
      user,
      isAuthenticated: true,
    };
  }

  // Ensure default demo tenant exists and is seeded for unauthenticated visitors browsing /fund
  await db.query("INSERT INTO demo_tenants(id) VALUES('demo') ON CONFLICT (id) DO NOTHING");
  for (const role of ['member', 'president', 'treasurer', 'cooperative', 'ngo']) {
    await db.query(
      'INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$1,$1) ON CONFLICT (id) DO NOTHING',
      [
        role,
        role === 'member'
          ? 'Aline Uwase'
          : role === 'president'
          ? 'Jean Mugisha'
          : role === 'treasurer'
          ? 'Diane Keza'
          : role,
        `${role}@huriza.demo`,
      ]
    );
  }
  await seedFinance(db, 'demo');
  return {
    actor: { tenantId: 'demo', userId: 'public-visitor', role: 'member' },
    user: null,
    isAuthenticated: false,
  };
}

export async function loadFundDiscoveryState(): Promise<{
  state: FundraisingState;
  user: AccountUser | null;
  isAuthenticated: boolean;
}> {
  const db = await getDb();
  const { actor, user, isAuthenticated } = await resolvePublicOrSessionActor();
  const state = await db.transaction(sql => buildFundraisingState(sql, actor));
  if (!isAuthenticated) {
    // Public visitors only see public discovery campaigns and have no personal myCampaigns
    return {
      state: {
        ...state,
        campaigns: state.campaigns.filter(c => c.visibility === 'public'),
        myCampaigns: [],
      },
      user: null,
      isAuthenticated: false,
    };
  }
  return { state, user, isAuthenticated };
}

export async function loadCampaignBySlugOrId(slugOrId: string): Promise<{
  campaign: FundraisingCampaignDetail | null;
  allCampaigns: FundraisingCampaignDetail[];
  user: AccountUser | null;
  isAuthenticated: boolean;
}> {
  const db = await getDb();
  const { actor, user, isAuthenticated } = await resolvePublicOrSessionActor();
  const cleanKey = slugOrId.trim().toLowerCase();

  return db.transaction(async sql => {
    // 1. Look up in the current actor's tenant first
    const profileRow = (
      await sql.query(
        `SELECT p.*, c.title, c.category, c.description, c.target, c.status, c.created_at AS campaign_created_at
         FROM fundraising_campaign_profiles p
         JOIN finance_campaigns c ON c.id = p.campaign_id AND c.tenant_id = p.tenant_id AND c.org_id = p.org_id
         WHERE p.tenant_id = $1 AND (LOWER(p.slug) = $2 OR LOWER(p.campaign_id) = $2)
         LIMIT 1`,
        [actor.tenantId, cleanKey]
      )
    ).rows[0];

    let targetActor = actor;
    let targetRow = profileRow;

    // 2. If not found in the current actor's tenant, check if a shared public/unlisted campaign with that slug/ID exists
    if (!targetRow) {
      const publicRow = (
        await sql.query(
          `SELECT p.*, c.title, c.category, c.description, c.target, c.status, c.created_at AS campaign_created_at
           FROM fundraising_campaign_profiles p
           JOIN finance_campaigns c ON c.id = p.campaign_id AND c.tenant_id = p.tenant_id AND c.org_id = p.org_id
           WHERE (LOWER(p.slug) = $1 OR LOWER(p.campaign_id) = $1) AND p.visibility IN ('public', 'unlisted')
           ORDER BY p.created_at DESC
           LIMIT 1`,
          [cleanKey]
        )
      ).rows[0];
      if (publicRow) {
        targetRow = publicRow;
        targetActor = {
          tenantId: String(publicRow.tenant_id),
          userId: user ? user.id : 'public-visitor',
          role: 'member',
        };
      }
    }

    if (!targetRow) {
      return { campaign: null, allCampaigns: [], user, isAuthenticated };
    }

    let campaign: FundraisingCampaignDetail | null = null;
    try {
      campaign = await projectCampaignForViewer(
        sql,
        targetActor.tenantId,
        String(targetRow.campaign_id),
        targetActor,
        { isDiscoveryList: false }
      );
    } catch {
      campaign = null;
    }

    if (!campaign) {
      return { campaign: null, allCampaigns: [], user, isAuthenticated };
    }

    // If unauthenticated and campaign is private, deny access
    if (!isAuthenticated && campaign.visibility === 'private') {
      return { campaign: null, allCampaigns: [], user, isAuthenticated };
    }

    // Return ONLY the requested campaign so shared campaign links never expose other campaigns
    return {
      campaign,
      allCampaigns: [],
      user,
      isAuthenticated,
    };
  });
}
