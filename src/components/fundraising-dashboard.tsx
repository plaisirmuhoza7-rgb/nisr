'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type {
  FundraisingState,
  FundraisingCampaignDetail,
  CampaignFamily,
  CampaignVisibility,
  StatsVisibility,
  CampaignTheme,
  CampaignRole,
  CampaignVerificationStatus,
  FundraisingContribution,
  FundraisingMilestone,
  FundraisingExpense,
  FundraisingAccessGrant,
  FundraisingTeamMember,
  FundraisingGuardianInsight,
} from '@/lib/contracts';
import {
  HeartHandshake,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Users,
  Eye,
  Lock,
  ExternalLink,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Award,
  Gift,
  Share2,
  Calendar,
  Send,
  Sliders,
  DollarSign,
  UserCheck,
  UserX,
  FileText,
  X,
  ChevronRight,
  Info,
  Check,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import s from './fundraising-dashboard.module.css';

export interface FundraisingDashboardProps {
  fundraisingState?: FundraisingState;
  initialCampaignId?: string;
  userRole: string;
  userId: string;
  userName?: string;
  onAction: (payload: Record<string, unknown>) => Promise<unknown>;
  onRefresh?: () => Promise<void> | void;
}

type TabKey = 'overview' | 'contributions' | 'trustflow' | 'engagement' | 'privacy' | 'governance';

interface FundraisingSummary {
  totalPublicCampaigns: number;
  totalPublicRaised: number;
  totalConfirmedSpent: number;
  totalContributorsCount: number;
}

export function FundraisingDashboard({
  fundraisingState,
  initialCampaignId,
  userRole,
  userId,
  userName = 'Campaign Officer',
  onAction,
  onRefresh,
}: FundraisingDashboardProps) {
  const campaigns = useMemo(() => fundraisingState?.campaigns || [], [fundraisingState?.campaigns]);
  const myCampaigns = useMemo(() => fundraisingState?.myCampaigns || [], [fundraisingState?.myCampaigns]);
  const myCampaignIds = useMemo(() => new Set(myCampaigns.map(c => c.id)), [myCampaigns]);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    initialCampaignId || campaigns[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Keep selected campaign valid if campaigns change
  useEffect(() => {
    if (!campaigns.length) return;
    const exists = campaigns.some(c => c.id === selectedCampaignId);
    if (!exists) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const selectedCampaign: FundraisingCampaignDetail | null = useMemo(() => {
    if (!campaigns.length) return null;
    return campaigns.find(c => c.id === selectedCampaignId) || campaigns[0] || null;
  }, [campaigns, selectedCampaignId]);

  // Executive summary
  const summary: FundraisingSummary = useMemo(() => {
    const fromState = (fundraisingState as { summary?: FundraisingSummary } | undefined)?.summary;
    if (fromState) return fromState;
    return {
      totalPublicCampaigns: campaigns.filter(c => c.visibility === 'public').length,
      totalPublicRaised: campaigns.reduce((acc, c) => acc + (c.raised ?? 0), 0),
      totalConfirmedSpent: campaigns.reduce((acc, c) => acc + (c.spent ?? 0), 0),
      totalContributorsCount: campaigns.reduce((acc, c) => acc + (c.contributorCount ?? 0), 0),
    };
  }, [fundraisingState, campaigns]);

  const handleAction = async (payload: Record<string, unknown>, successMessage?: string) => {
    try {
      setIsBusy(true);
      setFeedback(null);
      await onAction(payload);
      if (successMessage) {
        setFeedback({ type: 'success', message: successMessage });
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed. Please check inputs.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsBusy(false);
    }
  };

  const familyBadgeClass = (family: CampaignFamily) => {
    switch (family) {
      case 'causes':
        return s.pillInfo;
      case 'community':
        return s.pillPurple;
      case 'moments':
      default:
        return s.pillSuccess;
    }
  };

  const visibilityBadgeClass = (vis: CampaignVisibility) => {
    switch (vis) {
      case 'public':
        return s.pillSuccess;
      case 'unlisted':
        return s.pillPending;
      case 'private':
        return s.pillNeutral;
      default:
        return s.pillNeutral;
    }
  };

  const verificationBadgeClass = (status: CampaignVerificationStatus) => {
    switch (status) {
      case 'verified_demo':
        return s.pillSuccess;
      case 'pending_review':
        return s.pillPending;
      case 'requires_review':
      case 'suspended':
        return s.pillDanger;
      case 'unverified':
      default:
        return s.pillNeutral;
    }
  };

  return (
    <div className={s.wrapper}>
      {/* 1. Top Executive Header & Summary Bar */}
      <div className={s.headerCard}>
        <div className={s.headerTop}>
          <div className={s.titleArea}>
            <div className={s.badgeRow}>
              <span className={s.envBadge}>
                <ShieldCheck size={13} />
                SIMULATED DEMO ENVIRONMENT
              </span>
              <span className={s.roleBadge}>{userRole}</span>
              {userName && <span className={s.roleBadge}>{userName}</span>}
            </div>
            <h1 className={s.dashboardTitle}>
              <HeartHandshake size={26} />
              HURIZA Fund · Community Impact &amp; Campaign Governance
            </h1>
            <div className={s.dashboardMeta}>
              <span>Multi-tenant campaign ledger &amp; TrustFlow milestone disbursements</span>
              <span>•</span>
              <span>100% Safe integer RWF ledger math</span>
            </div>
          </div>
          <div className={s.headerActions}>
            <Link href="/fund" className={s.navBtnSecondary}>
              <Eye size={14} />
              Explore Public Campaigns (/fund)
            </Link>
            <Link href="/fund/create" className={s.navBtnPrimary}>
              <Plus size={15} />
              + Launch New Campaign Wizard
            </Link>
            {selectedCampaign && (
              <Link
                href={`/fund/campaigns/${selectedCampaign.slug}`}
                className={s.navBtnSecondary}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
                Open Public Campaign Page ↗
              </Link>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                className={s.refreshBtn}
                disabled={isBusy}
                title="Refresh state"
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              Active Campaigns
              <Sparkles size={14} color="#174f83" />
            </span>
            <span className={s.kpiValue}>{summary.totalPublicCampaigns}</span>
            <span className={s.kpiSub}>Public discovery pool</span>
          </div>
          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              Total Confirmed Raised
              <Coins size={14} color="#166534" />
            </span>
            <span className={s.kpiValue}>
              {summary.totalPublicRaised.toLocaleString()} <small style={{ fontSize: 13 }}>RWF</small>
            </span>
            <span className={s.kpiSub}>Safe integer posted cash</span>
          </div>
          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              Confirmed Disbursements
              <Receipt size={14} color="#92400e" />
            </span>
            <span className={s.kpiValue}>
              {summary.totalConfirmedSpent.toLocaleString()} <small style={{ fontSize: 13 }}>RWF</small>
            </span>
            <span className={s.kpiSub}>TrustFlow verified expenses</span>
          </div>
          <div className={s.kpiCard}>
            <span className={s.kpiLabel}>
              Total Supporters
              <Users size={14} color="#2563eb" />
            </span>
            <span className={s.kpiValue}>{summary.totalContributorsCount}</span>
            <span className={s.kpiSub}>Community backers</span>
          </div>
        </div>
      </div>

      {/* Global Action Feedback Alert */}
      {feedback && (
        <div
          className={`${s.feedbackAlert} ${
            feedback.type === 'success' ? s.feedbackSuccess : s.feedbackError
          }`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            className={s.dismissBtn}
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Campaign Switcher Bar */}
      <div className={s.switcherBar}>
        <div className={s.switcherHeader}>
          <div className={s.switcherTitle}>
            <Sliders size={15} />
            <span>Campaign Switcher &amp; Portfolio</span>
          </div>
          <span className={s.switcherCount}>
            {campaigns.length} accessible campaign{campaigns.length === 1 ? '' : 's'}
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div className={s.emptyState}>
            <p className={s.emptyStateTitle}>No campaigns registered yet</p>
            <p>Launch your first HURIZA campaign to start tracking contributions and TrustFlow milestones.</p>
            <Link href="/fund/create" className={s.btnPrimary}>
              <Plus size={14} /> Launch First Campaign
            </Link>
          </div>
        ) : (
          <div className={s.switcherList}>
            {campaigns.map(camp => {
              const isSelected = camp.id === selectedCampaign?.id;
              const isMine = myCampaignIds.has(camp.id);
              return (
                <button
                  key={camp.id}
                  type="button"
                  onClick={() => setSelectedCampaignId(camp.id)}
                  className={`${s.switcherCard} ${isSelected ? s.switcherCardActive : ''}`}
                >
                  <div className={s.switcherItemTop}>
                    <span className={s.switcherCampaignTitle}>{camp.title}</span>
                    {isMine && <span className={s.myCampaignTag}>My Campaign</span>}
                  </div>
                  <div className={s.switcherBadgeRow}>
                    <span className={`${s.pill} ${familyBadgeClass(camp.family)}`}>{camp.family}</span>
                    <span className={`${s.pill} ${visibilityBadgeClass(camp.visibility)}`}>
                      {camp.visibility}
                    </span>
                    <span className={`${s.pill} ${verificationBadgeClass(camp.verificationStatus)}`}>
                      {camp.verificationStatus.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* If no campaign is selected, stop here */}
      {!selectedCampaign ? null : (
        <>
          {/* 6 Management Tabs for the Selected Campaign */}
          <div className={s.tabBar} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              className={`${s.tabButton} ${activeTab === 'overview' ? s.tabButtonActive : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <TrendingUp size={15} />
              Overview &amp; Guardian
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'contributions'}
              className={`${s.tabButton} ${activeTab === 'contributions' ? s.tabButtonActive : ''}`}
              onClick={() => setActiveTab('contributions')}
            >
              <Coins size={15} />
              Contributions &amp; MoMo ({selectedCampaign.contributions?.length ?? 0})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'trustflow'}
              className={`${s.tabButton} ${activeTab === 'trustflow' ? s.tabButtonActive : ''}`}
              onClick={() => setActiveTab('trustflow')}
            >
              <Receipt size={15} />
              TrustFlow &amp; Milestones ({selectedCampaign.expenses?.length ?? 0})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'engagement'}
              className={`${s.tabButton} ${activeTab === 'engagement' ? s.tabButtonActive : ''}`}
              onClick={() => setActiveTab('engagement')}
            >
              <Sparkles size={15} />
              Engagement &amp; Moments
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'privacy'}
              className={`${s.tabButton} ${activeTab === 'privacy' ? s.tabButtonActive : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              <Lock size={15} />
              Privacy &amp; Grants
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'governance'}
              className={`${s.tabButton} ${activeTab === 'governance' ? s.tabButtonActive : ''}`}
              onClick={() => setActiveTab('governance')}
            >
              <ShieldCheck size={15} />
              Team &amp; Governance
            </button>
          </div>

          <div className={s.tabContent}>
            {activeTab === 'overview' && (
              <TabOverview
                campaign={selectedCampaign}
                userRole={userRole}
                userName={userName}
                isBusy={isBusy}
                onAction={handleAction}
              />
            )}
            {activeTab === 'contributions' && (
              <TabContributions
                campaign={selectedCampaign}
                isBusy={isBusy}
                onAction={handleAction}
              />
            )}
            {activeTab === 'trustflow' && (
              <TabTrustFlow
                campaign={selectedCampaign}
                userRole={userRole}
                isBusy={isBusy}
                onAction={handleAction}
              />
            )}
            {activeTab === 'engagement' && (
              <TabEngagement
                campaign={selectedCampaign}
                isBusy={isBusy}
                onAction={handleAction}
              />
            )}
            {activeTab === 'privacy' && (
              <TabPrivacy
                key={selectedCampaign.id}
                campaign={selectedCampaign}
                isBusy={isBusy}
                onAction={handleAction}
              />
            )}
            {activeTab === 'governance' && (
              <TabGovernance
                campaign={selectedCampaign}
                userRole={userRole}
                isBusy={isBusy}
                onAction={handleAction}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 1: OVERVIEW & GUARDIAN INTELLIGENCE
// ----------------------------------------------------------------------
function TabOverview({
  campaign,
  userName,
  isBusy,
  onAction,
}: {
  campaign: FundraisingCampaignDetail;
  userRole: string;
  userName: string;
  isBusy: boolean;
  onAction: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>;
}) {
  const confirmedRaised = campaign.raised ?? 0;
  const committedHeld = campaign.held ?? 0;
  const confirmedSpent = campaign.spent ?? 0;
  const availableCash = campaign.availableBalance ?? 0;
  const unconfirmedPledges = campaign.pledgedTotal ?? 0;
  const target = campaign.target ?? 0;
  const progressPct = campaign.progressPercent ?? (target > 0 ? Math.min(100, Math.round((confirmedRaised / target) * 100)) : 0);

  // Guardian Alerts & Insights
  const guardianAlerts =
    (campaign as { guardianAlerts?: FundraisingGuardianInsight['alerts'] }).guardianAlerts ||
    campaign.guardian?.alerts ||
    [];

  // Quick Inline Contribution Simulator state
  const [donateAmount, setDonateAmount] = useState<number>(10000);
  const [donateName, setDonateName] = useState<string>(userName || 'Community Supporter');
  const [displayPreference, setDisplayPreference] = useState<'public_name' | 'display_name' | 'anonymous'>('public_name');
  const [contributionType, setContributionType] = useState<'one_time' | 'recurring_intent' | 'pledge'>('one_time');
  const [channel, setChannel] = useState<'mtn_momo' | 'airtel_money' | 'card_simulated'>('mtn_momo');
  const [outcome, setOutcome] = useState<'success' | 'pending' | 'failed'>('success');
  const [message, setMessage] = useState<string>('Blessings to this community effort!');

  const handleSimulateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeAmount = Math.floor(Number(donateAmount));
    if (!Number.isSafeInteger(safeAmount) || safeAmount <= 0) return;
    const ref = `SIM-${channel.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-6)}`;

    await onAction(
      {
        action: 'donate',
        orgId: 'fund-school',
        campaignId: campaign.id,
        amount: safeAmount,
        contributionType,
        displayPreference,
        customDisplayName: displayPreference === 'display_name' ? donateName : undefined,
        channel,
        outcome,
        reference: ref,
        message,
      },
      `Simulated ${contributionType === 'pledge' ? 'pledge' : 'contribution'} of ${safeAmount.toLocaleString()} RWF recorded.`
    );
  };

  return (
    <div className={s.tabContent}>
      {/* Financial Accountability Card */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <TrendingUp size={18} color="#174f83" />
              Financial Accountability &amp; Cash Flow
            </h2>
            <p className={s.sectionSubtitle}>
              Strict multi-state ledger accounting: posted cash vs holds and unconfirmed pledges
            </p>
          </div>
          <span className={`${s.pill} ${s.pillSuccess}`}>Ledger In Balance</span>
        </div>

        <div className={s.statGrid}>
          <div className={s.statBox}>
            <span className={s.statLabel}>Confirmed Raised</span>
            <span className={s.statValue}>{confirmedRaised.toLocaleString()} RWF</span>
            <span className={s.statSub}>100% provider verified</span>
          </div>
          <div className={s.statBox}>
            <span className={s.statLabel}>Committed / Pending Hold</span>
            <span className={s.statValue}>{committedHeld.toLocaleString()} RWF</span>
            <span className={s.statSub}>Approved awaiting payout</span>
          </div>
          <div className={s.statBox}>
            <span className={s.statLabel}>Confirmed Spent</span>
            <span className={s.statValue}>{confirmedSpent.toLocaleString()} RWF</span>
            <span className={s.statSub}>TrustFlow verified expenses</span>
          </div>
          <div className={`${s.statBox} ${s.statBoxHighlight}`}>
            <span className={s.statLabel}>Uncommitted Available Cash</span>
            <span className={`${s.statValue}`} style={{ color: '#174f83' }}>
              {availableCash.toLocaleString()} RWF
            </span>
            <span className={s.statSub}>Ready for disbursement</span>
          </div>
          <div className={s.statBox}>
            <span className={s.statLabel}>Unconfirmed Pledges</span>
            <span className={s.statValue}>{unconfirmedPledges.toLocaleString()} RWF</span>
            <span className={s.statSub}>Excluded from available cash</span>
          </div>
        </div>

        {target > 0 && (
          <div className={s.progressContainer}>
            <div className={s.progressHeader}>
              <span>Progress toward {target.toLocaleString()} RWF target</span>
              <span>{progressPct}%</span>
            </div>
            <div className={s.progressBar}>
              <div className={s.progressFill} style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className={s.gridTwoCol}>
        {/* HURIZA Guardian Intelligence Panel */}
        <div className={s.guardianCard}>
          <div className={s.guardianHeader}>
            <div className={s.guardianTitle}>
              <ShieldCheck size={18} color="#174f83" />
              HURIZA Guardian Intelligence
            </div>
            {campaign.guardian?.transparencyScore && (
              <span
                className={`${s.pill} ${
                  campaign.guardian.transparencyScore === 'verified_clean'
                    ? s.pillSuccess
                    : campaign.guardian.transparencyScore === 'needs_attention'
                    ? s.pillPending
                    : s.pillDanger
                }`}
              >
                Score: {campaign.guardian.transparencyScore.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className={s.guardianAlertList}>
            {guardianAlerts.length === 0 ? (
              <div className={s.cleanState}>
                <Check size={16} />
                <span>All Guardian integrity checks passed. Transparency score: Verified Clean.</span>
              </div>
            ) : (
              guardianAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`${s.guardianAlertItem} ${
                    alert.severity === 'critical'
                      ? s.alertCritical
                      : alert.severity === 'warning'
                      ? s.alertWarning
                      : s.alertInfo
                  }`}
                >
                  {alert.severity === 'critical' ? (
                    <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  )}
                  <div>
                    <strong>{alert.category.toUpperCase()} GUARDIAN: </strong>
                    <span>{alert.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {campaign.guardian && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              {campaign.guardian.fundingGap !== null && (
                <div className={s.statBox}>
                  <span className={s.statLabel}>Funding Gap</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {campaign.guardian.fundingGap.toLocaleString()} RWF
                  </span>
                </div>
              )}
              {campaign.guardian.daysRemaining !== null && (
                <div className={s.statBox}>
                  <span className={s.statLabel}>Days Remaining</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {campaign.guardian.daysRemaining} days
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Inline Contribution Simulator */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitleGroup}>
              <h3 className={s.sectionTitle}>
                <Coins size={16} color="#174f83" />
                Contribution Simulator
              </h3>
              <p className={s.sectionSubtitle}>
                Simulate instant MoMo, Airtel or card pledges without leaving dashboard
              </p>
            </div>
          </div>

          <form onSubmit={handleSimulateDonation} className={s.form}>
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Amount (RWF)</label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  className={s.input}
                  value={donateAmount}
                  onChange={e => setDonateAmount(Math.max(100, Math.floor(Number(e.target.value))))}
                  required
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Type</label>
                <select
                  className={s.select}
                  value={contributionType}
                  onChange={e => setContributionType(e.target.value as 'one_time' | 'recurring_intent' | 'pledge')}
                >
                  <option value="one_time">One-time Donation</option>
                  <option value="recurring_intent">Monthly Recurring</option>
                  <option value="pledge">Future Pledge (Unconfirmed)</option>
                </select>
              </div>
            </div>

            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Supporter Display Name</label>
                <input
                  type="text"
                  className={s.input}
                  value={donateName}
                  onChange={e => setDonateName(e.target.value)}
                  placeholder="e.g. Marie Mukamana"
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Display Preference</label>
                <select
                  className={s.select}
                  value={displayPreference}
                  onChange={e => setDisplayPreference(e.target.value as 'public_name' | 'display_name' | 'anonymous')}
                >
                  <option value="public_name">Public Real Name</option>
                  <option value="display_name">Custom Display Name</option>
                  <option value="anonymous">Anonymous Supporter</option>
                </select>
              </div>
            </div>

            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Channel</label>
                <select
                  className={s.select}
                  value={channel}
                  onChange={e => setChannel(e.target.value as 'mtn_momo' | 'airtel_money' | 'card_simulated')}
                >
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="airtel_money">Airtel Money</option>
                  <option value="card_simulated">Card Payment (Simulated)</option>
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Simulated Outcome</label>
                <select
                  className={s.select}
                  value={outcome}
                  onChange={e => setOutcome(e.target.value as 'success' | 'pending' | 'failed')}
                >
                  <option value="success">Success (Instant Settlement)</option>
                  <option value="pending">Pending Callback (Awaiting Webhook)</option>
                  <option value="failed">Failed / Insufficient Funds</option>
                </select>
              </div>
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Message or Dedication</label>
              <input
                type="text"
                className={s.input}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Optional words of encouragement"
              />
            </div>

            <button type="submit" className={s.btnPrimary} disabled={isBusy}>
              <Send size={14} />
              Simulate Contribution ({donateAmount.toLocaleString()} RWF)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 2: CONTRIBUTIONS, PLEDGES & MOMO SETTLEMENT
// ----------------------------------------------------------------------
function TabContributions({
  campaign,
  isBusy,
  onAction,
}: {
  campaign: FundraisingCampaignDetail;
  isBusy: boolean;
  onAction: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>;
}) {
  const contributions = campaign.contributions || [];

  const statusPillClass = (status: string) => {
    switch (status) {
      case 'success':
        return s.pillSuccess;
      case 'pending':
        return s.pillPending;
      case 'pledged':
        return s.pillInfo;
      case 'failed':
      case 'refunded':
        return s.pillDanger;
      default:
        return s.pillNeutral;
    }
  };

  return (
    <div className={s.tabContent}>
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Coins size={18} color="#174f83" />
              Contributions, Pledges &amp; MoMo Settlement
            </h2>
            <p className={s.sectionSubtitle}>
              Real-time audit log of synthetic donations, pledges and provider settlement resolution
            </p>
          </div>
          <span className={`${s.pill} ${s.pillInfo}`}>
            {contributions.length} Record{contributions.length === 1 ? '' : 's'}
          </span>
        </div>

        {contributions.length === 0 ? (
          <div className={s.emptyState}>
            <p className={s.emptyStateTitle}>No contributions recorded yet</p>
            <p>Use the simulator in the Overview tab or the public campaign page to register donations.</p>
          </div>
        ) : (
          <div className={s.tableContainer}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supporter</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Message</th>
                  <th>Settlement Action</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map(c => {
                  const supporterDisplayName =
                    c.displayPreference === 'anonymous'
                      ? 'Anonymous Supporter'
                      : c.contributorName || 'Supporter';

                  return (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Today'}
                      </td>
                      <td style={{ fontWeight: 700 }}>{supporterDisplayName}</td>
                      <td style={{ fontWeight: 800 }}>
                        {c.amount !== null ? `${c.amount.toLocaleString()} RWF` : 'N/A'}
                      </td>
                      <td>
                        <span className={`${s.pill} ${s.pillNeutral}`}>
                          {c.contributionType.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: '#475569' }}>
                          {c.channel.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`${s.pill} ${statusPillClass(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.reference}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.message || '—'}
                      </td>
                      <td>
                        {c.status === 'pending' && c.paymentId ? (
                          <div className={s.btnGroup}>
                            <button
                              type="button"
                              className={s.btnSuccess}
                              disabled={isBusy}
                              onClick={() =>
                                onAction(
                                  {
                                    action: 'confirmPayment',
                                    orgId: 'fund-school',
                                    paymentId: c.paymentId,
                                    outcome: 'success',
                                  },
                                  'MoMo payment callback confirmed as SUCCESS.'
                                )
                              }
                            >
                              <Check size={12} /> Confirm MoMo
                            </button>
                            <button
                              type="button"
                              className={s.btnDanger}
                              disabled={isBusy}
                              onClick={() =>
                                onAction(
                                  {
                                    action: 'confirmPayment',
                                    orgId: 'fund-school',
                                    paymentId: c.paymentId,
                                    outcome: 'failed',
                                  },
                                  'MoMo payment callback marked as FAILED.'
                                )
                              }
                            >
                              <X size={12} /> Fail
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 3: TRUSTFLOW EXPENSES & MILESTONES
// ----------------------------------------------------------------------
function TabTrustFlow({
  campaign,
  isBusy,
  onAction,
}: {
  campaign: FundraisingCampaignDetail;
  userRole: string;
  isBusy: boolean;
  onAction: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>;
}) {
  const expenses = campaign.expenses || [];
  const milestones = campaign.milestones || [];

  // Form states for Expense Request
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('Operations');
  const [expAmount, setExpAmount] = useState<number>(15000);
  const [expVendor, setExpVendor] = useState('');
  const [expReceiptUrl, setExpReceiptUrl] = useState('');
  const [expMilestoneId, setExpMilestoneId] = useState('');
  const [expDescription, setExpDescription] = useState('');

  // Form states for Milestone Creation
  const [mileTitle, setMileTitle] = useState('');
  const [mileDesc, setMileDesc] = useState('');
  const [mileTarget, setMileTarget] = useState<number>(100000);

  // Form states for Milestone Verification modal
  const [activeVerifyMilestone, setActiveVerifyMilestone] = useState<FundraisingMilestone | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'planned' | 'in_progress' | 'funded_pending_execution' | 'completed_verified'>('completed_verified');
  const [verifyProofNote, setVerifyProofNote] = useState('');
  const [verifyProofUrl, setVerifyProofUrl] = useState('');

  const handleRequestExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeAmount = Math.floor(Number(expAmount));
    if (!Number.isSafeInteger(safeAmount) || safeAmount <= 0) return;

    await onAction(
      {
        action: 'requestExpense',
        orgId: 'fund-school',
        campaignId: campaign.id,
        title: expTitle,
        category: expCategory,
        amount: safeAmount,
        vendorName: expVendor,
        receiptUrl: expReceiptUrl,
        milestoneId: expMilestoneId || undefined,
        description: expDescription,
      },
      `Expense request "${expTitle}" recorded. Awaiting 2nd officer approval.`
    );
    setExpTitle('');
    setExpVendor('');
    setExpReceiptUrl('');
    setExpDescription('');
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeTarget = Math.floor(Number(mileTarget));
    if (!Number.isSafeInteger(safeTarget) || safeTarget <= 0) return;

    await onAction(
      {
        action: 'createCampaignMilestone',
        orgId: 'fund-school',
        campaignId: campaign.id,
        title: mileTitle,
        description: mileDesc,
        targetAmount: safeTarget,
      },
      `Milestone "${mileTitle}" created successfully.`
    );
    setMileTitle('');
    setMileDesc('');
  };

  const handleUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVerifyMilestone) return;

    await onAction(
      {
        action: 'updateCampaignMilestone',
        orgId: 'fund-school',
        campaignId: campaign.id,
        milestoneId: activeVerifyMilestone.id,
        outcomeStatus: verifyStatus,
        proofNote: verifyProofNote,
        proofImageUrl: verifyProofUrl,
      },
      `Milestone outcome updated to "${verifyStatus}".`
    );
    setActiveVerifyMilestone(null);
  };

  return (
    <div className={s.tabContent}>
      {/* 3-Step Expense Approval & Disbursement Workflow */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Receipt size={18} color="#174f83" />
              TrustFlow 3-Step Expense Approval Workflow
            </h2>
            <p className={s.sectionSubtitle}>
              Step 1: Request Expense → Step 2: 2nd Officer Approval → Step 3: MoMo Payout Confirmation
            </p>
          </div>
          <span className={`${s.pill} ${s.pillInfo}`}>{expenses.length} Expenses</span>
        </div>

        {/* Expense Request Form */}
        <form onSubmit={handleRequestExpense} className={s.form}>
          <h4 style={{ margin: 0, fontSize: 13, color: '#174f83', fontWeight: 800 }}>
            + Request New Campaign Expense
          </h4>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Expense Title *</label>
              <input
                type="text"
                className={s.input}
                value={expTitle}
                onChange={e => setExpTitle(e.target.value)}
                placeholder="e.g. Clean Water Pump Parts"
                required
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Category</label>
              <select
                className={s.select}
                value={expCategory}
                onChange={e => setExpCategory(e.target.value)}
              >
                <option value="Operations">Operations</option>
                <option value="Logistics">Logistics</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Materials">Materials &amp; Equipment</option>
                <option value="Catering">Catering / Venue</option>
                <option value="Direct Aid">Direct Aid</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Amount (RWF) *</label>
              <input
                type="number"
                min={100}
                step={100}
                className={s.input}
                value={expAmount}
                onChange={e => setExpAmount(Math.max(100, Math.floor(Number(e.target.value))))}
                required
              />
            </div>
          </div>

          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Vendor / Payee</label>
              <input
                type="text"
                className={s.input}
                value={expVendor}
                onChange={e => setExpVendor(e.target.value)}
                placeholder="e.g. Kigali Hardware Ltd"
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Receipt / Document URL</label>
              <input
                type="url"
                className={s.input}
                value={expReceiptUrl}
                onChange={e => setExpReceiptUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Target Milestone</label>
              <select
                className={s.select}
                value={expMilestoneId}
                onChange={e => setExpMilestoneId(e.target.value)}
              >
                <option value="">(None / General Operations)</option>
                {milestones.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.targetAmount.toLocaleString()} RWF)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={s.formGroup}>
            <label className={s.formLabel}>Purpose &amp; Description</label>
            <input
              type="text"
              className={s.input}
              value={expDescription}
              onChange={e => setExpDescription(e.target.value)}
              placeholder="Explain how this expense fulfills campaign milestones"
            />
          </div>

          <button type="submit" className={s.btnPrimary} disabled={isBusy}>
            <Plus size={14} /> Submit Expense Request
          </button>
        </form>

        {/* Expenses Queue Table */}
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#334155', fontWeight: 800 }}>
            Expense Queue &amp; Approval Status
          </h4>
          {expenses.length === 0 ? (
            <div className={s.emptyState}>
              <p className={s.emptyStateTitle}>No expenses recorded yet</p>
              <p>Request an expense above to initiate the dual-authorization TrustFlow workflow.</p>
            </div>
          ) : (
            <div className={s.tableContainer}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Vendor</th>
                    <th>Receipt</th>
                    <th>Status</th>
                    <th>Workflow Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => {
                    const paymentId =
                      (exp as { paymentId?: string }).paymentId ||
                      exp.paymentReference ||
                      `expense-${exp.id}`;

                    return (
                      <tr key={exp.id}>
                        <td>
                          <strong>{exp.title}</strong>
                          {exp.description && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>{exp.description}</div>
                          )}
                        </td>
                        <td>
                          <span className={`${s.pill} ${s.pillNeutral}`}>{exp.category}</span>
                        </td>
                        <td style={{ fontWeight: 800 }}>{exp.amount.toLocaleString()} RWF</td>
                        <td>{exp.vendorName || '—'}</td>
                        <td>
                          {exp.receiptUrl ? (
                            <a
                              href={exp.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={s.actionBtnQuiet}
                            >
                              <ExternalLink size={11} /> View
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${s.pill} ${
                              exp.status === 'paid'
                                ? s.pillSuccess
                                : exp.status === 'pending'
                                ? s.pillPending
                                : exp.status === 'requested'
                                ? s.pillInfo
                                : s.pillDanger
                            }`}
                          >
                            {exp.status}
                          </span>
                        </td>
                        <td>
                          {exp.status === 'requested' && (
                            <button
                              type="button"
                              className={s.btnSuccess}
                              disabled={isBusy}
                              onClick={() =>
                                onAction(
                                  {
                                    action: 'approveExpense',
                                    orgId: 'fund-school',
                                    expenseId: exp.id,
                                  },
                                  `Expense "${exp.title}" approved by 2nd officer. Ready for payout.`
                                )
                              }
                            >
                              <CheckCircle2 size={12} /> Approve Expense (2nd Officer)
                            </button>
                          )}
                          {exp.status === 'pending' && (
                            <div className={s.btnGroup}>
                              <button
                                type="button"
                                className={s.btnPrimary}
                                disabled={isBusy}
                                onClick={() =>
                                  onAction(
                                    {
                                      action: 'confirmPayment',
                                      orgId: 'fund-school',
                                      paymentId,
                                      outcome: 'success',
                                    },
                                    `MoMo disbursement confirmed for "${exp.title}".`
                                  )
                                }
                              >
                                <Check size={12} /> Confirm MoMo Disbursement
                              </button>
                              <button
                                type="button"
                                className={s.btnDanger}
                                disabled={isBusy}
                                onClick={() =>
                                  onAction(
                                    {
                                      action: 'confirmPayment',
                                      orgId: 'fund-school',
                                      paymentId,
                                      outcome: 'failed',
                                    },
                                    `Disbursement cancelled for "${exp.title}".`
                                  )
                                }
                              >
                                <X size={12} /> Decline/Fail
                              </button>
                            </div>
                          )}
                          {exp.status === 'paid' && (
                            <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>
                              ✓ Disbursed &amp; Reconciled
                            </span>
                          )}
                          {exp.status === 'declined' && (
                            <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 700 }}>
                              Declined
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Milestones Manager */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Award size={18} color="#174f83" />
              Campaign Milestones &amp; Outcome Verification
            </h2>
            <p className={s.sectionSubtitle}>
              Track planned deliverables, funds allocation and verified real-world evidence
            </p>
          </div>
          <span className={`${s.pill} ${s.pillInfo}`}>{milestones.length} Milestones</span>
        </div>

        {/* Milestones List */}
        <div className={s.gridEqual}>
          {milestones.map(m => (
            <div key={m.id} className={s.cardItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong style={{ fontSize: 14 }}>{m.title}</strong>
                <span
                  className={`${s.pill} ${
                    m.outcomeStatus === 'completed_verified'
                      ? s.pillSuccess
                      : m.outcomeStatus === 'in_progress'
                      ? s.pillPending
                      : s.pillNeutral
                  }`}
                >
                  {m.outcomeStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {m.description || 'No milestone description provided.'}
              </p>
              <div className={s.statGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 4 }}>
                <div>
                  <span className={s.statLabel}>Target</span>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.targetAmount.toLocaleString()} RWF</div>
                </div>
                <div>
                  <span className={s.statLabel}>Allocated</span>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.allocatedAmount.toLocaleString()} RWF</div>
                </div>
                <div>
                  <span className={s.statLabel}>Spent</span>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.spentAmount.toLocaleString()} RWF</div>
                </div>
              </div>

              {m.outcomeEvidence && (
                <div style={{ fontSize: 11, color: '#166534', background: '#ecfdf5', padding: 6, borderRadius: 6 }}>
                  Evidence: {m.outcomeEvidence}
                </div>
              )}

              <button
                type="button"
                className={s.btnSecondary}
                onClick={() => {
                  setActiveVerifyMilestone(m);
                  setVerifyStatus(m.outcomeStatus);
                }}
              >
                Verify / Update Milestone
              </button>
            </div>
          ))}
        </div>

        {/* Add Milestone Form */}
        <form onSubmit={handleCreateMilestone} className={s.form} style={{ marginTop: 8 }}>
          <h4 style={{ margin: 0, fontSize: 13, color: '#174f83', fontWeight: 800 }}>
            + Create New Campaign Milestone
          </h4>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Milestone Title *</label>
              <input
                type="text"
                className={s.input}
                value={mileTitle}
                onChange={e => setMileTitle(e.target.value)}
                placeholder="e.g. Phase 1: Purchase Desks"
                required
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Target Amount (RWF) *</label>
              <input
                type="number"
                min={1000}
                step={1000}
                className={s.input}
                value={mileTarget}
                onChange={e => setMileTarget(Math.max(1000, Math.floor(Number(e.target.value))))}
                required
              />
            </div>
          </div>
          <div className={s.formGroup}>
            <label className={s.formLabel}>Milestone Description</label>
            <input
              type="text"
              className={s.input}
              value={mileDesc}
              onChange={e => setMileDesc(e.target.value)}
              placeholder="What will be accomplished in this stage?"
            />
          </div>
          <button type="submit" className={s.btnPrimary} disabled={isBusy}>
            <Plus size={14} /> Add Milestone
          </button>
        </form>

        {/* Milestone Verification Inline Modal / Form */}
        {activeVerifyMilestone && (
          <form
            onSubmit={handleUpdateMilestone}
            className={s.form}
            style={{
              background: '#f8fafc',
              border: '2px solid #2563eb',
              padding: 16,
              borderRadius: 12,
              marginTop: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#174f83', fontWeight: 800 }}>
                Update Milestone: {activeVerifyMilestone.title}
              </h4>
              <button
                type="button"
                className={s.dismissBtn}
                onClick={() => setActiveVerifyMilestone(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Outcome Status</label>
                <select
                  className={s.select}
                  value={verifyStatus}
                  onChange={e => setVerifyStatus(e.target.value as typeof verifyStatus)}
                >
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="funded_pending_execution">Funded (Pending Execution)</option>
                  <option value="completed_verified">Completed &amp; Verified</option>
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Proof Image / Document URL</label>
                <input
                  type="url"
                  className={s.input}
                  value={verifyProofUrl}
                  onChange={e => setVerifyProofUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Proof &amp; Verification Note</label>
              <input
                type="text"
                className={s.input}
                value={verifyProofNote}
                onChange={e => setVerifyProofNote(e.target.value)}
                placeholder="e.g. 50 desks inspected on-site by community board"
              />
            </div>
            <div className={s.btnGroup}>
              <button type="submit" className={s.btnPrimary} disabled={isBusy}>
                <Check size={14} /> Save Verification Outcome
              </button>
              <button
                type="button"
                className={s.btnSecondary}
                onClick={() => setActiveVerifyMilestone(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 4: ENGAGEMENT (UPDATES, MOMENTS REGISTRY, MATCHING & RSVPS)
// ----------------------------------------------------------------------
function TabEngagement({
  campaign,
  isBusy,
  onAction,
}: {
  campaign: FundraisingCampaignDetail;
  isBusy: boolean;
  onAction: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>;
}) {
  const updates = campaign.updates || [];
  const giftItems = campaign.giftItems || [];
  const matchingPledges = campaign.matchingPledges || [];
  const rsvps = campaign.rsvps || [];

  // Form: Publish Update
  const [updTitle, setUpdTitle] = useState('');
  const [updType, setUpdType] = useState<'progress' | 'milestone' | 'thank_you' | 'announcement' | 'spending' | 'photo'>('progress');
  const [updBody, setUpdBody] = useState('');
  const [updMedia, setUpdMedia] = useState('');

  // Form: Gift item
  const [giftTitle, setGiftTitle] = useState('');
  const [giftDesc, setGiftDesc] = useState('');
  const [giftTarget, setGiftTarget] = useState<number>(25000);
  const [giftImage, setGiftImage] = useState('');

  // Form: Sponsor Matching Pledge
  const [matchSponsor, setMatchSponsor] = useState('');
  const [matchAmount, setMatchAmount] = useState<number>(500000);
  const [matchRatioBps, setMatchRatioBps] = useState<number>(10000); // 10000 = 1:1

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updTitle.trim() || !updBody.trim()) return;

    await onAction(
      {
        action: 'postCampaignUpdate',
        orgId: 'fund-school',
        campaignId: campaign.id,
        title: updTitle,
        updateType: updType,
        body: updBody,
        mediaUrl: updMedia,
      },
      `Campaign update "${updTitle}" published.`
    );
    setUpdTitle('');
    setUpdBody('');
    setUpdMedia('');
  };

  const handleAddGiftItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeTarget = Math.floor(Number(giftTarget));
    if (!Number.isSafeInteger(safeTarget) || safeTarget <= 0) return;

    await onAction(
      {
        action: 'addCampaignGiftItem',
        orgId: 'fund-school',
        campaignId: campaign.id,
        title: giftTitle,
        description: giftDesc,
        targetAmount: safeTarget,
        imageUrl: giftImage,
      },
      `Registry item "${giftTitle}" added.`
    );
    setGiftTitle('');
    setGiftDesc('');
    setGiftImage('');
  };

  const handleCreateMatchingPledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeAmount = Math.floor(Number(matchAmount));
    if (!Number.isSafeInteger(safeAmount) || safeAmount <= 0) return;

    await onAction(
      {
        action: 'createMatchingPledge',
        orgId: 'fund-school',
        campaignId: campaign.id,
        sponsorName: matchSponsor,
        pledgedAmount: safeAmount,
        matchRatioBps: Number(matchRatioBps),
      },
      `Sponsor matching pledge from "${matchSponsor}" created.`
    );
    setMatchSponsor('');
  };

  return (
    <div className={s.tabContent}>
      {/* Updates Publisher & Timeline */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Send size={18} color="#174f83" />
              Campaign Updates &amp; Supporter Notifications
            </h2>
            <p className={s.sectionSubtitle}>
              Broadcast milestones, thank-you notes and photos to campaign followers
            </p>
          </div>
          <span className={`${s.pill} ${s.pillInfo}`}>{updates.length} Updates</span>
        </div>

        <form onSubmit={handlePostUpdate} className={s.form}>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Update Title *</label>
              <input
                type="text"
                className={s.input}
                value={updTitle}
                onChange={e => setUpdTitle(e.target.value)}
                placeholder="e.g. Desks arrived at the school!"
                required
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Update Type</label>
              <select
                className={s.select}
                value={updType}
                onChange={e => setUpdType(e.target.value as typeof updType)}
              >
                <option value="progress">Progress Update</option>
                <option value="milestone">Milestone Achieved</option>
                <option value="thank_you">Thank You Message</option>
                <option value="announcement">Important Announcement</option>
                <option value="spending">Spending Report</option>
                <option value="photo">Photo / Gallery</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Media URL (Optional)</label>
              <input
                type="url"
                className={s.input}
                value={updMedia}
                onChange={e => setUpdMedia(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className={s.formGroup}>
            <label className={s.formLabel}>Body Story *</label>
            <textarea
              className={s.textarea}
              value={updBody}
              onChange={e => setUpdBody(e.target.value)}
              placeholder="Share the latest developments with your supporters..."
              required
            />
          </div>
          <button type="submit" className={s.btnPrimary} disabled={isBusy}>
            <Send size={14} /> Publish Update
          </button>
        </form>

        {updates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#334155', fontWeight: 800 }}>
              Past Published Updates
            </h4>
            {updates.map(u => (
              <div key={u.id} className={s.cardItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{u.title}</strong>
                  <span className={`${s.pill} ${s.pillNeutral}`}>{u.updateType}</span>
                </div>
                <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>{u.body}</p>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  By {u.authorName} • {new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={s.gridTwoCol}>
        {/* Gift Registry / Moments */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitleGroup}>
              <h3 className={s.sectionTitle}>
                <Gift size={16} color="#174f83" />
                Moments Gift Registry
              </h3>
              <p className={s.sectionSubtitle}>Itemized wishlists for weddings, birthdays, baby showers</p>
            </div>
            <span className={`${s.pill} ${s.pillInfo}`}>{giftItems.length} Items</span>
          </div>

          <form onSubmit={handleAddGiftItem} className={s.form}>
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Item Title *</label>
                <input
                  type="text"
                  className={s.input}
                  value={giftTitle}
                  onChange={e => setGiftTitle(e.target.value)}
                  placeholder="e.g. Wedding Photo Album"
                  required
                />
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Target (RWF) *</label>
                <input
                  type="number"
                  min={500}
                  className={s.input}
                  value={giftTarget}
                  onChange={e => setGiftTarget(Math.max(500, Math.floor(Number(e.target.value))))}
                  required
                />
              </div>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Description</label>
              <input
                type="text"
                className={s.input}
                value={giftDesc}
                onChange={e => setGiftDesc(e.target.value)}
                placeholder="Specific make, model or details"
              />
            </div>
            <button type="submit" className={s.btnPrimary} disabled={isBusy}>
              <Plus size={14} /> Add Registry Item
            </button>
          </form>

          {giftItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {giftItems.map(g => (
                <div key={g.id} className={s.cardItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{g.title}</strong>
                    <span
                      className={`${s.pill} ${
                        g.status === 'fulfilled'
                          ? s.pillSuccess
                          : g.status === 'partially_funded'
                          ? s.pillPending
                          : s.pillNeutral
                      }`}
                    >
                      {g.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {g.contributedAmount.toLocaleString()} / {g.targetAmount.toLocaleString()} RWF
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sponsor Matching Pledges & RSVPs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sponsor Matching */}
          <div className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h3 className={s.sectionTitle}>
                  <Sparkles size={16} color="#174f83" />
                  Sponsor Matching Pledges
                </h3>
                <p className={s.sectionSubtitle}>Multiply grassroots contributions 1:1 or 2:1</p>
              </div>
            </div>

            <form onSubmit={handleCreateMatchingPledge} className={s.form}>
              <div className={s.formGrid}>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Sponsor Name *</label>
                  <input
                    type="text"
                    className={s.input}
                    value={matchSponsor}
                    onChange={e => setMatchSponsor(e.target.value)}
                    placeholder="e.g. Kigali Tech Foundation"
                    required
                  />
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Pledged Amount (RWF) *</label>
                  <input
                    type="number"
                    min={10000}
                    className={s.input}
                    value={matchAmount}
                    onChange={e => setMatchAmount(Math.max(10000, Math.floor(Number(e.target.value))))}
                    required
                  />
                </div>
              </div>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Match Ratio</label>
                <select
                  className={s.select}
                  value={matchRatioBps}
                  onChange={e => setMatchRatioBps(Number(e.target.value))}
                >
                  <option value={10000}>1:1 Match (10,000 bps)</option>
                  <option value={20000}>2:1 Double Match (20,000 bps)</option>
                  <option value={5000}>0.5:1 Partial Match (5,000 bps)</option>
                </select>
              </div>
              <button type="submit" className={s.btnPrimary} disabled={isBusy}>
                <Plus size={14} /> Add Sponsor Match
              </button>
            </form>

            {matchingPledges.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {matchingPledges.map(mp => (
                  <div key={mp.id} className={s.cardItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{mp.sponsorName}</strong>
                      <span className={`${s.pill} ${mp.status === 'active' ? s.pillSuccess : s.pillNeutral}`}>
                        {mp.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Pledged: {mp.pledgedAmount.toLocaleString()} RWF • Confirmed: {mp.confirmedAmount.toLocaleString()} RWF
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RSVPs Table */}
          <div className={s.sectionCard}>
            <div className={s.sectionHeader}>
              <div className={s.sectionTitleGroup}>
                <h3 className={s.sectionTitle}>
                  <Calendar size={16} color="#174f83" />
                  Event RSVPs &amp; Guest Attendance
                </h3>
                <p className={s.sectionSubtitle}>Guest list responses for moments &amp; ceremonies</p>
              </div>
              <span className={`${s.pill} ${s.pillNeutral}`}>{rsvps.length} Guests</span>
            </div>

            {rsvps.length === 0 ? (
              <div className={s.emptyState} style={{ padding: 16 }}>
                <p>No RSVPs received yet.</p>
              </div>
            ) : (
              <div className={s.tableContainer}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Guest Name</th>
                      <th>Status</th>
                      <th>Seats</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.guestName}</td>
                        <td>
                          <span
                            className={`${s.pill} ${
                              r.attendanceStatus === 'attending'
                                ? s.pillSuccess
                                : r.attendanceStatus === 'maybe'
                                ? s.pillPending
                                : s.pillDanger
                            }`}
                          >
                            {r.attendanceStatus}
                          </span>
                        </td>
                        <td>{r.guestsCount}</td>
                        <td style={{ fontSize: 11, color: '#64748b' }}>{r.dietaryOrNote || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 5: PRIVACY CONTROLS & SELECTED CONTRIBUTOR ACCESS GRANTS
// ----------------------------------------------------------------------
function TabPrivacy({
  campaign,
  isBusy,
  onAction,
}: {
  campaign: FundraisingCampaignDetail;
  isBusy: boolean;
  onAction: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>;
}) {
  const accessGrants = campaign.accessGrants || [];

  // Privacy Policy Form State
  const [visibility, setVisibility] = useState<CampaignVisibility>(campaign.visibility);
  const [theme, setTheme] = useState<CampaignTheme>(campaign.theme);
  const [statsVisibility, setStatsVisibility] = useState<StatsVisibility>(
    campaign.privacyPolicy?.statsVisibility || 'everyone'
  );
  const [goalVisibility, setGoalVisibility] = useState<StatsVisibility>(
    campaign.privacyPolicy?.goalVisibility || 'everyone'
  );
  const [raisedVisibility, setRaisedVisibility] = useState<StatsVisibility>(
    campaign.privacyPolicy?.raisedVisibility || 'everyone'
  );
  const [contributorsVisibility, setContributorsVisibility] = useState<StatsVisibility>(
    campaign.privacyPolicy?.contributorsVisibility || 'everyone'
  );
  const [spendingVisibility, setSpendingVisibility] = useState<StatsVisibility>(
    campaign.privacyPolicy?.spendingVisibility || 'everyone'
  );
  const [allowComments, setAllowComments] = useState<boolean>(
    Boolean(campaign.privacyPolicy?.allowComments)
  );
  const [allowAnonymous, setAllowAnonymous] = useState<boolean>(
    Boolean(campaign.privacyPolicy?.allowAnonymous)
  );
  const [allowRsvp, setAllowRsvp] = useState<boolean>(
    Boolean(campaign.privacyPolicy?.allowRsvp)
  );

  // Access Grant Form State
  const [grantUserId, setGrantUserId] = useState('');
  const [grantUserName, setGrantUserName] = useState('');
  const [grantType, setGrantType] = useState<'selected_stats' | 'private_view'>('selected_stats');

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAction(
      {
        action: 'updateCampaign',
        orgId: 'fund-school',
        campaignId: campaign.id,
        visibility,
        theme,
        statsVisibility,
        goalVisibility,
        raisedVisibility,
        contributorsVisibility,
        spendingVisibility,
        allowComments,
        allowAnonymous,
        allowRsvp,
      },
      'Campaign privacy policy and theme updated successfully.'
    );
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId.trim()) return;

    await onAction(
      {
        action: 'grantCampaignAccess',
        orgId: 'fund-school',
        campaignId: campaign.id,
        userId: grantUserId.trim(),
        userName: grantUserName.trim() || grantUserId.trim(),
        grantType,
      },
      `Granted ${grantType} access to ${grantUserName || grantUserId}.`
    );
    setGrantUserId('');
    setGrantUserName('');
  };

  return (
    <div className={s.tabContent}>
      {/* Privacy Settings Form */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Lock size={18} color="#174f83" />
              Granular Privacy Policy &amp; Visibility Controls
            </h2>
            <p className={s.sectionSubtitle}>
              Configure who can see goal amounts, live raised totals, backer identities and TrustFlow receipts
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePrivacy} className={s.form}>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Campaign Visibility</label>
              <select
                className={s.select}
                value={visibility}
                onChange={e => setVisibility(e.target.value as CampaignVisibility)}
              >
                <option value="public">Public (Indexed on /fund discovery)</option>
                <option value="unlisted">Unlisted (Accessible only via direct link)</option>
                <option value="private">Private (Restricted to granted contributors only)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Visual Theme</label>
              <select
                className={s.select}
                value={theme}
                onChange={e => setTheme(e.target.value as CampaignTheme)}
              >
                <option value="classic_blue">Classic Blue (Default)</option>
                <option value="community_impact">Community Impact (Civic &amp; Cooperative)</option>
                <option value="wedding_elegant">Wedding Elegant (Gold &amp; Pearl)</option>
                <option value="birthday_celebration">Birthday Celebration (Warm Vibrant)</option>
                <option value="medical_trust">Medical Trust (Clinical Teal)</option>
                <option value="charity_warm">Charity Warm (Warm Terracotta)</option>
              </select>
            </div>
          </div>

          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Overall Statistics Visibility</label>
              <select
                className={s.select}
                value={statsVisibility}
                onChange={e => setStatsVisibility(e.target.value as StatsVisibility)}
              >
                <option value="everyone">Everyone (Public)</option>
                <option value="contributors_only">Contributors Only</option>
                <option value="selected_contributors">Selected Contributors (Access Grant)</option>
                <option value="team_only">Campaign Team Only</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Target Goal Visibility</label>
              <select
                className={s.select}
                value={goalVisibility}
                onChange={e => setGoalVisibility(e.target.value as StatsVisibility)}
              >
                <option value="everyone">Everyone (Public)</option>
                <option value="contributors_only">Contributors Only</option>
                <option value="selected_contributors">Selected Contributors</option>
                <option value="team_only">Campaign Team Only</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Raised Amount Visibility</label>
              <select
                className={s.select}
                value={raisedVisibility}
                onChange={e => setRaisedVisibility(e.target.value as StatsVisibility)}
              >
                <option value="everyone">Everyone (Public)</option>
                <option value="contributors_only">Contributors Only</option>
                <option value="selected_contributors">Selected Contributors</option>
                <option value="team_only">Campaign Team Only</option>
              </select>
            </div>
          </div>

          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Supporter List Visibility</label>
              <select
                className={s.select}
                value={contributorsVisibility}
                onChange={e => setContributorsVisibility(e.target.value as StatsVisibility)}
              >
                <option value="everyone">Everyone (Public)</option>
                <option value="contributors_only">Contributors Only</option>
                <option value="selected_contributors">Selected Contributors</option>
                <option value="team_only">Campaign Team Only</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Spending &amp; Expenses Visibility</label>
              <select
                className={s.select}
                value={spendingVisibility}
                onChange={e => setSpendingVisibility(e.target.value as StatsVisibility)}
              >
                <option value="everyone">Everyone (Public)</option>
                <option value="contributors_only">Contributors Only</option>
                <option value="selected_contributors">Selected Contributors</option>
                <option value="team_only">Campaign Team Only</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
            <label className={s.toggleRow}>
              <input
                type="checkbox"
                className={s.checkbox}
                checked={allowComments}
                onChange={e => setAllowComments(e.target.checked)}
              />
              Allow Public Comments &amp; Guestbook
            </label>
            <label className={s.toggleRow}>
              <input
                type="checkbox"
                className={s.checkbox}
                checked={allowAnonymous}
                onChange={e => setAllowAnonymous(e.target.checked)}
              />
              Allow Anonymous Contributions
            </label>
            <label className={s.toggleRow}>
              <input
                type="checkbox"
                className={s.checkbox}
                checked={allowRsvp}
                onChange={e => setAllowRsvp(e.target.checked)}
              />
              Enable Event RSVPs
            </label>
          </div>

          <button type="submit" className={s.btnPrimary} disabled={isBusy}>
            <Check size={14} /> Save Privacy Settings
          </button>
        </form>
      </div>

      {/* Selected Contributor Access Manager */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <UserCheck size={18} color="#174f83" />
              Selected Contributor Access Grants
            </h2>
            <p className={s.sectionSubtitle}>
              Grant trusted family, auditors or high-tier backers access to private stats or unlisted details
            </p>
          </div>
          <span className={`${s.pill} ${s.pillInfo}`}>{accessGrants.length} Grants</span>
        </div>

        {/* Grant Form */}
        <form onSubmit={handleGrantAccess} className={s.form}>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>User ID *</label>
              <input
                type="text"
                className={s.input}
                value={grantUserId}
                onChange={e => setGrantUserId(e.target.value)}
                placeholder="e.g. member, treasurer, or user ID"
                required
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Display Name</label>
              <input
                type="text"
                className={s.input}
                value={grantUserName}
                onChange={e => setGrantUserName(e.target.value)}
                placeholder="e.g. Jean Mugisha (Auditor)"
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Grant Type</label>
              <select
                className={s.select}
                value={grantType}
                onChange={e => setGrantType(e.target.value as 'selected_stats' | 'private_view')}
              >
                <option value="selected_stats">Selected Stats Access</option>
                <option value="private_view">Private Campaign View</option>
              </select>
            </div>
          </div>
          <button type="submit" className={s.btnPrimary} disabled={isBusy}>
            <Plus size={14} /> Grant Access
          </button>
        </form>

        {/* Access Grants Table */}
        {accessGrants.length === 0 ? (
          <div className={s.emptyState} style={{ padding: 18 }}>
            <p>No special contributor access grants recorded.</p>
          </div>
        ) : (
          <div className={s.tableContainer} style={{ marginTop: 10 }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Supporter Name</th>
                  <th>Grant Type</th>
                  <th>Status</th>
                  <th>Granted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accessGrants.map(grant => (
                  <tr key={grant.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{grant.userId}</td>
                    <td style={{ fontWeight: 700 }}>{grant.userName}</td>
                    <td>
                      <span className={`${s.pill} ${s.pillNeutral}`}>{grant.grantType}</span>
                    </td>
                    <td>
                      <span
                        className={`${s.pill} ${
                          grant.status === 'active' ? s.pillSuccess : s.pillDanger
                        }`}
                      >
                        {grant.status}
                      </span>
                    </td>
                    <td>{new Date(grant.createdAt).toLocaleDateString()}</td>
                    <td>
                      {grant.status === 'active' && (
                        <button
                          type="button"
                          className={s.btnDanger}
                          disabled={isBusy}
                          onClick={() =>
                            onAction(
                              {
                                action: 'revokeCampaignAccess',
                                orgId: 'fund-school',
                                campaignId: campaign.id,
                                userId: grant.userId,
                                grantType: grant.grantType,
                              },
                              `Access revoked for ${grant.userName}.`
                            )
                          }
                        >
                          <UserX size={12} /> Revoke Access
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 6: TEAM ROLES & PLATFORM MODERATION
// ----------------------------------------------------------------------
function TabGovernance({
  campaign,
  isBusy,
  onAction,
}: {
  campaign: FundraisingCampaignDetail;
  userRole: string;
  isBusy: boolean;
  onAction: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>;
}) {
  const teamMembers: FundraisingTeamMember[] =
    (campaign as { teamMembers?: FundraisingTeamMember[] }).teamMembers || campaign.team || [];
  const comments = campaign.comments || [];

  // Team Member Form State
  const [teamUserId, setTeamUserId] = useState('');
  const [teamUserName, setTeamUserName] = useState('');
  const [teamRole, setTeamRole] = useState<'co_organizer' | 'treasurer' | 'accountant' | 'approver' | 'moderator'>('co_organizer');

  // Platform Moderation State
  const [modStatus, setModStatus] = useState<CampaignVerificationStatus>(
    campaign.verificationStatus || 'verified_demo'
  );
  const [modReason, setModReason] = useState<string>(
    campaign.verificationNotes || 'Verified in HURIZA community demo governance.'
  );

  const handleAssignTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamUserId.trim()) return;

    await onAction(
      {
        action: 'assignCampaignTeamMember',
        orgId: 'fund-school',
        campaignId: campaign.id,
        userId: teamUserId.trim(),
        userName: teamUserName.trim() || teamUserId.trim(),
        campaignRole: teamRole,
      },
      `Assigned role ${teamRole} to ${teamUserName || teamUserId}.`
    );
    setTeamUserId('');
    setTeamUserName('');
  };

  const handleModerateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAction(
      {
        action: 'moderateCampaign',
        orgId: 'fund-school',
        campaignId: campaign.id,
        verificationStatus: modStatus,
        reason: modReason,
      },
      `Campaign platform verification updated to ${modStatus}.`
    );
  };

  return (
    <div className={s.tabContent}>
      {/* Campaign Team Roles Manager */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionTitleGroup}>
            <h2 className={s.sectionTitle}>
              <Users size={18} color="#174f83" />
              Campaign Team Members &amp; Officer Roles
            </h2>
            <p className={s.sectionSubtitle}>
              Assign dual-authorization officers for milestone approvals, accounting, and content moderation
            </p>
          </div>
          <span className={`${s.pill} ${s.pillInfo}`}>{teamMembers.length} Team Members</span>
        </div>

        {/* Assign Team Member Form */}
        <form onSubmit={handleAssignTeamMember} className={s.form}>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>User ID *</label>
              <input
                type="text"
                className={s.input}
                value={teamUserId}
                onChange={e => setTeamUserId(e.target.value)}
                placeholder="e.g. treasurer, president, or user ID"
                required
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Full Name</label>
              <input
                type="text"
                className={s.input}
                value={teamUserName}
                onChange={e => setTeamUserName(e.target.value)}
                placeholder="e.g. Diane Keza"
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Campaign Role</label>
              <select
                className={s.select}
                value={teamRole}
                onChange={e => setTeamRole(e.target.value as typeof teamRole)}
              >
                <option value="co_organizer">Co-Organizer</option>
                <option value="treasurer">Treasurer (Disbursement Officer)</option>
                <option value="accountant">Accountant (Receipt Verifier)</option>
                <option value="approver">Approver (2nd Dual-Authorizer)</option>
                <option value="moderator">Moderator (Comments &amp; Updates)</option>
              </select>
            </div>
          </div>
          <button type="submit" className={s.btnPrimary} disabled={isBusy}>
            <Plus size={14} /> Assign Team Role
          </button>
        </form>

        {/* Team Members Table */}
        {teamMembers.length === 0 ? (
          <div className={s.emptyState} style={{ padding: 18 }}>
            <p>No secondary team members assigned yet. The campaign owner holds all administrative rights.</p>
          </div>
        ) : (
          <div className={s.tableContainer} style={{ marginTop: 10 }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>User ID</th>
                  <th>Assigned Role</th>
                  <th>Assigned Date</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 700 }}>{m.userName}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{m.userId}</td>
                    <td>
                      <span className={`${s.pill} ${s.pillNeutral}`}>
                        {m.campaignRole.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={s.gridTwoCol}>
        {/* Comment Moderation List */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitleGroup}>
              <h3 className={s.sectionTitle}>
                <FileText size={16} color="#174f83" />
                Supporter Comment Moderation
              </h3>
              <p className={s.sectionSubtitle}>Review and hide inappropriate messages</p>
            </div>
            <span className={`${s.pill} ${s.pillNeutral}`}>{comments.length} Comments</span>
          </div>

          {comments.length === 0 ? (
            <div className={s.emptyState} style={{ padding: 16 }}>
              <p>No comments posted on this campaign yet.</p>
            </div>
          ) : (
            <div className={s.tableContainer}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Author</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.authorName}</td>
                      <td style={{ maxWidth: 200, fontSize: 12 }}>{c.message}</td>
                      <td>
                        <span
                          className={`${s.pill} ${
                            c.status === 'visible' ? s.pillSuccess : s.pillDanger
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={s.actionBtnQuiet}
                          disabled={isBusy}
                          onClick={() =>
                            onAction(
                              {
                                action: 'moderateCampaignComment',
                                orgId: 'fund-school',
                                campaignId: campaign.id,
                                commentId: c.id,
                                status: c.status === 'visible' ? 'hidden' : 'visible',
                              },
                              `Comment marked as ${c.status === 'visible' ? 'hidden' : 'visible'}.`
                            )
                          }
                        >
                          {c.status === 'visible' ? 'Hide Comment' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Platform Verification & Safety Review */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionTitleGroup}>
              <h3 className={s.sectionTitle}>
                <ShieldCheck size={16} color="#174f83" />
                Platform Verification Review
              </h3>
              <p className={s.sectionSubtitle}>
                Institutional verification &amp; compliance badge management
              </p>
            </div>
          </div>

          <form onSubmit={handleModerateCampaign} className={s.form}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>Verification Status</label>
              <select
                className={s.select}
                value={modStatus}
                onChange={e => setModStatus(e.target.value as CampaignVerificationStatus)}
              >
                <option value="verified_demo">Verified Demo (Official Green Badge)</option>
                <option value="pending_review">Pending Review (Awaiting NISR / NGO review)</option>
                <option value="requires_review">Requires Review (Flagged by Guardian)</option>
                <option value="suspended">Suspended (Pauses all incoming donations)</option>
              </select>
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Verification Notes &amp; Audit Trail</label>
              <textarea
                className={s.textarea}
                value={modReason}
                onChange={e => setModReason(e.target.value)}
                placeholder="Institutional findings or rationale for verification status"
                required
              />
            </div>

            <button type="submit" className={s.btnPrimary} disabled={isBusy}>
              <ShieldCheck size={14} /> Update Platform Verification
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default FundraisingDashboard;
