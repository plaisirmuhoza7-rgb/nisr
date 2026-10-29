import type { Metadata } from 'next';
import { loadFundDiscoveryState } from '@/server/fundraising/public-loader';
import { FundDiscoveryClient } from './fund-discovery-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HURIZA Fund · Community Impact, Causes & Celebration Campaigns',
  description:
    'Explore transparent community fundraising campaigns, wedding & birthday celebrations, and verified demo causes powered by HURIZA TrustFlow.',
};

export default async function FundDiscoveryPage() {
  const { state, user, isAuthenticated } = await loadFundDiscoveryState();
  return (
    <FundDiscoveryClient
      initialState={state}
      isAuthenticated={isAuthenticated}
      userName={user?.name}
    />
  );
}
