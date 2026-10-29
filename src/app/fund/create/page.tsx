'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FundraisingCreateWizard } from '@/components/fundraising-create-wizard';

export default function FundCreatePage() {
  const router = useRouter();

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
            maxWidth: 1120,
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
              Guided Campaign Creation Studio
            </span>
          </div>
          <Link
            href="/app/fundraising"
            style={{
              color: '#dbeafe',
              textDecoration: 'none',
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            Organizer Workspace →
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 64px' }}>
        <FundraisingCreateWizard
          onCreated={res => {
            router.push(`/fund/campaigns/${encodeURIComponent(res.slug)}`);
          }}
          onCancel={() => {
            router.push('/fund');
          }}
        />
      </main>
    </div>
  );
}
