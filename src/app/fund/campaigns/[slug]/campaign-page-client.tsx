'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { FundraisingCampaignDetail } from '@/lib/contracts';
import { FundraisingCampaignView } from '@/components/fundraising-campaign-view';

interface CampaignPageClientProps {
  initialCampaign: FundraisingCampaignDetail;
  isAuthenticated: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

export function CampaignPageClient({
  initialCampaign,
  isAuthenticated,
  currentUserId,
  currentUserRole,
}: CampaignPageClientProps) {
  const [campaign, setCampaign] = useState<FundraisingCampaignDetail>(initialCampaign);
  const router = useRouter();

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/fund/campaigns/${encodeURIComponent(campaign.slug)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { campaign?: FundraisingCampaignDetail };
        if (data.campaign) {
          setCampaign(data.campaign);
        }
      }
      router.refresh();
    } catch {
      // ignore transient network refresh error
    }
  }, [campaign.slug, router]);

  return (
    <FundraisingCampaignView
      campaign={campaign}
      isAuthenticated={isAuthenticated}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      onRefresh={handleRefresh}
    />
  );
}
