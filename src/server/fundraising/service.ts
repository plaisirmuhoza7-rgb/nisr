import { randomUUID } from 'node:crypto';
import type {
  Actor,
  Role,
  CampaignFamily,
  CampaignVisibility,
  StatsVisibility,
  CampaignTheme,
  CampaignVerificationStatus,
  CampaignRole,
  FundraisingCampaignDetail,
  FundraisingMedia,
  FundraisingUpdate,
  FundraisingComment,
  FundraisingContribution,
  FundraisingMilestone,
  FundraisingExpense,
  FundraisingGiftItem,
  FundraisingRsvp,
  FundraisingMatchingPledge,
  FundraisingAccessGrant,
  FundraisingTeamMember,
  FundraisingGuardianInsight,
  FundraisingState,
} from '@/lib/contracts';
import type { Sql } from '../db';
import { DomainError } from '../permissions';

const FUND_ORG = 'fund-school';
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function id(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function num(value: unknown): number {
  const n = BigInt(String(value ?? 0));
  if (n > MAX_SAFE || n < -MAX_SAFE) throw new DomainError('Amount exceeds safe integer RWF range');
  return Number(n);
}

function money(value: unknown, field = 'Amount'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError(`${field} must be a positive safe integer in RWF`);
  }
  return value;
}

function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new DomainError(`${field} is required (maximum ${max} characters)`);
  }
  return value.trim();
}

function optStr(value: unknown, max = 2000, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, max);
}

function dateStr(value: unknown): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Sanitize user-provided rich story/update text to prevent XSS or unsafe markup.
 */
export function sanitizeCampaignText(input: unknown, maxLen = 10000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLen)
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
    .replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '')
    .replace(/on[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .trim();
}

/**
 * Generate a URL-safe slug from a title and ensure uniqueness within the tenant.
 */
export async function generateUniqueSlug(sql: Sql, tenantId: string, rawTitleOrSlug: string, excludeCampaignId?: string): Promise<string> {
  const base = rawTitleOrSlug
    .toLowerCase()
    .replace(/^simulated\s*[·-]\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'campaign';

  let candidate = base;
  let counter = 2;
  while (true) {
    const existing = (
      await sql.query(
        'SELECT campaign_id FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND slug=$2',
        [tenantId, candidate]
      )
    ).rows[0];
    if (!existing || (excludeCampaignId && String(existing.campaign_id) === excludeCampaignId)) {
      return candidate;
    }
    candidate = `${base}-${counter}`;
    counter++;
  }
}

const VISIBILITY_RANK: Record<StatsVisibility, number> = {
  everyone: 0,
  contributors_only: 1,
  selected_contributors: 2,
  team_only: 3,
};

function stricterPolicy(a: StatsVisibility, b: StatsVisibility): StatsVisibility {
  return VISIBILITY_RANK[a] >= VISIBILITY_RANK[b] ? a : b;
}

export function getCloudinaryConfig(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
  hasValidSecret: boolean;
} {
  let cloudName =
    process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'a0bcyupp';
  let apiKey = process.env.CLOUDINARY_API_KEY || '249148756432359';
  let apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

  const rawUrl = process.env.CLOUDINARY_URL || '';
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/i.exec(rawUrl.trim());
  if (match) {
    const [, urlKey, urlSecret, urlCloud] = match;
    if (urlKey && !urlKey.includes('<')) apiKey = urlKey;
    if (urlSecret && !urlSecret.includes('<')) apiSecret = urlSecret;
    if (urlCloud && !urlCloud.includes('<')) cloudName = urlCloud;
  }

  const hasValidSecret = Boolean(apiSecret && !apiSecret.includes('<your_api_secret>'));
  return {
    cloudName,
    apiKey,
    apiSecret: hasValidSecret ? apiSecret : '',
    uploadPreset,
    hasValidSecret,
  };
}

export function isCloudinaryConfigured(): boolean {
  const cfg = getCloudinaryConfig();
  return Boolean(cfg.cloudName && (cfg.hasValidSecret || cfg.uploadPreset || cfg.apiKey));
}

/**
 * Analyze campaign text and configuration for Privacy Guardian warnings.
 */
function buildPrivacyWarnings(
  subcategory: string,
  beneficiaryType: string,
  visibility: CampaignVisibility,
  statsVisibility: StatsVisibility,
  story: string,
  description: string
): FundraisingGuardianInsight['alerts'] {
  const alerts: FundraisingGuardianInsight['alerts'] = [];
  const combined = `${description} ${story}`;

  if (
    (subcategory === 'child_welfare' || beneficiaryType === 'child_protected' || subcategory === 'medical') &&
    visibility === 'public' &&
    statsVisibility === 'everyone'
  ) {
    alerts.push({
      id: 'privacy-sensitive-cause',
      severity: 'info',
      category: 'privacy',
      message:
        'Privacy Guardian: Sensitive medical or child-welfare campaign detected. Ensure no private clinical records or minor identifying documents are published publicly.',
    });
  }

  if (/\b(07[2389]\d{7}|\+2507[2389]\d{7})\b/.test(combined) && visibility === 'public') {
    alerts.push({
      id: 'privacy-phone-in-story',
      severity: 'warning',
      category: 'privacy',
      message:
        'Privacy Guardian: A personal phone number appears in the public story text. Consider using HURIZA simulated MoMo checkout instead of posting private phone numbers.',
    });
  }

  if (/\b1\d{15}\b/.test(combined)) {
    alerts.push({
      id: 'privacy-nid-detected',
      severity: 'critical',
      category: 'privacy',
      message:
        'Privacy Guardian: A 16-digit sequence resembling a National ID was detected in the story. Never publish confidential identity numbers.',
    });
  }

  return alerts;
}

/**
 * Compute authoritative campaign totals from finance_payments and finance_entries.
 */
export async function getAuthoritativeCampaignTotals(
  sql: Sql,
  tenantId: string,
  orgId: string,
  campaignId: string
): Promise<{ raised: number; spent: number; held: number; contributorCount: number; pledgedTotal: number }> {
  const rows = (
    await sql.query(
      `SELECT p.kind, COALESCE(SUM(p.amount),0)::text AS amount, COUNT(DISTINCT p.user_id)::text AS donors
       FROM finance_payments p
       WHERE p.tenant_id=$1 AND p.org_id=$2 AND p.campaign_id=$3 AND p.status='success'
         AND NOT EXISTS (
           SELECT 1 FROM finance_entries e
           WHERE e.tenant_id=$1 AND e.org_id=$2 AND e.reversal_of=p.journal_id
         )
       GROUP BY p.kind`,
      [tenantId, orgId, campaignId]
    )
  ).rows;

  const donationRow = rows.find(r => r.kind === 'donation');
  const expenseRow = rows.find(r => r.kind === 'expense');
  const raised = num(donationRow?.amount ?? 0);
  const spent = num(expenseRow?.amount ?? 0);
  const contributorCount = num(donationRow?.donors ?? 0);

  const heldRow = (
    await sql.query(
      `SELECT COALESCE(SUM(amount),0)::text AS amount
       FROM finance_payments
       WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND kind='expense' AND status IN ('pending','unknown')`,
      [tenantId, orgId, campaignId]
    )
  ).rows[0];
  const held = num(heldRow?.amount ?? 0);

  const pledgeRow = (
    await sql.query(
      `SELECT COALESCE(SUM(amount),0)::text AS amount
       FROM fundraising_contributions
       WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND status='pledged'`,
      [tenantId, orgId, campaignId]
    )
  ).rows[0];
  const pledgedTotal = num(pledgeRow?.amount ?? 0);

  return { raised, spent, held, contributorCount, pledgedTotal };
}

/**
 * Ensure a campaign has a companion profile row in fundraising_campaign_profiles.
 */
async function ensureCampaignProfile(sql: Sql, campaign: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tenantId = String(campaign.tenant_id);
  const orgId = String(campaign.org_id);
  const campaignId = String(campaign.id);

  const existing = (
    await sql.query(
      'SELECT * FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND campaign_id=$2',
      [tenantId, campaignId]
    )
  ).rows[0];
  if (existing) return existing;

  const slug = await generateUniqueSlug(sql, tenantId, String(campaign.title), campaignId);
  const cat = String(campaign.category || 'Education').toLowerCase();
  const family: CampaignFamily =
    cat.includes('wedding') || cat.includes('birthday') || cat.includes('moment')
      ? 'moments'
      : cat.includes('water') || cat.includes('community') || cat.includes('ngo')
      ? 'community'
      : 'causes';

  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, story, cover_image_url, visibility, stats_visibility, verification_status
     ) VALUES ($1,$2,$3,$4,$5,$6,'classic_blue','president','School Futures Team','Community Beneficiaries','community','Gasabo, Kigali',$7,$8,'public','everyone','verified_demo')
     ON CONFLICT (campaign_id) DO NOTHING`,
    [
      campaignId,
      tenantId,
      orgId,
      slug,
      family,
      cat.slice(0, 40),
      String(campaign.description || ''),
      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=80',
    ]
  );

  return (
    await sql.query(
      'SELECT * FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND campaign_id=$2',
      [tenantId, campaignId]
    )
  ).rows[0];
}

/**
 * Project a single campaign with strict server-side enforcement of visibility and privacy rules.
 * Unauthorized financial metrics are returned as `null` — never leaked in API payloads.
 */
export async function projectCampaignForViewer(
  sql: Sql,
  tenantId: string,
  campaignIdOrSlug: string,
  viewer: { userId?: string; role?: Role },
  options: { isDiscoveryList?: boolean } = {}
): Promise<FundraisingCampaignDetail | null> {
  const byId = (
    await sql.query(
      'SELECT * FROM finance_campaigns WHERE tenant_id=$1 AND id=$2',
      [tenantId, campaignIdOrSlug]
    )
  ).rows[0];

  let campaign = byId;
  if (!campaign) {
    const profileBySlug = (
      await sql.query(
        'SELECT campaign_id FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND slug=$2',
        [tenantId, campaignIdOrSlug]
      )
    ).rows[0];
    if (profileBySlug) {
      campaign = (
        await sql.query(
          'SELECT * FROM finance_campaigns WHERE tenant_id=$1 AND id=$2',
          [tenantId, String(profileBySlug.campaign_id)]
        )
      ).rows[0];
    }
  }
  if (!campaign) return null;

  const profile = await ensureCampaignProfile(sql, campaign);
  const campaignId = String(campaign.id);
  const orgId = String(campaign.org_id);
  const visibility = String(profile.visibility || 'public') as CampaignVisibility;
  const verificationStatus = String(profile.verification_status || 'unverified') as CampaignVerificationStatus;

  // Determine viewer's relationship to this campaign
  const viewerId = viewer.userId || '';
  const teamRows = (
    await sql.query(
      'SELECT * FROM fundraising_team_members WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY created_at ASC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const viewerTeamRow = viewerId ? teamRows.find(t => String(t.user_id) === viewerId) : undefined;
  const isOrgOfficer = Boolean(
    viewerId &&
      (viewer.role === 'president' || viewer.role === 'treasurer' || viewer.role === 'accountant') &&
      (
        await sql.query(
          'SELECT 1 FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3',
          [tenantId, orgId, viewerId]
        )
      ).rows.length > 0
  );
  const isOrganizerOrTeam = Boolean(
    (viewerId && String(profile.organizer_user_id) === viewerId) || viewerTeamRow || isOrgOfficer
  );

  // Check if viewer is a confirmed contributor
  const confirmedDonorRow = viewerId
    ? (
        await sql.query(
          `SELECT 1 FROM finance_payments
           WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4 AND kind='donation' AND status='success'
           LIMIT 1`,
          [tenantId, orgId, campaignId, viewerId]
        )
      ).rows[0]
    : undefined;
  const isConfirmedContributor = Boolean(confirmedDonorRow);

  // Check active access grants for viewer
  const grantRows = (
    await sql.query(
      `SELECT * FROM fundraising_access_grants
       WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3
       ORDER BY created_at DESC`,
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const activeViewerGrants = viewerId
    ? grantRows.filter(
        g =>
          String(g.user_id) === viewerId &&
          String(g.status) === 'active' &&
          (!g.expires_at || new Date(String(g.expires_at)).getTime() > Date.now())
      )
    : [];
  const hasSelectedGrant = activeViewerGrants.some(g =>
    ['selected_stats', 'full_transparency'].includes(String(g.grant_type))
  );
  const hasViewGrant =
    hasSelectedGrant || activeViewerGrants.some(g => String(g.grant_type) === 'campaign_view');

  // Suspended campaign check
  if (verificationStatus === 'suspended' && !isOrganizerOrTeam) {
    if (options.isDiscoveryList) return null;
    throw new DomainError('This campaign is currently suspended for safety review.', 403);
  }

  // Discovery list filtering: unlisted and private campaigns do not appear in public discovery
  if (options.isDiscoveryList && visibility !== 'public' && !isOrganizerOrTeam && !hasViewGrant) {
    return null;
  }

  // Private campaign access check
  if (visibility === 'private' && !isOrganizerOrTeam && !hasViewGrant && !isConfirmedContributor) {
    if (options.isDiscoveryList) return null;
    throw new DomainError('This campaign is private and accessible by invitation only.', 403);
  }

  // Determine viewer access tier for statistics (0 = everyone, 1 = contributor, 2 = selected, 3 = team)
  const viewerTier = isOrganizerOrTeam
    ? 3
    : hasSelectedGrant
    ? 2
    : isConfirmedContributor
    ? 1
    : 0;

  const statsVisibility = String(profile.stats_visibility || 'everyone') as StatsVisibility;
  const goalPolicy = stricterPolicy(statsVisibility, String(profile.goal_visibility || 'everyone') as StatsVisibility);
  const raisedPolicy = stricterPolicy(statsVisibility, String(profile.raised_visibility || 'everyone') as StatsVisibility);
  const contributorsPolicy = (String(profile.contributors_visibility || statsVisibility) as StatsVisibility);
  const spendingPolicy = stricterPolicy(
    statsVisibility,
    String(profile.spending_visibility || 'everyone') as StatsVisibility
  );

  const canViewGoal = viewerTier >= VISIBILITY_RANK[goalPolicy];
  const canViewRaised = viewerTier >= VISIBILITY_RANK[raisedPolicy];
  const canViewContributors = viewerTier >= VISIBILITY_RANK[contributorsPolicy];
  const canViewSpending = viewerTier >= VISIBILITY_RANK[spendingPolicy];

  const totals = await getAuthoritativeCampaignTotals(sql, tenantId, orgId, campaignId);
  const rawTarget = num(campaign.target);
  const rawAvailable = Math.max(0, totals.raised - totals.spent - totals.held);
  const rawProgress = rawTarget > 0 ? Math.min(100, Math.round((totals.raised / rawTarget) * 100)) : 0;

  // Media
  const mediaRows = (
    await sql.query(
      'SELECT * FROM fundraising_campaign_media WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY sort_order ASC, created_at ASC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const media: FundraisingMedia[] = mediaRows.map(m => ({
    id: String(m.id),
    campaignId,
    mediaType: String(m.media_type) as FundraisingMedia['mediaType'],
    url: String(m.url),
    caption: String(m.caption || ''),
    sortOrder: Number(m.sort_order || 0),
    uploadedBy: isOrganizerOrTeam ? String(m.uploaded_by) : 'organizer',
    createdAt: dateStr(m.created_at),
  }));

  // Updates (filter out spending updates if !canViewSpending)
  const updateRows = (
    await sql.query(
      'SELECT * FROM fundraising_campaign_updates WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY created_at DESC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const updates: FundraisingUpdate[] = updateRows
    .filter(u => canViewSpending || String(u.update_type) !== 'spending')
    .map(u => ({
      id: String(u.id),
      campaignId,
      updateType: String(u.update_type) as FundraisingUpdate['updateType'],
      title: String(u.title),
      body: String(u.body),
      mediaUrl: String(u.media_url || ''),
      authorId: isOrganizerOrTeam ? String(u.author_id) : 'organizer',
      authorName: String(u.author_name),
      createdAt: dateStr(u.created_at),
    }));

  // Comments
  const commentRows = (
    await sql.query(
      `SELECT * FROM fundraising_comments
       WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND status='visible'
       ORDER BY created_at DESC`,
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const comments: FundraisingComment[] = commentRows.map(c => {
    const isAnon = Boolean(c.is_anonymous);
    const isSelf = viewerId && String(c.author_id) === viewerId;
    return {
      id: String(c.id),
      campaignId,
      updateId: c.update_id ? String(c.update_id) : undefined,
      authorId: isSelf || isOrganizerOrTeam ? String(c.author_id) : 'supporter',
      authorName: isAnon && !isOrganizerOrTeam && !isSelf ? 'Anonymous Supporter' : String(c.author_name),
      isAnonymous: isAnon,
      commentType: String(c.comment_type) as FundraisingComment['commentType'],
      message: String(c.message),
      reaction: String(c.reaction || 'heart'),
      status: String(c.status) as 'visible' | 'hidden',
      createdAt: dateStr(c.created_at),
    };
  });

  // Contributions (strictly filtered by canViewContributors & supporter privacy preferences)
  const contribRows = canViewContributors
    ? (
        await sql.query(
          `SELECT * FROM fundraising_contributions
           WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3
           ORDER BY created_at DESC`,
          [tenantId, orgId, campaignId]
        )
      ).rows
    : [];

  const contributions: FundraisingContribution[] = contribRows
    .filter(c => isOrganizerOrTeam || String(c.user_id) === viewerId || ['success', 'pledged'].includes(String(c.status)))
    .map(c => {
      const pref = String(c.display_preference || 'public_name') as FundraisingContribution['displayPreference'];
      const isSelf = Boolean(viewerId && String(c.user_id) === viewerId);
      const showRealIdentity = isOrganizerOrTeam || isSelf;
      const publicName =
        pref === 'anonymous' && !showRealIdentity
          ? 'Anonymous Supporter'
          : pref === 'display_name' && String(c.custom_display_name || '').trim()
          ? String(c.custom_display_name)
          : String(c.contributor_name);

      return {
        id: String(c.id),
        campaignId,
        paymentId: c.payment_id ? String(c.payment_id) : undefined,
        userId: showRealIdentity ? String(c.user_id) : 'supporter',
        contributorName: publicName,
        displayPreference: pref,
        amount: canViewRaised || showRealIdentity ? num(c.amount) : null,
        contributionType: String(c.contribution_type) as FundraisingContribution['contributionType'],
        channel: String(c.channel) as FundraisingContribution['channel'],
        status: String(c.status) as FundraisingContribution['status'],
        reference: showRealIdentity ? String(c.reference) : `HURIZA-REF-${String(c.id).slice(-6)}`,
        message: String(c.message || ''),
        dedication: String(c.dedication || ''),
        giftItemId: c.gift_item_id ? String(c.gift_item_id) : undefined,
        teamId: c.team_id ? String(c.team_id) : undefined,
        createdAt: dateStr(c.created_at),
      };
    });

  // Milestones
  const milestoneRows = (
    await sql.query(
      'SELECT * FROM fundraising_milestones WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY sort_order ASC, created_at ASC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const milestones: FundraisingMilestone[] = milestoneRows.map(m => ({
    id: String(m.id),
    campaignId,
    title: String(m.title),
    description: String(m.description || ''),
    targetAmount: num(m.target_amount),
    allocatedAmount: canViewSpending ? num(m.allocated_amount) : 0,
    spentAmount: canViewSpending ? num(m.spent_amount) : 0,
    outcomeStatus: String(m.outcome_status) as FundraisingMilestone['outcomeStatus'],
    outcomeEvidence: String(m.outcome_evidence || ''),
    sortOrder: Number(m.sort_order || 0),
    createdAt: dateStr(m.created_at),
  }));

  // Expenses (strictly gated by canViewSpending)
  const expenseRows = canViewSpending
    ? (
        await sql.query(
          `SELECT e.*, d.category, d.description, d.vendor_name, d.receipt_url, d.milestone_id, d.payment_reference, d.created_at AS detail_created_at,
                  u1.name AS requested_by_name, u2.name AS approved_by_name
           FROM finance_expenses e
           LEFT JOIN fundraising_expense_details d ON d.expense_id = e.id
           LEFT JOIN app_users u1 ON u1.id = e.requested_by
           LEFT JOIN app_users u2 ON u2.id = e.approved_by
           WHERE e.tenant_id=$1 AND e.org_id=$2 AND e.campaign_id=$3
           ORDER BY e.id DESC`,
          [tenantId, orgId, campaignId]
        )
      ).rows
    : [];
  const expenses: FundraisingExpense[] = expenseRows.map(e => ({
    id: String(e.id),
    campaignId,
    title: String(e.title),
    category: String(e.category || 'Program Execution'),
    description: String(e.description || ''),
    vendorName: String(e.vendor_name || ''),
    receiptUrl: String(e.receipt_url || ''),
    milestoneId: e.milestone_id ? String(e.milestone_id) : undefined,
    amount: num(e.amount),
    requestedBy: isOrganizerOrTeam ? String(e.requested_by) : 'officer',
    requestedByName: e.requested_by_name ? String(e.requested_by_name) : isOrganizerOrTeam ? String(e.requested_by) : 'Campaign Officer',
    approvedBy: e.approved_by ? (isOrganizerOrTeam ? String(e.approved_by) : 'officer') : undefined,
    approvedByName: e.approved_by_name ? String(e.approved_by_name) : e.approved_by ? (isOrganizerOrTeam ? String(e.approved_by) : 'Campaign Approver') : undefined,
    status: String(e.status) as FundraisingExpense['status'],
    paymentReference: String(e.payment_reference || ''),
    createdAt: dateStr(e.detail_created_at || new Date()),
  }));

  // Gift Registry Items
  const giftRows = (
    await sql.query(
      'SELECT * FROM fundraising_gift_items WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY created_at ASC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const giftItems: FundraisingGiftItem[] = giftRows.map(g => ({
    id: String(g.id),
    campaignId,
    title: String(g.title),
    description: String(g.description || ''),
    targetAmount: num(g.target_amount),
    contributedAmount: canViewRaised ? num(g.contributed_amount) : 0,
    imageUrl: String(g.image_url || ''),
    status: String(g.status) as FundraisingGiftItem['status'],
  }));

  // RSVPs
  const rsvpRows = (
    await sql.query(
      'SELECT * FROM fundraising_rsvps WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY created_at DESC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const rsvps: FundraisingRsvp[] = rsvpRows
    .filter(r => isOrganizerOrTeam || canViewContributors || String(r.user_id) === viewerId)
    .map(r => ({
      id: String(r.id),
      campaignId,
      userId: isOrganizerOrTeam || String(r.user_id) === viewerId ? String(r.user_id) : 'guest',
      guestName: String(r.guest_name),
      attendanceStatus: String(r.attendance_status) as FundraisingRsvp['attendanceStatus'],
      guestsCount: Number(r.guests_count || 1),
      dietaryOrNote: isOrganizerOrTeam || String(r.user_id) === viewerId ? String(r.dietary_or_note || '') : '',
      createdAt: dateStr(r.created_at),
    }));

  // Matching Pledges
  const matchRows = (
    await sql.query(
      'SELECT * FROM fundraising_matching_pledges WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 ORDER BY created_at DESC',
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const matchingPledges: FundraisingMatchingPledge[] = matchRows.map(mp => {
    const pledged = num(mp.pledged_amount);
    const confirmed = num(mp.confirmed_amount);
    return {
      id: String(mp.id),
      campaignId,
      sponsorName: String(mp.sponsor_name),
      pledgedAmount: pledged,
      confirmedAmount: confirmed,
      remainingPledge: Math.max(0, pledged - confirmed),
      matchRatioBps: Number(mp.match_ratio_bps || 10000),
      status: String(mp.status) as FundraisingMatchingPledge['status'],
    };
  });

  // Reactions & Followers
  const reactionRows = (
    await sql.query(
      `SELECT reaction_type, COUNT(*)::text AS count
       FROM fundraising_reactions
       WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND target_type='campaign'
       GROUP BY reaction_type`,
      [tenantId, orgId, campaignId]
    )
  ).rows;
  const reactionCounts: Record<string, number> = { heart: 0, celebrate: 0, pray: 0, clap: 0, star: 0 };
  for (const r of reactionRows) {
    reactionCounts[String(r.reaction_type)] = Number(r.count);
  }
  const myReactionRow = viewerId
    ? (
        await sql.query(
          `SELECT reaction_type FROM fundraising_reactions
           WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND target_type='campaign' AND user_id=$4`,
          [tenantId, orgId, campaignId, viewerId]
        )
      ).rows[0]
    : undefined;

  const followerCountRow = (
    await sql.query(
      'SELECT COUNT(*)::text AS count FROM fundraising_followers WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3',
      [tenantId, orgId, campaignId]
    )
  ).rows[0];
  const isFollowingRow = viewerId
    ? (
        await sql.query(
          'SELECT 1 FROM fundraising_followers WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4',
          [tenantId, orgId, campaignId, viewerId]
        )
      ).rows[0]
    : undefined;

  // Guardian Insights
  const eventDateStr = profile.event_date ? dateStr(profile.event_date) : undefined;
  const daysRemaining = eventDateStr
    ? Math.max(0, Math.ceil((new Date(`${eventDateStr}T23:59:59Z`).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const fundingGap = canViewGoal && canViewRaised ? Math.max(0, rawTarget - totals.raised) : null;
  const requiredDailyRate =
    fundingGap !== null && daysRemaining !== null && daysRemaining > 0
      ? Math.ceil(fundingGap / daysRemaining)
      : null;

  const guardianAlerts: FundraisingGuardianInsight['alerts'] = [
    ...buildPrivacyWarnings(
      String(profile.subcategory || ''),
      String(profile.beneficiary_type || ''),
      visibility,
      statsVisibility,
      String(profile.story || ''),
      String(campaign.description || '')
    ),
  ];

  if (canViewSpending) {
    const missingReceipts = expenses.filter(e => e.status === 'paid' && !e.receiptUrl);
    if (missingReceipts.length > 0) {
      guardianAlerts.push({
        id: 'transparency-missing-receipts',
        severity: 'warning',
        category: 'transparency',
        message: `Transparency Guardian: ${missingReceipts.length} paid expense(s) do not have an attached receipt reference yet.`,
      });
    }
    const fundedUnverifiedMilestones = milestones.filter(
      m => totals.raised >= m.targetAmount && m.outcomeStatus !== 'completed_verified'
    );
    if (fundedUnverifiedMilestones.length > 0) {
      guardianAlerts.push({
        id: 'transparency-milestone-outcome',
        severity: 'info',
        category: 'transparency',
        message: `Transparency Guardian: ${fundedUnverifiedMilestones.length} milestone(s) have sufficient funding collected but await real-world outcome verification.`,
      });
    }
  }

  if (canViewRaised && totals.pledgedTotal > 0) {
    guardianAlerts.push({
      id: 'funding-pledges-separate',
      severity: 'info',
      category: 'funding',
      message: `Funding Guardian: ${totals.pledgedTotal.toLocaleString()} RWF in unconfirmed pledges are tracked separately and excluded from available campaign cash.`,
    });
  }

  const suggestedAmounts = String(profile.suggested_amounts || '5000,10000,25000,50000')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isSafeInteger(n) && n > 0);

  return {
    id: campaignId,
    tenantId,
    orgId,
    slug: String(profile.slug),
    title: String(campaign.title),
    category: String(campaign.category),
    subcategory: String(profile.subcategory || 'charity'),
    family: String(profile.family || 'causes') as CampaignFamily,
    theme: String(profile.theme || 'classic_blue') as CampaignTheme,
    description: String(campaign.description),
    story: String(profile.story || campaign.description),
    organizerUserId: isOrganizerOrTeam ? String(profile.organizer_user_id) : 'organizer',
    organizerName: String(profile.organizer_name || 'HURIZA Organizer'),
    beneficiaryName: String(profile.beneficiary_name || ''),
    beneficiaryType: String(profile.beneficiary_type || 'community') as FundraisingCampaignDetail['beneficiaryType'],
    location: String(profile.location || 'Kigali, Rwanda'),
    eventDate: eventDateStr,
    startDate: dateStr(profile.start_date),
    coverImageUrl: String(profile.cover_image_url || ''),
    videoUrl: String(profile.video_url || ''),
    status: String(campaign.status),
    verificationStatus,
    verificationNotes: isOrganizerOrTeam ? String(profile.verification_notes || '') : '',
    visibility,
    privacyPolicy: {
      statsVisibility,
      goalVisibility: String(profile.goal_visibility || 'everyone') as StatsVisibility,
      raisedVisibility: String(profile.raised_visibility || 'everyone') as StatsVisibility,
      contributorsVisibility: String(profile.contributors_visibility || 'everyone') as StatsVisibility,
      spendingVisibility: String(profile.spending_visibility || 'everyone') as StatsVisibility,
      allowComments: Boolean(profile.allow_comments),
      allowAnonymous: Boolean(profile.allow_anonymous),
      allowRsvp: Boolean(profile.allow_rsvp),
    },
    suggestedAmounts: suggestedAmounts.length ? suggestedAmounts : [5000, 10000, 25000, 50000],
    viewerAccess: {
      canViewCampaign: true,
      canViewGoal,
      canViewRaised,
      canViewContributors,
      canViewSpending,
      isOrganizerOrTeam,
      isConfirmedContributor,
      hasSelectedGrant,
      campaignRole: viewerTeamRow
        ? (String(viewerTeamRow.campaign_role) as CampaignRole)
        : isOrganizerOrTeam
        ? 'owner'
        : undefined,
    },
    target: canViewGoal ? rawTarget : null,
    raised: canViewRaised ? totals.raised : null,
    spent: canViewSpending ? totals.spent : null,
    held: canViewSpending ? totals.held : null,
    availableBalance: canViewRaised && canViewSpending ? rawAvailable : null,
    pledgedTotal: canViewRaised ? totals.pledgedTotal : null,
    progressPercent: canViewGoal && canViewRaised ? rawProgress : null,
    contributorCount: canViewContributors ? totals.contributorCount : null,
    followerCount: Number(followerCountRow?.count || 0),
    isFollowing: Boolean(isFollowingRow),
    reactionCounts,
    myReaction: myReactionRow ? String(myReactionRow.reaction_type) : null,
    media,
    updates,
    comments,
    contributions,
    milestones,
    expenses,
    giftItems,
    rsvps,
    matchingPledges,
    team: teamRows.map(t => ({
      id: String(t.id),
      campaignId,
      userId: isOrganizerOrTeam ? String(t.user_id) : 'team-member',
      userName: String(t.user_name),
      campaignRole: String(t.campaign_role) as CampaignRole,
      teamName: String(t.team_name || ''),
      assignedBy: isOrganizerOrTeam ? String(t.assigned_by) : 'owner',
      createdAt: dateStr(t.created_at),
    })),
    accessGrants: isOrganizerOrTeam
      ? grantRows.map(g => ({
          id: String(g.id),
          campaignId,
          userId: String(g.user_id),
          userName: String(g.user_name || g.user_id),
          grantType: String(g.grant_type) as FundraisingAccessGrant['grantType'],
          status: String(g.status) as 'active' | 'revoked',
          grantedBy: String(g.granted_by),
          expiresAt: g.expires_at ? dateStr(g.expires_at) : undefined,
          createdAt: dateStr(g.created_at),
        }))
      : [],
    guardian: {
      fundingGap,
      progressPercent: canViewGoal && canViewRaised ? rawProgress : null,
      requiredDailyRate,
      daysRemaining,
      uncommittedCash: canViewRaised && canViewSpending ? rawAvailable : null,
      transparencyScore: !canViewSpending
        ? 'restricted'
        : guardianAlerts.some(a => a.category === 'transparency' && a.severity === 'warning')
        ? 'needs_attention'
        : 'verified_clean',
      alerts: guardianAlerts,
    },
  };
}

/**
 * Build full FundraisingState for a viewer in a tenant.
 */
export async function buildFundraisingState(
  sql: Sql,
  actor: { tenantId: string; userId?: string; role?: Role }
): Promise<FundraisingState> {
  const hasTable =
    (
      await sql.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_campaign_profiles'"
      )
    ).rows.length > 0;
  if (!hasTable) {
    return { campaigns: [], myCampaigns: [], myContributions: [], cloudinaryConfigured: isCloudinaryConfigured() };
  }

  const rows = (
    await sql.query('SELECT id FROM finance_campaigns WHERE tenant_id=$1 ORDER BY id ASC', [actor.tenantId])
  ).rows;

  const campaigns: FundraisingCampaignDetail[] = [];
  const myCampaigns: FundraisingCampaignDetail[] = [];

  for (const r of rows) {
    try {
      const full = await projectCampaignForViewer(sql, actor.tenantId, String(r.id), actor, { isDiscoveryList: false });
      if (full) {
        if (full.visibility === 'public' || full.visibility === 'private' || full.viewerAccess.isOrganizerOrTeam || full.viewerAccess.hasSelectedGrant) {
          campaigns.push(full);
        }
        if (full.viewerAccess.isOrganizerOrTeam) {
          myCampaigns.push(full);
        }
      }
    } catch {
      // Skip private/suspended campaigns the viewer cannot access
    }
  }

  const myContribRows = actor.userId
    ? (
        await sql.query(
          `SELECT * FROM fundraising_contributions
           WHERE tenant_id=$1 AND user_id=$2
           ORDER BY created_at DESC`,
          [actor.tenantId, actor.userId]
        )
      ).rows
    : [];

  const myContributions: FundraisingContribution[] = myContribRows.map(c => ({
    id: String(c.id),
    campaignId: String(c.campaign_id),
    paymentId: c.payment_id ? String(c.payment_id) : undefined,
    userId: String(c.user_id),
    contributorName: String(c.contributor_name),
    displayPreference: String(c.display_preference) as FundraisingContribution['displayPreference'],
    amount: num(c.amount),
    contributionType: String(c.contribution_type) as FundraisingContribution['contributionType'],
    channel: String(c.channel) as FundraisingContribution['channel'],
    status: String(c.status) as FundraisingContribution['status'],
    reference: String(c.reference),
    message: String(c.message || ''),
    dedication: String(c.dedication || ''),
    giftItemId: c.gift_item_id ? String(c.gift_item_id) : undefined,
    teamId: c.team_id ? String(c.team_id) : undefined,
    createdAt: dateStr(c.created_at),
  }));

  return {
    campaigns,
    myCampaigns,
    myContributions,
    cloudinaryConfigured: isCloudinaryConfigured(),
  };
}

/**
 * Create a new rich Fundraising Campaign with profile, milestones, gift items, media, and team.
 */
export async function createRichCampaign(
  sql: Sql,
  actor: Actor,
  input: Record<string, unknown>,
  orgId = FUND_ORG
) {
  const title = str(input.title, 'Campaign title', 160);
  const category = str(input.category || 'Community', 'Category', 80);
  const subcategory = optStr(input.subcategory, 60, category.toLowerCase());
  const family: CampaignFamily = ['moments', 'causes', 'community'].includes(String(input.family))
    ? (String(input.family) as CampaignFamily)
    : subcategory.includes('wedding') || subcategory.includes('birthday')
    ? 'moments'
    : subcategory.includes('water') || subcategory.includes('ngo') || subcategory.includes('community')
    ? 'community'
    : 'causes';

  const description = sanitizeCampaignText(input.description || title, 2000);
  const story = sanitizeCampaignText(input.story || description, 10000);
  const target = money(input.target, 'Campaign goal');
  const slug = await generateUniqueSlug(sql, actor.tenantId, optStr(input.slug, 80, title));

  const theme: CampaignTheme = [
    'wedding_elegant',
    'birthday_celebration',
    'medical_trust',
    'charity_warm',
    'community_impact',
    'classic_blue',
  ].includes(String(input.theme))
    ? (String(input.theme) as CampaignTheme)
    : subcategory.includes('wedding')
    ? 'wedding_elegant'
    : subcategory.includes('birthday')
    ? 'birthday_celebration'
    : family === 'community'
    ? 'community_impact'
    : 'classic_blue';

  const visibility: CampaignVisibility = ['public', 'unlisted', 'private'].includes(String(input.visibility))
    ? (String(input.visibility) as CampaignVisibility)
    : 'public';

  // Protective privacy defaults for sensitive causes if not explicitly set
  const defaultStatsVis: StatsVisibility =
    subcategory === 'child_welfare' && !input.statsVisibility ? 'contributors_only' : 'everyone';

  const statsVisibility: StatsVisibility = [
    'everyone',
    'contributors_only',
    'selected_contributors',
    'team_only',
  ].includes(String(input.statsVisibility))
    ? (String(input.statsVisibility) as StatsVisibility)
    : defaultStatsVis;

  const goalVisibility: StatsVisibility = [
    'everyone',
    'contributors_only',
    'selected_contributors',
    'team_only',
  ].includes(String(input.goalVisibility))
    ? (String(input.goalVisibility) as StatsVisibility)
    : statsVisibility;

  const raisedVisibility: StatsVisibility = [
    'everyone',
    'contributors_only',
    'selected_contributors',
    'team_only',
  ].includes(String(input.raisedVisibility))
    ? (String(input.raisedVisibility) as StatsVisibility)
    : statsVisibility;

  const contributorsVisibility: StatsVisibility = [
    'everyone',
    'contributors_only',
    'selected_contributors',
    'team_only',
  ].includes(String(input.contributorsVisibility))
    ? (String(input.contributorsVisibility) as StatsVisibility)
    : statsVisibility;

  const spendingVisibility: StatsVisibility = [
    'everyone',
    'contributors_only',
    'selected_contributors',
    'team_only',
  ].includes(String(input.spendingVisibility))
    ? (String(input.spendingVisibility) as StatsVisibility)
    : statsVisibility;

  const organizerName = optStr(input.organizerName, 120, 'HURIZA Campaign Organizer');
  const beneficiaryName = optStr(input.beneficiaryName, 120, '');
  const beneficiaryType = ['self', 'individual', 'family', 'child_protected', 'community', 'organization'].includes(
    String(input.beneficiaryType)
  )
    ? String(input.beneficiaryType)
    : subcategory === 'child_welfare'
    ? 'child_protected'
    : 'community';

  const isChildProtected = subcategory === 'child_welfare' || beneficiaryType === 'child_protected';
  const finalContributorsVisibility: StatsVisibility = isChildProtected ? 'team_only' : contributorsVisibility;
  const initialVerificationStatus: CampaignVerificationStatus = isChildProtected ? 'pending_review' : 'unverified';

  const location = optStr(input.location, 120, 'Kigali, Rwanda');
  const eventDate = typeof input.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) ? input.eventDate : null;
  const coverImageUrl = optStr(
    input.coverImageUrl,
    500,
    family === 'moments'
      ? 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'
      : family === 'community'
      ? 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80'
      : 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=80'
  );
  const videoUrl = optStr(input.videoUrl, 500, '');
  const allowComments = input.allowComments !== false;
  const allowAnonymous = input.allowAnonymous !== false;
  const allowRsvp = Boolean(input.allowRsvp ?? family === 'moments');
  const suggestedAmounts = optStr(input.suggestedAmounts, 100, '5000,10000,25000,50000');

  const campaignId = id('campaign');
  await sql.query(
    'INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [campaignId, actor.tenantId, orgId, title, category, description, target, 'active']
  );

  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, event_date, story, cover_image_url, video_url,
       visibility, stats_visibility, goal_visibility, raised_visibility,
       contributors_visibility, spending_visibility,
       allow_comments, allow_anonymous, allow_rsvp, suggested_amounts, verification_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
    [
      campaignId,
      actor.tenantId,
      orgId,
      slug,
      family,
      subcategory,
      theme,
      actor.userId,
      organizerName,
      beneficiaryName,
      beneficiaryType,
      location,
      eventDate,
      story,
      coverImageUrl,
      videoUrl,
      visibility,
      statsVisibility,
      goalVisibility,
      raisedVisibility,
      finalContributorsVisibility,
      spendingVisibility,
      allowComments,
      allowAnonymous,
      allowRsvp,
      suggestedAmounts,
      initialVerificationStatus,
    ]
  );

  // Assign creator as owner in team members
  await sql.query(
    `INSERT INTO fundraising_team_members(id,tenant_id,org_id,campaign_id,user_id,user_name,campaign_role,team_name,assigned_by)
     VALUES($1,$2,$3,$4,$5,$6,'owner','Core Organizing Team',$5)
     ON CONFLICT (tenant_id,org_id,campaign_id,user_id) DO NOTHING`,
    [id('fteam'), actor.tenantId, orgId, campaignId, actor.userId, organizerName]
  );

  // Add cover image to media gallery
  if (coverImageUrl) {
    await sql.query(
      `INSERT INTO fundraising_campaign_media(id,tenant_id,org_id,campaign_id,media_type,url,caption,sort_order,uploaded_by)
       VALUES($1,$2,$3,$4,'cover',$5,$6,0,$7)`,
      [id('fmedia'), actor.tenantId, orgId, campaignId, coverImageUrl, title, actor.userId]
    );
  }

  // Optional initial milestones array
  if (Array.isArray(input.milestones)) {
    let idx = 0;
    for (const m of input.milestones) {
      if (m && typeof m === 'object' && 'title' in m && 'targetAmount' in m) {
        const mTitle = optStr((m as Record<string, unknown>).title, 120);
        const mAmt = Number((m as Record<string, unknown>).targetAmount);
        if (mTitle && Number.isSafeInteger(mAmt) && mAmt > 0) {
          await sql.query(
            `INSERT INTO fundraising_milestones(id,tenant_id,org_id,campaign_id,title,description,target_amount,sort_order)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              id('fmile'),
              actor.tenantId,
              orgId,
              campaignId,
              mTitle,
              optStr((m as Record<string, unknown>).description, 300),
              mAmt,
              idx++,
            ]
          );
        }
      }
    }
  }

  // Optional initial gift items array
  if (Array.isArray(input.giftItems)) {
    for (const g of input.giftItems) {
      if (g && typeof g === 'object' && 'title' in g && 'targetAmount' in g) {
        const gTitle = optStr((g as Record<string, unknown>).title, 120);
        const gAmt = Number((g as Record<string, unknown>).targetAmount);
        if (gTitle && Number.isSafeInteger(gAmt) && gAmt > 0) {
          await sql.query(
            `INSERT INTO fundraising_gift_items(id,tenant_id,org_id,campaign_id,title,description,target_amount,image_url)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              id('fgift'),
              actor.tenantId,
              orgId,
              campaignId,
              gTitle,
              optStr((g as Record<string, unknown>).description, 300),
              gAmt,
              optStr((g as Record<string, unknown>).imageUrl, 500),
            ]
          );
        }
      }
    }
  }

  return { id: campaignId, slug, synthetic: true };
}

/**
 * Seed the 5 flagship demonstration campaigns for HURIZA Fund.
 */
export async function seedFundraisingDemoCampaigns(
  sql: Sql,
  tenantId: string,
  orgId: string,
  schoolCampaignId: string,
  createSimulatedDonation: (
    userId: string,
    role: Role,
    campaignId: string,
    amount: number,
    ref: string
  ) => Promise<{ id: string }>
) {
  const hasTable =
    (
      await sql.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_campaign_profiles'"
      )
    ).rows.length > 0;
  if (!hasTable) return;

  // 1. Enrich the existing school-campaign (Campaign C: Children's Education)
  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, event_date, story, cover_image_url, visibility, stats_visibility,
       goal_visibility, raised_visibility, contributors_visibility, spending_visibility,
       allow_comments, allow_anonymous, allow_rsvp, suggested_amounts, verification_status, verification_notes
     ) VALUES (
       $1, $2, $3, 'support-school-children', 'causes', 'child_welfare', 'charity_warm',
       'president', 'School Futures Initiative · Gasabo', '100 Primary Students in Gasabo (Aggregated)', 'child_protected',
       'Gasabo District, Kigali', '2026-12-30',
       'Every child deserves the tools to learn with dignity. This simulated campaign pools community contributions to provide notebooks, mathematical sets, school uniforms, and nutritious school lunches for 100 primary school learners across Gasabo District. No personal identifying details of minors are published, and every franc spent is tracked through HURIZA TrustFlow.',
       'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=80',
       'public', 'everyone', 'everyone', 'everyone', 'everyone', 'everyone',
       true, true, false, '5000,15000,30000,100000', 'verified_demo',
       'Demo organizational profile verified within HURIZA simulation environment.'
     ) ON CONFLICT (campaign_id) DO NOTHING`,
    [schoolCampaignId, tenantId, orgId]
  );

  // Record contribution metadata for the 850,000 RWF seed donation on school-campaign
  const seedPay = (
    await sql.query(
      "SELECT id FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND reference='seed-school-donation'",
      [tenantId, orgId]
    )
  ).rows[0];
  if (seedPay) {
    await sql.query(
      `INSERT INTO fundraising_contributions(
         id, tenant_id, org_id, campaign_id, payment_id, user_id, contributor_name,
         display_preference, amount, contribution_type, channel, status, reference, message
       ) VALUES ($1,$2,$3,$4,$5,'member','Aline Uwase','public_name',850000,'one_time','mtn_momo','success','seed-school-donation','Wishing the students a bright and successful school term!')
       ON CONFLICT (tenant_id, org_id, reference) DO NOTHING`,
      [`${tenantId}-fcontrib-school-1`, tenantId, orgId, schoolCampaignId, String(seedPay.id)]
    );
  }

  // Milestones for School Supplies Campaign
  const schoolMilestones = [
    ['School Notebooks & Stationery Kits', 'Exercise books, pens, and geometry sets for 100 students', 500000, 500000, 0, 'funded_pending_execution'],
    ['School Uniforms & Shoes', 'Tailored uniforms and durable school shoes', 600000, 350000, 0, 'in_progress'],
    ['Term 1 Nutritious Lunch Program', 'Fortified porridge and balanced midday meals', 600000, 0, 0, 'planned'],
    ['Last-Mile Delivery & Distribution', 'Transport to 4 sector primary schools', 300000, 0, 0, 'planned'],
  ] as const;
  for (let i = 0; i < schoolMilestones.length; i++) {
    const [mTitle, mDesc, mTarget, mAlloc, mSpent, mStatus] = schoolMilestones[i];
    await sql.query(
      `INSERT INTO fundraising_milestones(id,tenant_id,org_id,campaign_id,title,description,target_amount,allocated_amount,spent_amount,outcome_status,sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [`${tenantId}-fmile-school-${i + 1}`, tenantId, orgId, schoolCampaignId, mTitle, mDesc, mTarget, mAlloc, mSpent, mStatus, i]
    );
  }

  await sql.query(
    `INSERT INTO fundraising_campaign_updates(id,tenant_id,org_id,campaign_id,update_type,title,body,media_url,author_id,author_name)
     VALUES($1,$2,$3,$4,'milestone','Milestone 1 Funded: Stationery Supplier Selected','Thanks to our early contributors, 850,000 RWF has been confirmed! We have completed supplier quotes in Kigali for 1,200 exercise books and geometry kits.','https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80','president','Jean Mugisha')
     ON CONFLICT (id) DO NOTHING`,
    [`${tenantId}-fupd-school-1`, tenantId, orgId, schoolCampaignId]
  );

  // 2. Campaign A — Wedding Celebration (uwase-wedding-2026)
  // Uses ID starting with zz- so it sorts AFTER `${tenantId}-school-campaign` in existing tests!
  const weddingId = `${tenantId}-zz-campaign-wedding`;
  await sql.query(
    `INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target,status)
     VALUES($1,$2,$3,'SIMULATED · Uwase & Kevin Wedding Celebration','Moments','Join families and friends in celebrating the wedding & Gusaba ceremony of Uwase Clarisse and Kevin Nshimiyimana.',3500000,'active')
     ON CONFLICT (id) DO NOTHING`,
    [weddingId, tenantId, orgId]
  );
  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, event_date, story, cover_image_url, visibility, stats_visibility,
       goal_visibility, raised_visibility, contributors_visibility, spending_visibility,
       allow_comments, allow_anonymous, allow_rsvp, suggested_amounts, verification_status
     ) VALUES (
       $1, $2, $3, 'uwase-wedding-2026', 'moments', 'wedding', 'wedding_elegant',
       'president', 'Uwase & Kevin Wedding Committee', 'Uwase Clarisse & Kevin Nshimiyimana', 'family',
       'Intare Gardens, Rusororo · Kigali', '2026-12-12',
       'Murakaza neza! With joyful hearts, our families invite you to celebrate the traditional Gusaba & religious wedding ceremony of Uwase Clarisse and Kevin Nshimiyimana on December 12, 2026. Your blessings, prayers, RSVPs, and contributions toward our wedding celebration and new family home registry mean the world to us. Note: Total raised statistics are shared with our organizing committee and selected family contributors.',
       'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
       'public', 'selected_contributors', 'selected_contributors', 'selected_contributors', 'everyone', 'team_only',
       true, true, true, '10000,25000,50000,100000', 'verified_demo'
     ) ON CONFLICT (campaign_id) DO NOTHING`,
    [weddingId, tenantId, orgId]
  );

  // Grant 'member' selected_stats access on the wedding campaign so demo users can see and test selected contributor access!
  await sql.query(
    `INSERT INTO fundraising_access_grants(id,tenant_id,org_id,campaign_id,user_id,user_name,grant_type,status,granted_by)
     VALUES($1,$2,$3,$4,'member','Aline Uwase','selected_stats','active','president')
     ON CONFLICT (tenant_id,org_id,campaign_id,user_id,grant_type) DO NOTHING`,
    [`${tenantId}-fgrant-wedding-1`, tenantId, orgId, weddingId]
  );

  const weddingGifts = [
    ['Traditional Gusaba Hospitality & Decor', 'Inkongoro, traditional dancers (Itorero), and garden floral setup', 1200000, 450000, 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80', 'partially_funded'],
    ['New Home Kitchen & Refrigerator Registry', 'Energy-efficient refrigerator and cookware set for our new home', 800000, 800000, 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80', 'fulfilled'],
    ['Lake Kivu Honeymoon Retreat', '3-night retreat in Karongi after the ceremony', 600000, 150000, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', 'partially_funded'],
  ] as const;
  for (let i = 0; i < weddingGifts.length; i++) {
    const [gTitle, gDesc, gTarget, gContrib, gImg, gStatus] = weddingGifts[i];
    await sql.query(
      `INSERT INTO fundraising_gift_items(id,tenant_id,org_id,campaign_id,title,description,target_amount,contributed_amount,image_url,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [`${tenantId}-fgift-wedding-${i + 1}`, tenantId, orgId, weddingId, gTitle, gDesc, gTarget, gContrib, gImg, gStatus]
    );
  }

  await sql.query(
    `INSERT INTO fundraising_comments(id,tenant_id,org_id,campaign_id,author_id,author_name,is_anonymous,comment_type,message,reaction)
     VALUES
       ($1,$2,$3,$4,'member','Aline Uwase',false,'guestbook','Urugo ruhire Clarisse & Kevin! Wishing you a lifetime of love, peace and blessings.','celebrate'),
       ($5,$2,$3,$4,'treasurer','Diane Keza',false,'congratulation','So happy for both of you! Counting down the days to December 12!','heart')
     ON CONFLICT (id) DO NOTHING`,
    [`${tenantId}-fcomm-wed-1`, tenantId, orgId, weddingId, `${tenantId}-fcomm-wed-2`]
  );

  await sql.query(
    `INSERT INTO fundraising_rsvps(id,tenant_id,org_id,campaign_id,user_id,guest_name,attendance_status,guests_count,dietary_or_note)
     VALUES($1,$2,$3,$4,'member','Aline Uwase','attending',2,'Attending both Gusaba and Church ceremony')
     ON CONFLICT (tenant_id,org_id,campaign_id,user_id) DO NOTHING`,
    [`${tenantId}-frsvp-wed-1`, tenantId, orgId, weddingId]
  );

  // 3. Campaign B — Birthday Celebration (celebrate-aline-birthday)
  const birthdayId = `${tenantId}-zz-campaign-birthday`;
  await sql.query(
    `INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target,status)
     VALUES($1,$2,$3,'SIMULATED · Celebrate Aline''s Birthday & Creative Studio Gift','Moments','Friends pooling together for Aline''s milestone birthday and her graphic design laptop fund.',800000,'active')
     ON CONFLICT (id) DO NOTHING`,
    [birthdayId, tenantId, orgId]
  );
  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, event_date, story, cover_image_url, visibility, stats_visibility,
       allow_comments, allow_anonymous, allow_rsvp, suggested_amounts, verification_status
     ) VALUES (
       $1, $2, $3, 'celebrate-aline-birthday', 'moments', 'birthday', 'birthday_celebration',
       'treasurer', 'Diane Keza & Friends', 'Aline Uwase', 'individual',
       'Kimihurura · Kigali', '2026-11-25',
       'Aline has always been the first to support everyone in our community! For her birthday this November, we are surprising her with a group gift: a high-resolution creative workstation laptop for her design projects, plus a celebratory dinner with friends.',
       'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80',
       'public', 'everyone', true, true, true, '5000,10000,20000,50000', 'verified_demo'
     ) ON CONFLICT (campaign_id) DO NOTHING`,
    [birthdayId, tenantId, orgId]
  );

  // 4. Campaign D — Community Water Project (community-water-project)
  const waterId = `${tenantId}-zz-campaign-water`;
  await sql.query(
    `INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target,status)
     VALUES($1,$2,$3,'SIMULATED · Clean Solar Water Kiosk for Rulindo Community','Community','Community-led solar water filtration and storage kiosk serving 250 rural households.',4500000,'active')
     ON CONFLICT (id) DO NOTHING`,
    [waterId, tenantId, orgId]
  );
  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, event_date, story, cover_image_url, visibility, stats_visibility,
       allow_comments, allow_anonymous, allow_rsvp, suggested_amounts, verification_status
     ) VALUES (
       $1, $2, $3, 'community-water-project', 'community', 'water_project', 'community_impact',
       'president', 'Rulindo Water & Wash Committee', 'Bushoki Sector Residents', 'community',
       'Bushoki Sector, Rulindo District', '2027-02-28',
       'Access to clean water transforms rural health and saves hours of daily walking. Our community committee in Bushoki Sector is installing a 10,000-liter solar-powered water pumping and filtration kiosk. Every milestone is audited through HURIZA TrustFlow before supplier disbursement.',
       'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
       'public', 'everyone', true, true, false, '10000,25000,50000,200000', 'verified_demo'
     ) ON CONFLICT (campaign_id) DO NOTHING`,
    [waterId, tenantId, orgId]
  );

  await sql.query(
    `INSERT INTO fundraising_matching_pledges(id,tenant_id,org_id,campaign_id,sponsor_name,pledged_amount,confirmed_amount,match_ratio_bps,status)
     VALUES($1,$2,$3,$4,'SIMULATED · AquaForAll Rwanda Partner Pledge',1500000,500000,10000,'active')
     ON CONFLICT (id) DO NOTHING`,
    [`${tenantId}-fmatch-water-1`, tenantId, orgId, waterId]
  );

  const waterMilestones = [
    ['Site Survey & Borehole Civil Works', 'Hydrogeological check and concrete foundation pad', 1200000, 0, 0, 'in_progress'],
    ['10,000L Tank & Solar Pump Installation', 'High-efficiency submersible solar pump and elevated tank', 2300000, 0, 0, 'planned'],
    ['Community Tap Stand & Water Meter Setup', '4 clean dispensing taps and community maintenance training', 1000000, 0, 0, 'planned'],
  ] as const;
  for (let i = 0; i < waterMilestones.length; i++) {
    const [mTitle, mDesc, mTarget, mAlloc, mSpent, mStatus] = waterMilestones[i];
    await sql.query(
      `INSERT INTO fundraising_milestones(id,tenant_id,org_id,campaign_id,title,description,target_amount,allocated_amount,spent_amount,outcome_status,sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [`${tenantId}-fmile-water-${i + 1}`, tenantId, orgId, waterId, mTitle, mDesc, mTarget, mAlloc, mSpent, mStatus, i]
    );
  }

  // 5. Campaign E — Medical Support (medical-support-jean-bosco)
  const medicalId = `${tenantId}-zz-campaign-medical`;
  await sql.query(
    `INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target,status)
     VALUES($1,$2,$3,'SIMULATED · Orthopedic Recovery & Physiotherapy for Jean Bosco','Causes','Fictional adult medical rehabilitation campaign demonstrating respectful privacy controls.',1800000,'active')
     ON CONFLICT (id) DO NOTHING`,
    [medicalId, tenantId, orgId]
  );
  await sql.query(
    `INSERT INTO fundraising_campaign_profiles(
       campaign_id, tenant_id, org_id, slug, family, subcategory, theme,
       organizer_user_id, organizer_name, beneficiary_name, beneficiary_type,
       location, event_date, story, cover_image_url, visibility, stats_visibility,
       goal_visibility, raised_visibility, contributors_visibility, spending_visibility,
       allow_comments, allow_anonymous, allow_rsvp, suggested_amounts, verification_status
     ) VALUES (
       $1, $2, $3, 'medical-support-jean-bosco', 'causes', 'medical', 'medical_trust',
       'president', 'Family Solidarity Committee', 'Jean Bosco Habimana (Fictional Demo)', 'individual',
       'Nyarugenge · Kigali', '2026-12-15',
       'Following a road traffic injury, Jean Bosco is completing a 12-week orthopedic rehabilitation and physiotherapy program. To respect medical privacy, clinical records are never published online; hospital invoice settlements are verified directly by the organizing treasurer and approver.',
       'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
       'public', 'everyone', 'everyone', 'everyone', 'contributors_only', 'contributors_only',
       true, true, false, '5000,10000,25000,50000', 'verified_demo'
     ) ON CONFLICT (campaign_id) DO NOTHING`,
    [medicalId, tenantId, orgId]
  );
}
