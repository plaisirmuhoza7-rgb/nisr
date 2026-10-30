'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { FundraisingCampaignDetail, FundraisingState, CampaignFamily } from '@/lib/contracts';

interface FundDiscoveryClientProps {
  initialState: FundraisingState;
  isAuthenticated: boolean;
  userName?: string;
}

const FAMILY_LABELS: Record<CampaignFamily | 'all', { title: string; subtitle: string }> = {
  all: {
    title: 'All Campaigns',
    subtitle: 'Explore verified demo causes, community projects, and life celebrations',
  },
  moments: {
    title: 'HURIZA Moments',
    subtitle: 'Weddings, Gusaba ceremonies, birthdays, graduations & group gifts',
  },
  causes: {
    title: 'HURIZA Causes',
    subtitle: 'Education, child welfare, medical recovery & family solidarity',
  },
  community: {
    title: 'HURIZA Community',
    subtitle: 'Clean water, community programs, cooperative & local infrastructure',
  },
};

export function FundDiscoveryClient({
  initialState,
  isAuthenticated,
  userName,
}: FundDiscoveryClientProps) {
  const [familyFilter, setFamilyFilter] = useState<CampaignFamily | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'raised' | 'newest'>('featured');

  const publicCampaigns = useMemo(
    () => initialState.campaigns.filter(c => c.visibility === 'public'),
    [initialState.campaigns]
  );

  const summary = useMemo(() => {
    let totalPublicRaised = 0;
    let totalConfirmedSpent = 0;
    let totalContributorsCount = 0;
    for (const c of publicCampaigns) {
      if (c.raised !== null) totalPublicRaised += c.raised;
      if (c.spent !== null) totalConfirmedSpent += c.spent;
      if (c.contributorCount !== null) totalContributorsCount += c.contributorCount;
    }
    return {
      totalPublicCampaigns: publicCampaigns.length,
      totalPublicRaised,
      totalConfirmedSpent,
      totalContributorsCount,
    };
  }, [publicCampaigns]);

  const subcategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of publicCampaigns) {
      if (familyFilter === 'all' || c.family === familyFilter) {
        set.add(c.subcategory);
      }
    }
    return Array.from(set);
  }, [publicCampaigns, familyFilter]);

  const filteredCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = publicCampaigns.filter(c => {
      if (familyFilter !== 'all' && c.family !== familyFilter) return false;
      if (subcategoryFilter !== 'all' && c.subcategory !== subcategoryFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.description} ${c.story} ${c.organizerName} ${c.beneficiaryName} ${c.location} ${c.subcategory}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'raised') {
      return [...list].sort((a, b) => (b.raised ?? 0) - (a.raised ?? 0));
    }
    if (sortBy === 'newest') {
      return [...list].sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    return list;
  }, [publicCampaigns, familyFilter, subcategoryFilter, searchQuery, sortBy]);

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Navigation Bar */}
      <header
        style={{
          background: '#081d40',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: '14px 24px',
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
              style={{
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  background: '#1d68f2',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                HURIZA
              </span>
              <span>FUND</span>
            </Link>
            <span
              style={{
                background: 'rgba(251, 191, 36, 0.18)',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                color: '#fde68a',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 999,
              }}
            >
              SIMULATED DEMO ECOSYSTEM · NO REAL FUNDS
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/app/fundraising"
              style={{
                color: '#cbd5e1',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                padding: '7px 12px',
              }}
            >
              {isAuthenticated ? `Organizer Workspace (${userName || 'Account'})` : 'Sign In / Workspace'}
            </Link>
            <Link
              href="/fund/create"
              style={{
                background: '#1d68f2',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 700,
                padding: '9px 18px',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(29, 104, 242, 0.35)',
              }}
            >
              + Start a Fundraiser
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, #071936 0%, #0d3273 60%, #1449a6 100%)',
          color: '#ffffff',
          padding: '56px 24px 48px',
        }}
      >
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ maxWidth: 780 }}>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.12)',
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              OPERATION COMMUNITY IMPACT · RWANDA SOCIAL FUNDRAISING & TRUSTFLOW
            </div>
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 44px)',
                fontWeight: 800,
                lineHeight: 1.15,
                margin: '0 0 16px',
                letterSpacing: '-0.02em',
              }}
            >
              Every Cause Has a Story. Every Contribution Makes a Difference.
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: '#dbeafe',
                margin: '0 0 28px',
              }}
            >
              From traditional wedding celebrations (Gusaba) and milestone birthdays to verified school
              futures, medical solidarity, and clean rural water projects — every campaign receives its
              own digital home backed by HURIZA double-entry ledger accountability and Guardian privacy
              protection.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link
                href="/fund/create"
                style={{
                  background: '#ffffff',
                  color: '#0b2d6b',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: 15,
                  padding: '12px 24px',
                  borderRadius: 8,
                }}
              >
                Launch a Campaign →
              </Link>
              <Link
                href="/app/fundraising"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.28)',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '12px 22px',
                  borderRadius: 8,
                }}
              >
                Open Accountant & Organizer Hub
              </Link>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginTop: 40,
              paddingTop: 28,
              borderTop: '1px solid rgba(255,255,255,0.16)',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase' }}>
                Public Active Campaigns
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                {summary.totalPublicCampaigns}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase' }}>
                Confirmed Public Raised (Sim)
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                {summary.totalPublicRaised.toLocaleString()} RWF
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase' }}>
                Verified TrustFlow Disbursements
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                {summary.totalConfirmedSpent.toLocaleString()} RWF
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase' }}>
                Community Contributions
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                {summary.totalContributorsCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Discovery Body */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 24px 72px' }}>
        {/* 3 Family Selector Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14,
            marginBottom: 28,
          }}
        >
          {(['all', 'moments', 'causes', 'community'] as const).map(fam => {
            const active = familyFilter === fam;
            return (
              <button
                key={fam}
                type="button"
                onClick={() => {
                  setFamilyFilter(fam);
                  setSubcategoryFilter('all');
                }}
                style={{
                  textAlign: 'left',
                  padding: '16px 18px',
                  borderRadius: 12,
                  border: active ? '2px solid #1d68f2' : '1px solid #cbd5e1',
                  background: active ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 16,
                    color: active ? '#0b3b99' : '#0f172a',
                    marginBottom: 4,
                  }}
                >
                  {FAMILY_LABELS[fam].title}
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.4 }}>
                  {FAMILY_LABELS[fam].subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search campaigns by title, beneficiary, district, or keyword..."
            style={{
              flex: '1 1 300px',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 14,
            }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={subcategoryFilter}
              onChange={e => setSubcategoryFilter(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                background: '#fff',
              }}
            >
              <option value="all">All Categories</option>
              {subcategories.map(sub => (
                <option key={sub} value={sub}>
                  {sub.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'featured' | 'raised' | 'newest')}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                background: '#fff',
              }}
            >
              <option value="featured">Sort: Featured Impact</option>
              <option value="raised">Sort: Most Raised</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>
        </div>

        {/* Campaign Cards Grid */}
        {filteredCampaigns.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>No matching campaigns found</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
              Try clearing your search filters or start a new fundraising campaign.
            </p>
            <Link
              href="/fund/create"
              style={{
                background: '#1d68f2',
                color: '#fff',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              + Start a Fundraiser
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 24,
            }}
          >
            {filteredCampaigns.map((c: FundraisingCampaignDetail) => {
              const hasPublicTotals = c.viewerAccess.canViewRaised && c.raised !== null;
              const pct =
                hasPublicTotals && c.target && c.target > 0
                  ? Math.min(100, Math.round(((c.raised ?? 0) / c.target) * 100))
                  : 0;
              return (
                <article
                  key={c.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  {/* Cover Image */}
                  <div
                    style={{
                      height: 195,
                      background: c.coverImageUrl
                        ? `url(${c.coverImageUrl}) center/cover no-repeat`
                        : 'linear-gradient(135deg, #0b3b99, #1d68f2)',
                      position: 'relative',
                      padding: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        background: 'rgba(15, 23, 42, 0.82)',
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.family} · {c.subcategory.replace(/_/g, ' ')}
                    </span>
                    {c.verificationStatus === 'verified_demo' && (
                      <span
                        style={{
                          background: '#059669',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                        }}
                      >
                        ✓ Verified Demo
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                      📍 {c.location} {c.eventDate ? `· 📅 ${c.eventDate}` : ''}
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.3 }}>
                      <Link
                        href={`/fund/campaigns/${c.slug}`}
                        style={{ color: '#0f172a', textDecoration: 'none' }}
                      >
                        {c.title}
                      </Link>
                    </h2>
                    <p
                      style={{
                        fontSize: 13.5,
                        color: '#475569',
                        lineHeight: 1.5,
                        margin: '0 0 16px',
                        flex: 1,
                      }}
                    >
                      {c.description.length > 135 ? `${c.description.slice(0, 135)}...` : c.description}
                    </p>

                    {/* Financial Progress or Privacy Notice */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 16,
                      }}
                    >
                      {hasPublicTotals ? (
                        <>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: 16, color: '#0b3b99' }}>
                              {(c.raised ?? 0).toLocaleString()} RWF
                            </span>
                            {c.target !== null && (
                              <span style={{ fontSize: 12, color: '#64748b' }}>
                                of {c.target.toLocaleString()} RWF ({pct}%)
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              height: 7,
                              background: '#e2e8f0',
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: '#1d68f2',
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 12,
                              color: '#64748b',
                              marginTop: 8,
                            }}
                          >
                            <span>{c.contributorCount ?? 0} supporter(s)</span>
                            {c.milestones.length > 0 && (
                              <span>{c.milestones.length} TrustFlow milestones</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>
                          🔒 Financial totals are shared privately with authorized contributors &amp; event
                          organizers ({c.privacyPolicy.raisedVisibility.replace(/_/g, ' ')}).
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Link
                        href={`/fund/campaigns/${c.slug}`}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          background: '#0b3b99',
                          color: '#ffffff',
                          textDecoration: 'none',
                          padding: '10px 14px',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13.5,
                        }}
                      >
                        Open Campaign Page →
                      </Link>
                      {c.viewerAccess.isOrganizerOrTeam && (
                        <Link
                          href={`/fund/manage/${c.id}`}
                          style={{
                            background: '#eff6ff',
                            color: '#0b3b99',
                            border: '1px solid #bfdbfe',
                            textDecoration: 'none',
                            padding: '10px 12px',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          Manage
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
