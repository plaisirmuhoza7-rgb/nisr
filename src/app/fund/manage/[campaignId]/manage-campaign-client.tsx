'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import type { FundraisingState } from '@/lib/contracts';
import { FundraisingDashboard } from '@/components/fundraising-dashboard';

interface ManageCampaignClientProps {
  initialState: FundraisingState;
  campaignId: string;
  userRole: string;
  userId: string;
  userName?: string;
}

export function ManageCampaignClient({
  initialState,
  campaignId,
  userRole,
  userId,
  userName,
}: ManageCampaignClientProps) {
  const [fundraisingState, setFundraisingState] = useState<FundraisingState>(initialState);

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/fund/campaigns', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { state?: FundraisingState };
        if (data.state) {
          setFundraisingState(data.state);
        }
      }
    } catch {
      // ignore transient network refresh error
    }
  }, []);

  const handleAction = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'fund-school', ...payload }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; result?: unknown };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Action failed');
      }
      await handleRefresh();
      return data.result;
    },
    [handleRefresh]
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{
          background: '#081d40',
          color: '#ffffff',
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link
              href="/fund"
              style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 800, fontSize: 18 }}
            >
              ← HURIZA FUND
            </Link>
            <span style={{ color: '#93c5fd', fontSize: 13, fontWeight: 600 }}>
              Campaign Organizer &amp; Accountant Studio
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link
              href="/app/fundraising"
              style={{ color: '#dbeafe', textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}
            >
              Workspace View
            </Link>
            <Link
              href="/fund/create"
              style={{
                background: '#1d68f2',
                color: '#fff',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              + New Campaign
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 20px 64px' }}>
        <FundraisingDashboard
          fundraisingState={fundraisingState}
          initialCampaignId={campaignId}
          userRole={userRole}
          userId={userId}
          userName={userName}
          onAction={handleAction}
          onRefresh={handleRefresh}
        />
      </main>
    </div>
  );
}
