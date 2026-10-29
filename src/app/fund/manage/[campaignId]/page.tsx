import type { Metadata } from 'next';
import { loadFundDiscoveryState } from '@/server/fundraising/public-loader';
import { ManageCampaignClient } from './manage-campaign-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Campaign Management & TrustFlow Accounting · HURIZA Fund',
  robots: { index: false, follow: false },
};

export default async function ManageCampaignPage(context: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await context.params;
  const { state, user } = await loadFundDiscoveryState();

  return (
    <ManageCampaignClient
      initialState={state}
      campaignId={campaignId}
      userRole={user?.role || 'president'}
      userId={user?.id || 'president'}
      userName={user?.name}
    />
  );
}
