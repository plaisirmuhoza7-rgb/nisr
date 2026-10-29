import type { Metadata } from 'next';
import Link from 'next/link';
import { loadCampaignBySlugOrId } from '@/server/fundraising/public-loader';
import { CampaignPageClient } from './campaign-page-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata(context: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await context.params;
  const { campaign } = await loadCampaignBySlugOrId(slug);

  if (!campaign || campaign.visibility === 'private') {
    return {
      title: 'Private or Restricted Campaign · HURIZA Fund',
      description: 'This campaign page is private and accessible only to invited supporters.',
      robots: { index: false, follow: false },
    };
  }

  const isUnlisted = campaign.visibility === 'unlisted';
  const publicRaisedAllowed =
    campaign.privacyPolicy.statsVisibility === 'everyone' &&
    campaign.privacyPolicy.raisedVisibility === 'everyone' &&
    campaign.raised !== null;

  const statsSuffix = publicRaisedAllowed
    ? ` · ${campaign.raised!.toLocaleString()} RWF raised`
    : '';

  return {
    title: `${campaign.title}${statsSuffix} · HURIZA Fund`,
    description: campaign.description.slice(0, 160),
    robots: isUnlisted ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${campaign.title} · HURIZA Fund`,
      description: campaign.description.slice(0, 160),
      type: 'website',
      images: campaign.coverImageUrl ? [{ url: campaign.coverImageUrl }] : undefined,
    },
  };
}

export default async function CampaignSlugPage(context: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await context.params;
  const { campaign, user, isAuthenticated } = await loadCampaignBySlugOrId(slug);

  if (!campaign) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f4f7fb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: 36,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: '#0f172a' }}>
            Campaign Not Found or Private Access Required
          </h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 24px' }}>
            This campaign may be set to private invitation-only visibility, or the URL slug may have
            changed. Sign in with an authorized account or explore public campaigns.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/fund"
              style={{
                background: '#0b3b99',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              ← Explore Public Campaigns
            </Link>
            <Link
              href="/login"
              style={{
                background: '#eff6ff',
                color: '#0b3b99',
                border: '1px solid #bfdbfe',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CampaignPageClient
      initialCampaign={campaign}
      isAuthenticated={isAuthenticated}
      currentUserId={user?.id}
      currentUserRole={user?.role}
    />
  );
}
