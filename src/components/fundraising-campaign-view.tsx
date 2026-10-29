'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type {
  FundraisingCampaignDetail,
  CampaignTheme,
  FundraisingGiftItem,
} from '@/lib/contracts';
import {
  Share2,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  Users,
  Lock,
  AlertCircle,
  Sparkles,
  Gift,
  FileText,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import s from './fundraising-platform.module.css';

export interface FundraisingCampaignViewProps {
  campaign: FundraisingCampaignDetail;
  isAuthenticated: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  onRefresh?: () => Promise<void> | void;
}

const THEME_CLASS_MAP: Record<CampaignTheme, string> = {
  classic_blue: s.theme_classic_blue,
  wedding_elegant: s.theme_wedding_elegant,
  birthday_celebration: s.theme_birthday_celebration,
  charity_warm: s.theme_charity_warm,
  community_impact: s.theme_community_impact,
  medical_trust: s.theme_medical_trust,
};

export function FundraisingCampaignView({
  campaign,
  isAuthenticated,
  currentUserId,
  currentUserRole,
  onRefresh,
}: FundraisingCampaignViewProps) {
  const [activeTab, setActiveTab] = useState<'story' | 'updates' | 'moments' | 'transparency' | 'supporters'>('story');
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedGiftItem, setSelectedGiftItem] = useState<FundraisingGiftItem | null>(null);

  // Form states for Contribution
  const defaultAmount = campaign.suggestedAmounts?.[0] || 10000;
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [customAmountStr, setCustomAmountStr] = useState<string>(String(defaultAmount));
  const [contributionType, setContributionType] = useState<'one_time' | 'recurring_intent' | 'pledge'>('one_time');
  const [channel, setChannel] = useState<'mtn_momo' | 'airtel_money' | 'card_sim'>('mtn_momo');
  const [simulatedOutcome, setSimulatedOutcome] = useState<'success' | 'pending' | 'failed'>('success');
  const [displayPreference, setDisplayPreference] = useState<'public_name' | 'display_name' | 'anonymous'>('public_name');
  const [contributorNameInput, setContributorNameInput] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [dedication, setDedication] = useState('');
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false);
  const [donationError, setDonationError] = useState<string | null>(null);
  const [donationSuccess, setDonationSuccess] = useState<string | null>(null);

  // Form states for RSVP
  const [rsvpGuestName, setRsvpGuestName] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'maybe' | 'declined'>('attending');
  const [rsvpGuestsCount, setRsvpGuestsCount] = useState<number>(1);
  const [rsvpNotes, setRsvpNotes] = useState('');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpSuccessMsg, setRsvpSuccessMsg] = useState<string | null>(null);

  // Form states for Comments
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState<'encouragement' | 'guestbook' | 'congratulation' | 'prayer'>('encouragement');
  const [commentReaction, setCommentReaction] = useState<'heart' | 'celebrate' | 'pray' | 'clap' | 'support'>('heart');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentIsAnon, setCommentIsAnon] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSuccessMsg, setCommentSuccessMsg] = useState<string | null>(null);

  // Share feedback state
  const [copiedLink, setCopiedLink] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const themeClass = THEME_CLASS_MAP[campaign.theme] || s.theme_classic_blue;

  // Calculate event countdown if eventDate is present
  const countdownInfo = React.useMemo(() => {
    if (!campaign.eventDate) return null;
    const eventTime = new Date(campaign.eventDate).getTime();
    const nowTime = new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventTime - nowTime) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return `${diffDays} days to event`;
    if (diffDays === 1) return `Tomorrow!`;
    if (diffDays === 0) return `Today!`;
    return `Event concluded`;
  }, [campaign.eventDate]);

  // Contributor count (fallback if donorCount is used in other interfaces)
  const totalContributors =
    campaign.contributorCount ??
    (campaign as unknown as { donorCount?: number }).donorCount ??
    campaign.contributions?.length ??
    0;

  // Pending and pledged totals
  const pendingTotal =
    (campaign as unknown as { pendingTotal?: number }).pendingTotal ??
    campaign.held ??
    0;
  const pledgedTotal = campaign.pledgedTotal ?? 0;

  // Progress percentage
  const progressPercent =
    campaign.raised !== null && campaign.target !== null && campaign.target > 0
      ? Math.min(100, Math.round((campaign.raised / campaign.target) * 100))
      : campaign.progressPercent ?? null;

  // Execute an action on the campaign API
  const postCampaignAction = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/fund/campaigns/${encodeURIComponent(campaign.slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error || data.message || 'Action failed');
    }
    return data;
  };

  // Toggle follow
  const handleToggleFollow = async () => {
    setActionError(null);
    try {
      await postCampaignAction({ action: 'toggleCampaignFollow' });
      await onRefresh?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update follow');
    }
  };

  // Toggle reaction
  const handleToggleReaction = async (reaction: string) => {
    setActionError(null);
    try {
      await postCampaignAction({ action: 'toggleCampaignReaction', reaction });
      await onRefresh?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to register reaction');
    }
  };

  // Submit Donation
  const handleSubmitDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setDonationError(null);
    setDonationSuccess(null);
    setIsSubmittingDonation(true);

    try {
      const parsedAmount = Number(customAmountStr);
      if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid positive contribution amount in RWF.');
      }

      const payload = {
        action: 'donate',
        amount: parsedAmount,
        contributionType,
        channel,
        outcome: contributionType === 'pledge' ? 'success' : simulatedOutcome,
        displayPreference,
        contributorName: displayPreference === 'public_name' && contributorNameInput.trim() ? contributorNameInput.trim() : undefined,
        customDisplayName: displayPreference === 'display_name' ? customDisplayName : undefined,
        giftItemId: selectedGiftItem ? selectedGiftItem.id : undefined,
        message: message.trim() || undefined,
        dedication: dedication.trim() || undefined,
        reference: `fund-${Date.now()}`,
      };

      await postCampaignAction(payload);
      setDonationSuccess('Simulated contribution submitted successfully!');
      await onRefresh?.();

      setTimeout(() => {
        setIsContributeModalOpen(false);
        setDonationSuccess(null);
      }, 1400);
    } catch (err: unknown) {
      setDonationError(err instanceof Error ? err.message : 'Failed to submit contribution');
    } finally {
      setIsSubmittingDonation(false);
    }
  };

  // Submit RSVP
  const handleSubmitRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRsvp(true);
    setRsvpSuccessMsg(null);
    try {
      await postCampaignAction({
        action: 'submitCampaignRsvp',
        guestName: rsvpGuestName.trim() || 'Invited Guest',
        attendanceStatus: rsvpStatus,
        guestsCount: Number(rsvpGuestsCount) || 1,
        dietaryOrNote: rsvpNotes.trim() || undefined,
      });
      setRsvpSuccessMsg('Thank you! Your RSVP has been confirmed.');
      setRsvpGuestName('');
      setRsvpNotes('');
      await onRefresh?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'RSVP submission failed');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  // Submit Comment / Guestbook
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    setCommentSuccessMsg(null);
    try {
      await postCampaignAction({
        action: 'addCampaignComment',
        message: commentText.trim(),
        commentType,
        reaction: commentReaction,
        authorName: commentAuthor.trim() || undefined,
        isAnonymous: commentIsAnon,
      });
      setCommentSuccessMsg('Your message has been posted to the guestbook!');
      setCommentText('');
      await onRefresh?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to post message');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Copy share URL
  const campaignUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/fund/campaigns/${campaign.slug}`
    : `/fund/campaigns/${campaign.slug}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(campaignUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Open contribute modal with optional gift item preselection
  const handleOpenContributeForGift = (gift: FundraisingGiftItem) => {
    setSelectedGiftItem(gift);
    const remaining = Math.max(1000, gift.targetAmount - gift.contributedAmount);
    setAmount(remaining);
    setCustomAmountStr(String(remaining));
    setIsContributeModalOpen(true);
  };

  // Verification status UI mapper
  const renderVerificationBadge = () => {
    switch (campaign.verificationStatus) {
      case 'verified_demo':
        return (
          <span className={`${s.statusBadge} ${s.badgeVerified}`}>
            <ShieldCheck size={13} /> HURIZA Verified Demo
          </span>
        );
      case 'pending_review':
        return (
          <span className={`${s.statusBadge} ${s.badgePending}`}>
            ⏳ Pending Review
          </span>
        );
      case 'requires_review':
        return (
          <span className={`${s.statusBadge} ${s.badgeRequiresReview}`}>
            ⚠ Requires Review
          </span>
        );
      case 'suspended':
        return (
          <span className={`${s.statusBadge} ${s.badgeRequiresReview}`}>
            ✕ Suspended
          </span>
        );
      default:
        return (
          <span className={`${s.statusBadge} ${s.badgeUnverified}`}>
            Unverified
          </span>
        );
    }
  };

  // Guardian alerts fallback
  const guardianAlerts =
    campaign.guardian?.alerts ??
    (campaign as unknown as { guardianAlerts?: { id: string; severity: 'info' | 'warning' | 'critical'; category: string; message: string }[] }).guardianAlerts ??
    [];

  return (
    <div className={`${s.platformWrap} ${themeClass}`}>
      {/* 1. TOP BAR — Isolated to THIS campaign for shared-link visitors; organizer controls shown only to campaign team */}
      <header className={s.topBar}>
        <div className={`${s.container} ${s.topBarInner}`}>
          <div className={s.breadcrumbRow}>
            {campaign.viewerAccess?.isOrganizerOrTeam ? (
              <>
                <Link href="/app/fundraising" className={s.navBackLink}>
                  ← Organizer Hub
                </Link>
                <div className={s.topBarDivider} />
                <Link href="/fund" className={s.navBackLink}>
                  All Campaigns
                </Link>
              </>
            ) : (
              <span className={s.navBackLink} style={{ cursor: 'default' }}>
                HURIZA FUND · Official Campaign Page
              </span>
            )}
          </div>

          <div className={s.topBarActions}>
            <div className={s.demoBannerBadge}>
              <Sparkles size={13} /> SIMULATED DEMO CAMPAIGN · NO REAL MONEY
            </div>

            {campaign.viewerAccess?.isOrganizerOrTeam && (
              <Link
                href={`/fund/manage/${campaign.id}`}
                className={`${s.topActionBtn} ${s.topActionBtnPrimary}`}
              >
                Manage Campaign
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER */}
      <section className={s.heroBanner}>
        {campaign.coverImageUrl && (
          <div
            className={s.heroBackdropArt}
            style={{ backgroundImage: `url(${campaign.coverImageUrl})` }}
          />
        )}
        <div className={`${s.container} ${s.heroGrid}`}>
          {/* Left: Campaign Identity & Badges */}
          <div className={s.heroInfo}>
            <div className={s.badgeRow}>
              <span className={s.familyBadge}>
                {campaign.family.toUpperCase()} · {campaign.subcategory.replace(/_/g, ' ').toUpperCase()}
              </span>
              {renderVerificationBadge()}
              {countdownInfo && (
                <span className={s.countdownBadge}>
                  <Calendar size={13} /> {countdownInfo}
                </span>
              )}
            </div>

            <h1 className={s.heroTitle}>{campaign.title}</h1>

            <div className={s.heroLocation}>
              <MapPin size={15} />
              <span>{campaign.location || 'Rwanda'}</span>
              {campaign.eventDate && (
                <>
                  <span style={{ margin: '0 6px', opacity: 0.5 }}>•</span>
                  <span>Event Date: {new Date(campaign.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </>
              )}
            </div>

            <div className={s.heroMetaLockup}>
              <div className={s.heroMetaBlock}>
                <span className={s.heroMetaLabel}>Organized By</span>
                <span className={s.heroMetaValue}>
                  <User size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                  {campaign.organizerName}
                </span>
              </div>

              {campaign.beneficiaryName && (
                <div className={s.heroMetaBlock}>
                  <span className={s.heroMetaLabel}>Beneficiary</span>
                  <span className={s.heroMetaValue}>
                    {campaign.beneficiaryName}
                    {campaign.beneficiaryType ? ` (${campaign.beneficiaryType})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Cover Image Card */}
          <div className={s.heroCoverContainer}>
            <img
              src={campaign.coverImageUrl || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'}
              alt={campaign.title}
              className={s.heroCoverImage}
            />
            <div className={s.heroCoverOverlay}>
              <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 600 }}>
                Category: {campaign.category}
              </span>
              <span style={{ color: '#ffffff', fontSize: 12, opacity: 0.85 }}>
                HURIZA Protected Fund
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN CONTENT WITH STICKY SIDEBAR */}
      <main className={s.container}>
        <div className={s.mainLayoutGrid}>
          {/* Main Column: Tabs and Sections */}
          <div className={s.mainColumn}>
            {actionError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                {actionError}
              </div>
            )}

            {/* TAB BAR */}
            <div className={s.tabNavList}>
              <button
                type="button"
                className={`${s.tabButton} ${activeTab === 'story' ? s.tabButtonActive : ''}`}
                onClick={() => setActiveTab('story')}
              >
                <FileText size={16} /> Story & Trust
              </button>

              <button
                type="button"
                className={`${s.tabButton} ${activeTab === 'updates' ? s.tabButtonActive : ''}`}
                onClick={() => setActiveTab('updates')}
              >
                <TrendingUp size={16} /> Updates
                {campaign.updates && campaign.updates.length > 0 && (
                  <span className={s.tabBadge}>{campaign.updates.length}</span>
                )}
              </button>

              {(campaign.family === 'moments' ||
                (campaign.giftItems && campaign.giftItems.length > 0) ||
                campaign.privacyPolicy?.allowRsvp) && (
                <button
                  type="button"
                  className={`${s.tabButton} ${activeTab === 'moments' ? s.tabButtonActive : ''}`}
                  onClick={() => setActiveTab('moments')}
                >
                  <Gift size={16} />
                  {campaign.family === 'moments' ? 'Celebration & Gifts' : 'Gifts & RSVP'}
                  {campaign.giftItems && campaign.giftItems.length > 0 && (
                    <span className={s.tabBadge}>{campaign.giftItems.length}</span>
                  )}
                </button>
              )}

              <button
                type="button"
                className={`${s.tabButton} ${activeTab === 'transparency' ? s.tabButtonActive : ''}`}
                onClick={() => setActiveTab('transparency')}
              >
                <ShieldCheck size={16} /> Transparency & Milestones
                {campaign.milestones && campaign.milestones.length > 0 && (
                  <span className={s.tabBadge}>{campaign.milestones.length}</span>
                )}
              </button>

              <button
                type="button"
                className={`${s.tabButton} ${activeTab === 'supporters' ? s.tabButtonActive : ''}`}
                onClick={() => setActiveTab('supporters')}
              >
                <Users size={16} /> Supporters & Guestbook
                {totalContributors > 0 && (
                  <span className={s.tabBadge}>{totalContributors}</span>
                )}
              </button>
            </div>

            {/* TAB CONTENT: STORY */}
            {activeTab === 'story' && (
              <div>
                <div className={s.cardBlock}>
                  <h2 className={s.sectionHeading}>About this Fundraiser</h2>
                  <div className={s.storyBody}>
                    {campaign.story || campaign.description || 'No story provided yet.'}
                  </div>

                  {/* HURIZA Guardian Insights Card */}
                  <div className={s.guardianCard}>
                    <div className={s.guardianHeader}>
                      <div className={s.guardianBrand}>
                        <ShieldCheck size={18} color="#0052cc" />
                        <span>HURIZA TrustFlow & Guardian Insights</span>
                      </div>
                      <span
                        className={`${s.transparencyBadge} ${
                          campaign.guardian?.transparencyScore === 'verified_clean'
                            ? s.transparencyClean
                            : campaign.guardian?.transparencyScore === 'needs_attention'
                            ? s.transparencyAttention
                            : s.transparencyRestricted
                        }`}
                      >
                        {campaign.guardian?.transparencyScore
                          ? campaign.guardian.transparencyScore.replace('_', ' ')
                          : 'VERIFIED DEMO CLEAN'}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                      This campaign operates with HURIZA safe integer ledger tracking. Disbursements require
                      multi-signatory expense proofs before release.
                    </div>

                    {guardianAlerts.length > 0 && (
                      <div className={s.guardianAlertList}>
                        {guardianAlerts.map(alert => (
                          <div key={alert.id} className={s.guardianAlertItem}>
                            <AlertCircle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Media Gallery */}
                {campaign.media && campaign.media.length > 0 && (
                  <div className={s.cardBlock}>
                    <h2 className={s.sectionHeading}>Media Gallery</h2>
                    <div className={s.mediaGrid}>
                      {campaign.media.map(item => (
                        <div key={item.id} className={s.mediaItemCard}>
                          <img src={item.url} alt={item.caption || 'Media item'} className={s.mediaThumbnail} />
                          {item.caption && <div className={s.mediaCaption}>{item.caption}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: UPDATES */}
            {activeTab === 'updates' && (
              <div className={s.cardBlock}>
                <h2 className={s.sectionHeading}>Campaign Updates & Milestones</h2>
                {campaign.updates && campaign.updates.length > 0 ? (
                  <div className={s.updatesTimeline}>
                    {campaign.updates.map(u => (
                      <div key={u.id} className={s.updateItem}>
                        <div className={s.updateHeader}>
                          <span className={s.updateTypeTag}>{u.updateType}</span>
                          <span className={s.updateDate}>
                            {new Date(u.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h3 className={s.updateTitle}>{u.title}</h3>
                        <div className={s.updateBody}>{u.body}</div>
                        {u.mediaUrl && (
                          <img src={u.mediaUrl} alt={u.title} className={s.updateMediaImg} />
                        )}
                        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                          Posted by {u.authorName}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: 14 }}>
                    No updates have been posted yet. The organizer will share progress and disbursement updates here.
                  </p>
                )}
              </div>
            )}

            {/* TAB CONTENT: MOMENTS / GIFTS & RSVP */}
            {activeTab === 'moments' && (
              <div>
                {/* Gift Registry Items */}
                {campaign.giftItems && campaign.giftItems.length > 0 && (
                  <div className={s.cardBlock}>
                    <h2 className={s.sectionHeading}>Gift Registry & Items</h2>
                    <div className={s.giftGrid}>
                      {campaign.giftItems.map(gift => {
                        const giftPct = Math.min(
                          100,
                          Math.round((gift.contributedAmount / gift.targetAmount) * 100)
                        );
                        return (
                          <div key={gift.id} className={s.giftCard}>
                            {gift.imageUrl && (
                              <img src={gift.imageUrl} alt={gift.title} className={s.giftImage} />
                            )}
                            <div className={s.giftContent}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3 className={s.giftTitle}>{gift.title}</h3>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: gift.status === 'fulfilled' ? '#166534' : '#1e40af',
                                    background: gift.status === 'fulfilled' ? '#dcfce7' : '#dbeafe',
                                    padding: '2px 7px',
                                    borderRadius: 9999,
                                  }}
                                >
                                  {gift.status.replace('_', ' ')}
                                </span>
                              </div>

                              <p className={s.giftDesc}>{gift.description}</p>

                              <div className={s.giftProgressRow}>
                                <span>{gift.contributedAmount.toLocaleString()} RWF contributed</span>
                                <span>{gift.targetAmount.toLocaleString()} RWF</span>
                              </div>

                              <div className={s.progressBarContainer}>
                                <div className={s.progressBarFill} style={{ width: `${giftPct}%` }} />
                              </div>

                              {gift.status !== 'fulfilled' && (
                                <button
                                  type="button"
                                  className={s.giftBtn}
                                  onClick={() => handleOpenContributeForGift(gift)}
                                >
                                  Contribute to Gift
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Event RSVP Form & List */}
                {campaign.privacyPolicy?.allowRsvp && (
                  <div className={s.cardBlock}>
                    <h2 className={s.sectionHeading}>Event Attendance & RSVP</h2>

                    <div className={s.rsvpCard}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>
                        Confirm Your Attendance
                      </h3>
                      {rsvpSuccessMsg && (
                        <div
                          style={{
                            background: '#dcfce7',
                            border: '1px solid #86efac',
                            color: '#166534',
                            padding: '8px 12px',
                            borderRadius: 6,
                            marginBottom: 12,
                            fontSize: 13,
                          }}
                        >
                          {rsvpSuccessMsg}
                        </div>
                      )}
                      <form onSubmit={handleSubmitRsvp} className={s.rsvpForm}>
                        <div className={s.formGroup}>
                          <label className={s.formLabel}>Your Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Jean Claude Munyaneza"
                            className={s.inputField}
                            value={rsvpGuestName}
                            onChange={e => setRsvpGuestName(e.target.value)}
                          />
                        </div>

                        <div className={s.formGroup}>
                          <label className={s.formLabel}>Attendance Status</label>
                          <select
                            className={s.selectField}
                            value={rsvpStatus}
                            onChange={e => setRsvpStatus(e.target.value as 'attending' | 'maybe' | 'declined')}
                          >
                            <option value="attending">Joyfully Attending</option>
                            <option value="maybe">Tentative / Maybe</option>
                            <option value="declined">Regretfully Decline</option>
                          </select>
                        </div>

                        <div className={s.formGroup}>
                          <label className={s.formLabel}>Number of Guests</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            className={s.inputField}
                            value={rsvpGuestsCount}
                            onChange={e => setRsvpGuestsCount(Number(e.target.value))}
                          />
                        </div>

                        <div className={s.formGroup}>
                          <label className={s.formLabel}>Dietary or Congratulatory Note</label>
                          <input
                            type="text"
                            placeholder="e.g. Vegetarian / Congratulations to both of you!"
                            className={s.inputField}
                            value={rsvpNotes}
                            onChange={e => setRsvpNotes(e.target.value)}
                          />
                        </div>

                        <div className={s.rsvpFullWidth}>
                          <button
                            type="submit"
                            disabled={isSubmittingRsvp}
                            className={s.primaryCtaBtn}
                            style={{ maxWidth: 220 }}
                          >
                            {isSubmittingRsvp ? 'Submitting...' : 'Submit RSVP'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* RSVP List */}
                    {campaign.rsvps && campaign.rsvps.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px 0', color: '#475569' }}>
                          Guest Attendance List ({campaign.rsvps.length})
                        </h4>
                        <div className={s.dataTableWrap}>
                          <table className={s.dataTable}>
                            <thead>
                              <tr>
                                <th>Guest</th>
                                <th>Status</th>
                                <th>Party Size</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {campaign.rsvps.map(r => (
                                <tr key={r.id}>
                                  <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                                  <td>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        padding: '2px 8px',
                                        borderRadius: 9999,
                                        background: r.attendanceStatus === 'attending' ? '#dcfce7' : '#f1f5f9',
                                        color: r.attendanceStatus === 'attending' ? '#166534' : '#475569',
                                      }}
                                    >
                                      {r.attendanceStatus}
                                    </span>
                                  </td>
                                  <td>{r.guestsCount}</td>
                                  <td style={{ color: '#64748b' }}>{r.dietaryOrNote || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: TRANSPARENCY & MILESTONES */}
            {activeTab === 'transparency' && (
              <div>
                {/* Milestones */}
                <div className={s.cardBlock}>
                  <h2 className={s.sectionHeading}>
                    <ShieldCheck size={20} color="#0052cc" /> HURIZA TrustFlow Milestones
                  </h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
                    Funds are allocated against transparent, verified project milestones before disbursement.
                  </p>

                  {campaign.milestones && campaign.milestones.length > 0 ? (
                    <div className={s.milestonesList}>
                      {campaign.milestones.map(m => (
                        <div key={m.id} className={s.milestoneCard}>
                          <div className={s.milestoneHeader}>
                            <div>
                              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>
                                {m.title}
                              </h3>
                              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                                {m.description}
                              </p>
                            </div>
                            <span
                              className={`${s.milestoneStatusPill} ${
                                m.outcomeStatus === 'completed_verified'
                                  ? s.statusCompleted
                                  : m.outcomeStatus === 'in_progress'
                                  ? s.statusInProgress
                                  : s.statusPlanned
                              }`}
                            >
                              {m.outcomeStatus.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 20, fontSize: 13, marginTop: 10, color: '#334155' }}>
                            <span>
                              <strong>Target:</strong> {m.targetAmount.toLocaleString()} RWF
                            </span>
                            <span>
                              <strong>Allocated:</strong> {m.allocatedAmount.toLocaleString()} RWF
                            </span>
                            <span>
                              <strong>Spent:</strong> {m.spentAmount.toLocaleString()} RWF
                            </span>
                          </div>

                          {m.outcomeEvidence && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#0369a1', background: '#f0f9ff', padding: '6px 10px', borderRadius: 4 }}>
                              Evidence / Audit Note: {m.outcomeEvidence}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: 14 }}>
                      No separate milestones specified. The campaign operates on standard project delivery governance.
                    </p>
                  )}
                </div>

                {/* Expense Accountability Table */}
                <div className={s.cardBlock}>
                  <h2 className={s.sectionHeading}>
                    <FileText size={20} color="#0052cc" /> Expense & Disbursement Records
                  </h2>

                  {campaign.viewerAccess?.canViewSpending ? (
                    campaign.expenses && campaign.expenses.length > 0 ? (
                      <div className={s.dataTableWrap}>
                        <table className={s.dataTable}>
                          <thead>
                            <tr>
                              <th>Title / Vendor</th>
                              <th>Category</th>
                              <th>Amount (RWF)</th>
                              <th>Requested By</th>
                              <th>Status</th>
                              <th>Receipt / Proof</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaign.expenses.map(e => (
                              <tr key={e.id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{e.vendorName || 'General Vendor'}</div>
                                </td>
                                <td>{e.category}</td>
                                <td style={{ fontWeight: 700, color: '#1e293b' }}>
                                  {e.amount.toLocaleString()} RWF
                                </td>
                                <td>{e.requestedByName || e.requestedBy}</td>
                                <td>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      padding: '2px 8px',
                                      borderRadius: 9999,
                                      background: e.status === 'paid' ? '#dcfce7' : '#fef3c7',
                                      color: e.status === 'paid' ? '#166534' : '#92400e',
                                    }}
                                  >
                                    {e.status}
                                  </span>
                                </td>
                                <td>
                                  {e.receiptUrl ? (
                                    <a
                                      href={e.receiptUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#0052cc', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                    >
                                      View <ExternalLink size={12} />
                                    </a>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>Verified on file</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: '#64748b', fontSize: 14 }}>
                        No disbursements or expenses have been requested yet.
                      </p>
                    )
                  ) : (
                    <div className={s.privacyLockCard}>
                      <div className={s.lockIconWrap}>
                        <Lock size={18} />
                      </div>
                      <div className={s.lockCopy}>
                        <div className={s.lockTitle}>Expense Audit Privacy Policy</div>
                        <div className={s.lockDesc}>
                          Detailed vendor expense entries are shared only with campaign organizers and confirmed
                          contributors in accordance with this campaign’s governance policy.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: SUPPORTERS & GUESTBOOK */}
            {activeTab === 'supporters' && (
              <div>
                {/* Contributors List */}
                <div className={s.cardBlock}>
                  <h2 className={s.sectionHeading}>
                    <Users size={20} color="#0052cc" /> Contributors ({totalContributors})
                  </h2>

                  {campaign.viewerAccess?.canViewContributors ? (
                    campaign.contributions && campaign.contributions.length > 0 ? (
                      <div className={s.supporterGrid}>
                        {campaign.contributions.map(c => {
                          const isAnon = c.displayPreference === 'anonymous';
                          const name = isAnon
                            ? 'Anonymous Supporter'
                            : (c as unknown as { customDisplayName?: string }).customDisplayName || c.contributorName;

                          return (
                            <div key={c.id} className={s.supporterCard}>
                              <div className={s.supporterTop}>
                                <span className={s.supporterName}>{name}</span>
                                {campaign.viewerAccess?.canViewRaised && c.amount !== null && (
                                  <span className={s.supporterAmt}>
                                    {c.amount.toLocaleString()} RWF
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                Channel: {c.channel.replace('_', ' ').toUpperCase()} • {new Date(c.createdAt).toLocaleDateString('en-GB')}
                              </div>

                              {c.dedication && (
                                <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                                  In dedication: {c.dedication}
                                </div>
                              )}

                              {c.message && <div className={s.supporterNote}>“{c.message}”</div>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ color: '#64748b', fontSize: 14 }}>
                        No public contributions recorded yet. Be the first to support this campaign!
                      </p>
                    )
                  ) : (
                    <div className={s.privacyLockCard}>
                      <div className={s.lockIconWrap}>
                        <Lock size={18} />
                      </div>
                      <div className={s.lockCopy}>
                        <div className={s.lockTitle}>Supporter List Privacy Policy</div>
                        <div className={s.lockDesc}>
                          The contributor list is kept private by the campaign organizer. Contributions are recorded
                          safely on the HURIZA financial ledger without public donor enumeration.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Guestbook & Comments */}
                <div className={s.cardBlock}>
                  <h2 className={s.sectionHeading}>
                    <MessageSquare size={20} color="#0052cc" /> Guestbook & Words of Encouragement
                  </h2>

                  {campaign.privacyPolicy?.allowComments ? (
                    <div className={s.commentSection}>
                      <form onSubmit={handleSubmitComment} className={s.commentBox}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px 0' }}>
                          Leave a Message of Support
                        </h4>
                        {commentSuccessMsg && (
                          <div
                            style={{
                              background: '#dcfce7',
                              border: '1px solid #86efac',
                              color: '#166534',
                              padding: '8px 12px',
                              borderRadius: 6,
                              marginBottom: 10,
                              fontSize: 13,
                            }}
                          >
                            {commentSuccessMsg}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label className={s.formLabel}>Message Category</label>
                            <select
                              className={s.selectField}
                              value={commentType}
                              onChange={e => setCommentType(e.target.value as 'encouragement' | 'guestbook' | 'congratulation' | 'prayer')}
                            >
                              <option value="encouragement">Encouragement</option>
                              <option value="congratulation">Congratulations</option>
                              <option value="prayer">Prayer & Blessing</option>
                              <option value="guestbook">Guestbook</option>
                            </select>
                          </div>
                          <div>
                            <label className={s.formLabel}>Reaction Badge</label>
                            <select
                              className={s.selectField}
                              value={commentReaction}
                              onChange={e => setCommentReaction(e.target.value as 'heart' | 'celebrate' | 'pray' | 'clap' | 'support')}
                            >
                              <option value="heart">❤️ Heart</option>
                              <option value="celebrate">🎉 Celebrate</option>
                              <option value="pray">🙏 Pray</option>
                              <option value="clap">👏 Clap</option>
                              <option value="support">🤝 Support</option>
                            </select>
                          </div>
                        </div>

                        <div className={s.formGroup} style={{ marginBottom: 10 }}>
                          <textarea
                            rows={3}
                            required
                            placeholder="Write your heartfelt note, prayer or memory..."
                            className={s.textareaField}
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <input
                              type="text"
                              placeholder="Your Name (Optional)"
                              className={s.inputField}
                              style={{ width: 180 }}
                              value={commentAuthor}
                              onChange={e => setCommentAuthor(e.target.value)}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#475569' }}>
                              <input
                                type="checkbox"
                                checked={commentIsAnon}
                                onChange={e => setCommentIsAnon(e.target.checked)}
                              />
                              Post anonymously
                            </label>
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmittingComment}
                            className={s.primaryCtaBtn}
                            style={{ width: 'auto', padding: '9px 18px', fontSize: 13 }}
                          >
                            {isSubmittingComment ? 'Posting...' : 'Post Message'}
                          </button>
                        </div>
                      </form>

                      {/* Comment Entries */}
                      {campaign.comments && campaign.comments.filter(c => c.status === 'visible').length > 0 ? (
                        <div>
                          {campaign.comments
                            .filter(c => c.status === 'visible')
                            .map(c => (
                              <div key={c.id} className={s.commentItem}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                                    {c.isAnonymous ? 'Anonymous Supporter' : c.authorName}
                                  </span>
                                  <span style={{ fontSize: 12, color: '#64748b' }}>
                                    {c.reaction === 'heart' && '❤️'}
                                    {c.reaction === 'celebrate' && '🎉'}
                                    {c.reaction === 'pray' && '🙏'}
                                    {c.reaction === 'clap' && '👏'}
                                    {c.reaction === 'support' && '🤝'}{' '}
                                    {new Date(c.createdAt).toLocaleDateString('en-GB')}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
                                  {c.message}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                          No messages yet. Be the first to sign the guestbook!
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: 14 }}>
                      Public comments are disabled for this campaign.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Sidebar: Contribution & Trust Card */}
          <aside className={s.stickySidebar}>
            <div className={s.contributionCard}>
              {/* Financial Totals or Lock Card */}
              {campaign.viewerAccess?.canViewRaised && campaign.raised !== null ? (
                <div className={s.financialTotalsBlock}>
                  <div className={s.raisedRow}>
                    <span className={s.raisedAmountBig}>
                      {campaign.raised.toLocaleString()} RWF
                    </span>
                    {campaign.viewerAccess?.canViewGoal && campaign.target !== null && (
                      <span className={s.targetGoalMuted}>
                        of {campaign.target.toLocaleString()} RWF goal
                      </span>
                    )}
                  </div>

                  {progressPercent !== null && (
                    <div className={s.progressBarContainer}>
                      <div
                        className={s.progressBarFill}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  <div className={s.progressStatsRow}>
                    <span>
                      {progressPercent !== null ? `${progressPercent}% funded` : 'Active'}
                    </span>
                    <span>
                      {totalContributors} contributor{totalContributors === 1 ? '' : 's'}
                    </span>
                  </div>

                  {(pendingTotal > 0 || pledgedTotal > 0) && (
                    <div className={s.statusPillsRow}>
                      {pendingTotal > 0 && (
                        <span className={s.pendingPill}>
                          Pending: {pendingTotal.toLocaleString()} RWF
                        </span>
                      )}
                      {pledgedTotal > 0 && (
                        <span className={s.pledgedPill}>
                          Pledged: {pledgedTotal.toLocaleString()} RWF
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className={s.privacyLockCard}>
                  <div className={s.lockIconWrap}>
                    <Lock size={18} />
                  </div>
                  <div className={s.lockCopy}>
                    <div className={s.lockTitle}>Private Financial Totals</div>
                    <div className={s.lockDesc}>
                      Shared only with authorized contributors and campaign organizers.
                    </div>
                  </div>
                </div>
              )}

              {/* Active Matching Sponsor Banner */}
              {campaign.matchingPledges && campaign.matchingPledges.length > 0 && (
                <div className={s.matchingSponsorBanner}>
                  <div className={s.matchingIcon}>⚡</div>
                  <div className={s.matchingCopy}>
                    <strong>Matching Sponsor Active:</strong> Every contribution is matched 1:1 by{' '}
                    <strong>{campaign.matchingPledges[0].sponsorName}</strong> (up to{' '}
                    {campaign.matchingPledges[0].remainingPledge.toLocaleString()} RWF).
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className={s.ctaButtonGroup}>
                <button
                  type="button"
                  className={s.primaryCtaBtn}
                  onClick={() => {
                    setSelectedGiftItem(null);
                    setIsContributeModalOpen(true);
                  }}
                >
                  <DollarSign size={18} /> Contribute Now (Simulated MoMo / Card)
                </button>

                <button
                  type="button"
                  className={s.secondaryCtaBtn}
                  onClick={() => setIsShareModalOpen(true)}
                >
                  <Share2 size={16} /> Share & QR Code
                </button>
              </div>

              {/* Follow & Reactions */}
              <div className={s.engagementRow}>
                <button
                  type="button"
                  className={`${s.followButton} ${campaign.isFollowing ? s.followButtonActive : ''}`}
                  onClick={handleToggleFollow}
                >
                  {campaign.isFollowing ? '✓ Following' : '+ Follow'}
                  <span style={{ fontSize: 11, opacity: 0.75 }}>({campaign.followerCount})</span>
                </button>

                <div className={s.reactionsCluster}>
                  {(
                    [
                      { key: 'heart', emoji: '❤️' },
                      { key: 'celebrate', emoji: '🎉' },
                      { key: 'pray', emoji: '🙏' },
                      { key: 'clap', emoji: '👏' },
                      { key: 'support', emoji: '🤝' },
                    ] as const
                  ).map(r => {
                    const count = campaign.reactionCounts?.[r.key] || 0;
                    const isActive = campaign.myReaction === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        className={`${s.reactionBtn} ${isActive ? s.reactionBtnActive : ''}`}
                        onClick={() => handleToggleReaction(r.key)}
                        title={`Reaction: ${r.key}`}
                      >
                        <span>{r.emoji}</span>
                        {count > 0 && <span>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* 4. INTERACTIVE CONTRIBUTION MODAL */}
      {isContributeModalOpen && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                {selectedGiftItem
                  ? `Contribute to Gift: ${selectedGiftItem.title}`
                  : `Contribute to ${campaign.title}`}
              </h2>
              <button
                type="button"
                className={s.modalCloseBtn}
                onClick={() => setIsContributeModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDonation}>
              <div className={s.modalBody}>
                {donationError && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                    {donationError}
                  </div>
                )}
                {donationSuccess && (
                  <div style={{ background: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                    {donationSuccess}
                  </div>
                )}

                <div className={s.simulatedDisclaimer}>
                  <Sparkles size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                  <strong>Simulated Demo Environment:</strong> No real money will be transferred or billed. This
                  updates the safe-integer campaign ledger for evaluation and testing.
                </div>

                {/* Amount Selection */}
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Select or Enter Amount (RWF)</label>
                  <div className={s.presetGrid}>
                    {(campaign.suggestedAmounts || [5000, 10000, 25000, 50000]).map(val => (
                      <button
                        key={val}
                        type="button"
                        className={`${s.presetBtn} ${Number(customAmountStr) === val ? s.presetBtnActive : ''}`}
                        onClick={() => {
                          setAmount(val);
                          setCustomAmountStr(String(val));
                        }}
                      >
                        {val.toLocaleString()} RWF
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    className={s.inputField}
                    style={{ marginTop: 6 }}
                    value={customAmountStr}
                    onChange={e => {
                      setCustomAmountStr(e.target.value);
                      const n = Number(e.target.value);
                      if (n > 0) setAmount(n);
                    }}
                    placeholder="Custom amount in RWF"
                  />
                </div>

                {/* Contribution Type */}
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Contribution Type</label>
                  <div className={s.radioCardRow}>
                    <div
                      className={`${s.radioCard} ${contributionType === 'one_time' ? s.radioCardSelected : ''}`}
                      onClick={() => setContributionType('one_time')}
                    >
                      <span className={s.radioCardTitle}>One-time Gift</span>
                      <span className={s.radioCardSub}>Instant simulated deposit</span>
                    </div>

                    <div
                      className={`${s.radioCard} ${contributionType === 'recurring_intent' ? s.radioCardSelected : ''}`}
                      onClick={() => setContributionType('recurring_intent')}
                    >
                      <span className={s.radioCardTitle}>Monthly Intent</span>
                      <span className={s.radioCardSub}>Simulated recurring support</span>
                    </div>

                    <div
                      className={`${s.radioCard} ${contributionType === 'pledge' ? s.radioCardSelected : ''}`}
                      onClick={() => setContributionType('pledge')}
                    >
                      <span className={s.radioCardTitle}>Formal Pledge</span>
                      <span className={s.radioCardSub}>Promise to fulfill later</span>
                    </div>
                  </div>
                </div>

                {/* Payment Channel */}
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Payment Channel</label>
                  <div className={s.radioCardRow}>
                    <div
                      className={`${s.radioCard} ${channel === 'mtn_momo' ? s.radioCardSelected : ''}`}
                      onClick={() => setChannel('mtn_momo')}
                    >
                      <span className={s.radioCardTitle}>MTN MoMo</span>
                      <span className={s.radioCardSub}>*182# USSD Push</span>
                    </div>

                    <div
                      className={`${s.radioCard} ${channel === 'airtel_money' ? s.radioCardSelected : ''}`}
                      onClick={() => setChannel('airtel_money')}
                    >
                      <span className={s.radioCardTitle}>Airtel Money</span>
                      <span className={s.radioCardSub}>*500# USSD Push</span>
                    </div>

                    <div
                      className={`${s.radioCard} ${channel === 'card_sim' ? s.radioCardSelected : ''}`}
                      onClick={() => setChannel('card_sim')}
                    >
                      <span className={s.radioCardTitle}>Simulated Card</span>
                      <span className={s.radioCardSub}>Visa / Mastercard</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Provider Outcome */}
                {contributionType !== 'pledge' && (
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Simulated Provider Response (Demo Testing)</label>
                    <select
                      className={s.selectField}
                      value={simulatedOutcome}
                      onChange={e => setSimulatedOutcome(e.target.value as 'success' | 'pending' | 'failed')}
                    >
                      <option value="success">Success (Immediate Ledger Settlement)</option>
                      <option value="pending">Pending (Held in Pending Queue)</option>
                      <option value="failed">Failed (Declined Transaction Simulation)</option>
                    </select>
                  </div>
                )}

                {/* Optional Gift Item Selection */}
                {campaign.giftItems && campaign.giftItems.length > 0 && !selectedGiftItem && (
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Optional: Direct to Registry Gift Item</label>
                    <select
                      className={s.selectField}
                      value={selectedGiftItem ? (selectedGiftItem as FundraisingGiftItem).id : ''}
                      onChange={e => {
                        const id = e.target.value;
                        const match = campaign.giftItems.find(g => g.id === id) || null;
                        setSelectedGiftItem(match);
                      }}
                    >
                      <option value="">General Campaign Contribution (No specific gift)</option>
                      {campaign.giftItems.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.title} ({g.contributedAmount.toLocaleString()} / {g.targetAmount.toLocaleString()} RWF)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Supporter Visibility */}
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Supporter Visibility</label>
                  <select
                    className={s.selectField}
                    value={displayPreference}
                    onChange={e => setDisplayPreference(e.target.value as 'public_name' | 'display_name' | 'anonymous')}
                  >
                    <option value="public_name">Show my full name</option>
                    <option value="display_name">Custom display alias</option>
                    <option value="anonymous">Anonymous Supporter (hide my name publicly)</option>
                  </select>

                  {displayPreference === 'public_name' && (
                    <input
                      type="text"
                      placeholder="Your full name (e.g. Patrick Ndayisaba)"
                      className={s.inputField}
                      style={{ marginTop: 6 }}
                      value={contributorNameInput}
                      onChange={e => setContributorNameInput(e.target.value)}
                    />
                  )}

                  {displayPreference === 'display_name' && (
                    <input
                      type="text"
                      required
                      placeholder="e.g. Friends from Huye"
                      className={s.inputField}
                      style={{ marginTop: 6 }}
                      value={customDisplayName}
                      onChange={e => setCustomDisplayName(e.target.value)}
                    />
                  )}
                </div>

                {/* Message and Dedication */}
                <div className={s.formGroup}>
                  <label className={s.formLabel}>Message of Encouragement (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Leave a warm message for the organizers & community..."
                    className={s.textareaField}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>Dedication (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. In memory of / In celebration of..."
                    className={s.inputField}
                    value={dedication}
                    onChange={e => setDedication(e.target.value)}
                  />
                </div>
              </div>

              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.secondaryCtaBtn}
                  style={{ width: 'auto' }}
                  onClick={() => setIsContributeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDonation}
                  className={s.primaryCtaBtn}
                  style={{ width: 'auto' }}
                >
                  {isSubmittingDonation
                    ? 'Processing...'
                    : `Confirm ${Number(customAmountStr).toLocaleString()} RWF Contribution`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SHARE & QR CODE MODAL */}
      {isShareModalOpen && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent} style={{ maxWidth: 460 }}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>Share Fundraiser</h2>
              <button
                type="button"
                className={s.modalCloseBtn}
                onClick={() => setIsShareModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={s.modalBody} style={{ alignItems: 'center', textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, color: '#475569', margin: 0 }}>
                Spread the word to mobilize community contributions for <strong>{campaign.title}</strong>.
              </p>

              {/* Inline SVG QR Code Graphic */}
              <div
                style={{
                  background: '#ffffff',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  margin: '12px auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <svg
                  width="170"
                  height="170"
                  viewBox="0 0 170 170"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="170" height="170" fill="white" />
                  {/* Outer corner 1 */}
                  <rect x="15" y="15" width="45" height="45" rx="6" fill="#003d99" />
                  <rect x="23" y="23" width="29" height="29" rx="3" fill="white" />
                  <rect x="29" y="29" width="17" height="17" rx="2" fill="#003d99" />
                  {/* Outer corner 2 */}
                  <rect x="110" y="15" width="45" height="45" rx="6" fill="#003d99" />
                  <rect x="118" y="23" width="29" height="29" rx="3" fill="white" />
                  <rect x="124" y="29" width="17" height="17" rx="2" fill="#003d99" />
                  {/* Outer corner 3 */}
                  <rect x="15" y="110" width="45" height="45" rx="6" fill="#003d99" />
                  <rect x="23" y="118" width="29" height="29" rx="3" fill="white" />
                  <rect x="29" y="124" width="17" height="17" rx="2" fill="#003d99" />
                  {/* Center Pattern Blocks */}
                  <rect x="75" y="20" width="18" height="18" rx="2" fill="#0052cc" />
                  <rect x="75" y="46" width="12" height="12" rx="2" fill="#0b65c6" />
                  <rect x="25" y="75" width="15" height="15" rx="2" fill="#0052cc" />
                  <rect x="50" y="75" width="20" height="20" rx="3" fill="#003d99" />
                  <rect x="75" y="75" width="20" height="20" rx="3" fill="#0052cc" />
                  <rect x="105" y="75" width="16" height="16" rx="2" fill="#003d99" />
                  <rect x="130" y="75" width="18" height="18" rx="2" fill="#0b65c6" />
                  <rect x="75" y="105" width="18" height="18" rx="2" fill="#003d99" />
                  <rect x="105" y="105" width="25" height="25" rx="3" fill="#0052cc" />
                  <rect x="135" y="105" width="15" height="15" rx="2" fill="#0b65c6" />
                  <rect x="75" y="132" width="22" height="22" rx="3" fill="#0b65c6" />
                  <rect x="110" y="138" width="18" height="18" rx="2" fill="#003d99" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0052cc', marginTop: 6, letterSpacing: 0.5 }}>
                  HURIZA SCAN TO CONTRIBUTE
                </span>
              </div>

              {/* Copy URL */}
              <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={campaignUrl}
                  className={s.inputField}
                  style={{ fontSize: 12, background: '#f8fafc' }}
                />
                <button
                  type="button"
                  className={s.secondaryCtaBtn}
                  style={{ width: 'auto', whiteSpace: 'nowrap' }}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check size={14} color="#166534" /> : <Copy size={14} />}
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Social Share Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginTop: 8 }}>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Support ${campaign.title} on HURIZA Fund: ${campaignUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={s.secondaryCtaBtn}
                  style={{ textDecoration: 'none', background: '#25d366', color: '#ffffff', borderColor: '#25d366' }}
                >
                  WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Support ${campaign.title} on HURIZA Fund:`)}&url=${encodeURIComponent(campaignUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={s.secondaryCtaBtn}
                  style={{ textDecoration: 'none', background: '#0f172a', color: '#ffffff', borderColor: '#0f172a' }}
                >
                  Post on X
                </a>
              </div>
            </div>

            <div className={s.modalFooter}>
              <button
                type="button"
                className={s.secondaryCtaBtn}
                onClick={() => setIsShareModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
