'use client';

import React, { useState } from 'react';
import type {
  CampaignFamily,
  CampaignVisibility,
  StatsVisibility,
  CampaignTheme,
} from '@/lib/contracts';
import {
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Gift,
  Plus,
  Trash2,
} from 'lucide-react';
import s from './fundraising-platform.module.css';

export interface FundraisingCreateWizardProps {
  onCreated?: (result: { id: string; slug: string }) => void;
  onCancel?: () => void;
}

interface MilestoneInput {
  title: string;
  description: string;
  targetAmount: number;
}

interface GiftItemInput {
  title: string;
  description: string;
  targetAmount: number;
  imageUrl: string;
}

const CURATED_PRESETS: { category: string; label: string; url: string }[] = [
  {
    category: 'Wedding',
    label: 'Elegant Rwandan Wedding Celebration',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Wedding',
    label: 'Outdoor Ceremony & Reception',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Birthday',
    label: 'Vibrant Jubilee Birthday Party',
    url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Birthday',
    label: 'Celebration Gathering & Cake',
    url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Education',
    label: 'STEM Science & Digital Classroom',
    url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Education',
    label: 'Books, Library & Student Futures',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Community',
    label: 'Clean Water Borehole & Solar Tap',
    url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Community',
    label: 'Agricultural Cooperative Harvest',
    url: 'https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Medical',
    label: 'Clinical Specialized Surgical Care',
    url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
  },
  {
    category: 'Medical',
    label: 'Rehabilitation & Emergency Trust',
    url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
  },
];

export function FundraisingCreateWizard({ onCreated, onCancel }: FundraisingCreateWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 9;

  // Step 1: Family
  const [family, setFamily] = useState<CampaignFamily>('moments');

  // Step 2: Category & Subcategory
  const [category, setCategory] = useState<string>('Wedding');
  const [subcategory, setSubcategory] = useState<string>('wedding');

  // Step 3: Identity & Goal
  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [targetStr, setTargetStr] = useState<string>('3000000');
  const [suggestedAmounts, setSuggestedAmounts] = useState<string>('5000, 10000, 25000, 50000');

  // Step 4: Story & Beneficiary
  const [description, setDescription] = useState<string>('');
  const [story, setStory] = useState<string>('');
  const [organizerName, setOrganizerName] = useState<string>('');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [beneficiaryType, setBeneficiaryType] = useState<string>('individual');
  const [location, setLocation] = useState<string>('Kigali, Rwanda');
  const [eventDate, setEventDate] = useState<string>('');

  // Step 5: Media & Cover
  const [coverImageUrl, setCoverImageUrl] = useState<string>(CURATED_PRESETS[0].url);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);

  // Step 6: Theme
  const [theme, setTheme] = useState<CampaignTheme>('wedding_elegant');

  // Step 7: Privacy & Visibility
  const [visibility, setVisibility] = useState<CampaignVisibility>('public');
  const [statsVisibility, setStatsVisibility] = useState<StatsVisibility>('everyone');
  const [goalVisibility, setGoalVisibility] = useState<StatsVisibility>('everyone');
  const [raisedVisibility, setRaisedVisibility] = useState<StatsVisibility>('everyone');
  const [contributorsVisibility, setContributorsVisibility] = useState<StatsVisibility>('everyone');
  const [spendingVisibility, setSpendingVisibility] = useState<StatsVisibility>('everyone');
  const [allowComments, setAllowComments] = useState<boolean>(true);
  const [allowAnonymous, setAllowAnonymous] = useState<boolean>(true);
  const [allowRsvp, setAllowRsvp] = useState<boolean>(true);

  // Step 8: Milestones / Gifts
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [giftItems, setGiftItems] = useState<GiftItemInput[]>([]);

  // Step 9: Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-sync slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const derivedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    setSlug(derivedSlug);
  };

  // Adjust defaults when family changes
  const handleFamilySelect = (selectedFamily: CampaignFamily) => {
    setFamily(selectedFamily);
    if (selectedFamily === 'moments') {
      setCategory('Wedding Celebration');
      setSubcategory('wedding');
      setTheme('wedding_elegant');
      setBeneficiaryType('family');
      setAllowRsvp(true);
      if (!coverImageUrl || !coverImageUrl.includes('unsplash')) {
        setCoverImageUrl(CURATED_PRESETS[0].url);
      }
    } else if (selectedFamily === 'causes') {
      setCategory('Education & Scholarships');
      setSubcategory('education');
      setTheme('classic_blue');
      setBeneficiaryType('individual');
      setAllowRsvp(false);
      setCoverImageUrl(CURATED_PRESETS[4].url);
    } else {
      setCategory('Community Water & Sanitation');
      setSubcategory('water');
      setTheme('community_impact');
      setBeneficiaryType('community');
      setAllowRsvp(false);
      setCoverImageUrl(CURATED_PRESETS[6].url);
    }
  };

  // Validate and upload local media via /api/fund/media
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMediaUploadError('Please choose a valid PNG, JPEG, or WebP image file.');
      return;
    }

    if (file.size > 2_500_000) {
      setMediaUploadError('Image exceeds 2.5MB maximum size.');
      return;
    }

    setIsUploadingMedia(true);
    setMediaUploadError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const res = await fetch('/api/fund/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'validate', url: dataUrl }),
        });
        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Media validation failed');
        }
        setCoverImageUrl(data.url || dataUrl);
      } catch (err: unknown) {
        setMediaUploadError(err instanceof Error ? err.message : 'Media upload failed');
      } finally {
        setIsUploadingMedia(false);
      }
    };
    reader.onerror = () => {
      setMediaUploadError('Failed to read image file');
      setIsUploadingMedia(false);
    };
    reader.readAsDataURL(file);
  };

  // Milestone management
  const addEmptyMilestone = () => {
    setMilestones(prev => [
      ...prev,
      { title: '', description: '', targetAmount: 500000 },
    ]);
  };

  const removeMilestone = (idx: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, patch: Partial<MilestoneInput>) => {
    setMilestones(prev =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  // Gift item management
  const addEmptyGiftItem = () => {
    setGiftItems(prev => [
      ...prev,
      {
        title: '',
        description: '',
        targetAmount: 50000,
        imageUrl: '',
      },
    ]);
  };

  const removeGiftItem = (idx: number) => {
    setGiftItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateGiftItem = (idx: number, patch: Partial<GiftItemInput>) => {
    setGiftItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  // Prepopulate standard sample items
  const populateSampleGifts = () => {
    setGiftItems([
      {
        title: 'Tiered Celebration Cake',
        description: 'Traditional artisan cake crafted for the reception dinner.',
        targetAmount: 180000,
        imageUrl: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=600&q=80',
      },
      {
        title: 'Ceremony Photography & Album',
        description: 'Complete memory preservation with video and hardbound portrait book.',
        targetAmount: 450000,
        imageUrl: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=600&q=80',
      },
      {
        title: 'Celebration Dinner for Table of 10',
        description: 'Shared banquet table contribution for close friends and extended family.',
        targetAmount: 250000,
        imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=600&q=80',
      },
    ]);
  };

  const populateSampleMilestones = () => {
    setMilestones([
      {
        title: 'Phase 1: Procurement & Materials',
        description: 'Direct procurement of certified hardware and supplies with receipts.',
        targetAmount: 1000000,
      },
      {
        title: 'Phase 2: Installation & Field Execution',
        description: 'On-site technical construction and community workforce deployment.',
        targetAmount: 1500000,
      },
      {
        title: 'Phase 3: Inspection & Handover Audit',
        description: 'Final quality verification and handover report publication.',
        targetAmount: 500000,
      },
    ]);
  };

  // Submit complete campaign creation
  const handlePublish = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const parsedTarget = Number(targetStr);
      if (!Number.isSafeInteger(parsedTarget) || parsedTarget <= 0) {
        throw new Error('Campaign target goal must be a positive safe integer in RWF.');
      }

      const payload = {
        title: title.trim(),
        category: category.trim(),
        subcategory: subcategory.trim(),
        family,
        theme,
        description: description.trim() || title.trim(),
        story: story.trim() || description.trim() || title.trim(),
        target: parsedTarget,
        slug: slug.trim() || undefined,
        organizerName: organizerName.trim() || 'HURIZA Campaign Organizer',
        beneficiaryName: beneficiaryName.trim() || title.trim(),
        beneficiaryType,
        location: location.trim() || 'Kigali, Rwanda',
        eventDate: eventDate.trim() || undefined,
        coverImageUrl: coverImageUrl.trim(),
        videoUrl: videoUrl.trim() || undefined,
        visibility,
        statsVisibility,
        goalVisibility,
        raisedVisibility,
        contributorsVisibility,
        spendingVisibility,
        allowComments,
        allowAnonymous,
        allowRsvp,
        suggestedAmounts: suggestedAmounts.trim() || '5000,10000,25000,50000',
        milestones: milestones.filter(m => m.title.trim() && m.targetAmount > 0),
        giftItems: giftItems.filter(g => g.title.trim() && g.targetAmount > 0),
      };

      const res = await fetch('/api/fund/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        result?: { id: string; slug: string };
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.error || data.message || 'Failed to create campaign');
      }

      onCreated?.({ id: data.result.id, slug: data.result.slug });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to publish campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step Validation check before allowing "Next"
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return Boolean(family);
      case 2:
        return Boolean(category.trim() && subcategory.trim());
      case 3: {
        const amt = Number(targetStr);
        return Boolean(title.trim() && Number.isSafeInteger(amt) && amt > 0);
      }
      case 4:
        return Boolean(organizerName.trim() && (description.trim() || story.trim()));
      case 5:
        return Boolean(coverImageUrl.trim());
      case 6:
        return Boolean(theme);
      case 7:
        return true;
      case 8:
        return true;
      case 9:
        return true;
      default:
        return true;
    }
  };

  return (
    <div className={s.wizardWrap}>
      {/* Wizard Header */}
      <div className={s.wizardHeader}>
        <h1 className={s.wizardTitle}>HURIZA Campaign Studio</h1>
        <p className={s.wizardSubtitle}>
          Step {currentStep} of {totalSteps}: Create a verified, audit-backed fundraising campaign
          with safe-integer financial accounting.
        </p>
      </div>

      {/* Stepper Track */}
      <div className={s.stepperTrack}>
        {[
          { num: 1, label: 'Family' },
          { num: 2, label: 'Category' },
          { num: 3, label: 'Goal' },
          { num: 4, label: 'Story' },
          { num: 5, label: 'Media' },
          { num: 6, label: 'Theme' },
          { num: 7, label: 'Privacy' },
          { num: 8, label: 'Milestones' },
          { num: 9, label: 'Review' },
        ].map(step => {
          const isActive = step.num === currentStep;
          const isDone = step.num < currentStep;
          return (
            <div
              key={step.num}
              className={`${s.stepNode} ${isActive ? s.stepNodeActive : ''} ${isDone ? s.stepNodeDone : ''}`}
              onClick={() => {
                if (step.num < currentStep) setCurrentStep(step.num);
              }}
            >
              <div
                className={`${s.stepNumber} ${isActive ? s.stepNumberActive : ''} ${isDone ? s.stepNumberDone : ''}`}
              >
                {isDone ? <Check size={13} /> : step.num}
              </div>
              <span className={s.stepName}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Wizard Step Content */}
      <div className={s.wizardContent}>
        {/* STEP 1: FAMILY */}
        {currentStep === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Choose Campaign Family
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 24 }}>
              Select the purpose archetype to tailor governance, guest engagement, and privacy policy defaults.
            </p>

            <div className={s.familyOptionGrid}>
              <div
                className={`${s.familyCard} ${family === 'moments' ? s.familyCardSelected : ''}`}
                onClick={() => handleFamilySelect('moments')}
              >
                <div style={{ fontSize: 28 }}>💍</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Moments & Celebrations
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  Weddings, jubilees, baby welcomes, anniversaries, and academic graduations with gift
                  registries and guest RSVPs.
                </p>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9a6b1f', marginTop: 'auto' }}>
                  Features: Registry items + Guest RSVP + Dedications
                </span>
              </div>

              <div
                className={`${s.familyCard} ${family === 'causes' ? s.familyCardSelected : ''}`}
                onClick={() => handleFamilySelect('causes')}
              >
                <div style={{ fontSize: 28 }}>🤝</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Causes & Relief
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  Emergency medical assistance, student scholarships, community relief, and memorials
                  with protective privacy safeguards.
                </p>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0052cc', marginTop: 'auto' }}>
                  Features: Protective privacy + Milestones + Medical proofs
                </span>
              </div>

              <div
                className={`${s.familyCard} ${family === 'community' ? s.familyCardSelected : ''}`}
                onClick={() => handleFamilySelect('community')}
              >
                <div style={{ fontSize: 28 }}>🌱</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Community Projects
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  Clean water boreholes, school laboratories, cooperative post-harvest facilities, and
                  village infrastructure.
                </p>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', marginTop: 'auto' }}>
                  Features: TrustFlow milestones + Vendor receipt accountability
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CATEGORY & SUBCATEGORY */}
        {currentStep === 2 && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Category & Focus
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              Specify the exact focus area to establish the campaign’s discovery tags and verification standard.
            </p>

            {family === 'moments' && (
              <div className={s.formGroup} style={{ marginBottom: 16 }}>
                <label className={s.formLabel}>Celebration Preset</label>
                <select
                  className={s.selectField}
                  value={subcategory}
                  onChange={e => {
                    const sub = e.target.value;
                    setSubcategory(sub);
                    if (sub === 'wedding') {
                      setCategory('Wedding Celebration');
                      setTheme('wedding_elegant');
                    } else if (sub === 'birthday') {
                      setCategory('Birthday Celebration');
                      setTheme('birthday_celebration');
                    } else if (sub === 'graduation') {
                      setCategory('Academic Graduation');
                      setTheme('classic_blue');
                    } else {
                      setCategory('Family Milestone');
                    }
                  }}
                >
                  <option value="wedding">Wedding & Matrimony Celebration</option>
                  <option value="birthday">Birthday Milestone & Jubilee</option>
                  <option value="graduation">Graduation & University Achievement</option>
                  <option value="family_milestone">Family Anniversary & Welcome</option>
                </select>
              </div>
            )}

            {family === 'causes' && (
              <div className={s.formGroup} style={{ marginBottom: 16 }}>
                <label className={s.formLabel}>Cause Preset</label>
                <select
                  className={s.selectField}
                  value={subcategory}
                  onChange={e => {
                    const sub = e.target.value;
                    setSubcategory(sub);
                    if (sub === 'medical') {
                      setCategory('Medical Assistance');
                      setTheme('medical_trust');
                      setBeneficiaryType('individual');
                    } else if (sub === 'education') {
                      setCategory('Education & Scholarships');
                      setTheme('classic_blue');
                      setBeneficiaryType('individual');
                    } else if (sub === 'child_welfare') {
                      setCategory('Child Welfare Support');
                      setTheme('charity_warm');
                      setBeneficiaryType('child_protected');
                      setStatsVisibility('contributors_only');
                    } else {
                      setCategory('Emergency Relief');
                      setTheme('charity_warm');
                    }
                  }}
                >
                  <option value="education">Education & University Scholarships</option>
                  <option value="medical">Medical Relief & Emergency Care</option>
                  <option value="child_welfare">Child Welfare & Protection (Privacy Guarded)</option>
                  <option value="disaster_relief">Disaster & Crisis Assistance</option>
                  <option value="memorial">Memorial Support & Tribute</option>
                </select>
              </div>
            )}

            {family === 'community' && (
              <div className={s.formGroup} style={{ marginBottom: 16 }}>
                <label className={s.formLabel}>Community Focus Preset</label>
                <select
                  className={s.selectField}
                  value={subcategory}
                  onChange={e => {
                    const sub = e.target.value;
                    setSubcategory(sub);
                    if (sub === 'water') {
                      setCategory('Clean Water & Sanitation');
                      setTheme('community_impact');
                    } else if (sub === 'cooperative') {
                      setCategory('Cooperative Infrastructure');
                      setTheme('charity_warm');
                    } else {
                      setCategory('Youth & Sports Development');
                      setTheme('classic_blue');
                    }
                  }}
                >
                  <option value="water">Clean Water Wells & Solar Pumps</option>
                  <option value="cooperative">Agricultural Cooperative Storage & Tools</option>
                  <option value="youth_sports">School Libraries & Youth Development</option>
                  <option value="environment">Community Agroforestry & Terracing</option>
                </select>
              </div>
            )}

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>Public Category Name</label>
              <input
                type="text"
                required
                className={s.inputField}
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Wedding Celebration"
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Subcategory Key</label>
              <input
                type="text"
                required
                className={s.inputField}
                value={subcategory}
                onChange={e => setSubcategory(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. wedding"
              />
            </div>
          </div>
        )}

        {/* STEP 3: IDENTITY & GOAL */}
        {currentStep === 3 && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Campaign Title & Financial Goal
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              Define the campaign name and set the target amount in safe integer Rwandan Francs (RWF).
            </p>

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>Campaign Title</label>
              <input
                type="text"
                required
                className={s.inputField}
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="e.g. Keza & Manzi Wedding Celebration Fund"
              />
            </div>

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>URL Slug</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>/fund/campaigns/</span>
                <input
                  type="text"
                  required
                  className={s.inputField}
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="keza-manzi-wedding"
                />
              </div>
            </div>

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>Target Goal (RWF)</label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                className={s.inputField}
                value={targetStr}
                onChange={e => setTargetStr(e.target.value)}
                placeholder="5000000"
              />
              <span style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Target: {Number(targetStr || 0).toLocaleString()} RWF
              </span>
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Suggested Contribution Presets (Comma-separated RWF)</label>
              <input
                type="text"
                className={s.inputField}
                value={suggestedAmounts}
                onChange={e => setSuggestedAmounts(e.target.value)}
                placeholder="5000, 10000, 25000, 50000"
              />
            </div>
          </div>
        )}

        {/* STEP 4: STORY & BENEFICIARY */}
        {currentStep === 4 && (
          <div style={{ maxWidth: 680 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Story, Beneficiary & Logistics
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              Describe the fundraiser and provide transparent beneficiary representation.
            </p>

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>Organizer / Committee Name</label>
              <input
                type="text"
                required
                className={s.inputField}
                value={organizerName}
                onChange={e => setOrganizerName(e.target.value)}
                placeholder="e.g. Wedding Organizing Committee"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Beneficiary Name</label>
                <input
                  type="text"
                  className={s.inputField}
                  value={beneficiaryName}
                  onChange={e => setBeneficiaryName(e.target.value)}
                  placeholder="e.g. Keza & Manzi"
                />
              </div>

              <div className={s.formGroup}>
                <label className={s.formLabel}>Beneficiary Entity Type</label>
                <select
                  className={s.selectField}
                  value={beneficiaryType}
                  onChange={e => setBeneficiaryType(e.target.value)}
                >
                  <option value="self">Self (Organizer is beneficiary)</option>
                  <option value="individual">Named Individual</option>
                  <option value="family">Family Unit</option>
                  <option value="child_protected">Child Protected (Anonymized by default)</option>
                  <option value="community">Community Group / Village</option>
                  <option value="organization">Registered Nonprofit / Cooperative</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Location / District</label>
                <input
                  type="text"
                  className={s.inputField}
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Kigali, Gasabo District"
                />
              </div>

              <div className={s.formGroup}>
                <label className={s.formLabel}>Event or Deadline Date (Optional)</label>
                <input
                  type="date"
                  className={s.inputField}
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                />
              </div>
            </div>

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>Short Summary (1-2 sentences)</label>
              <input
                type="text"
                className={s.inputField}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A warm celebration uniting friends and family..."
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Full Campaign Narrative & Story</label>
              <textarea
                rows={5}
                className={s.textareaField}
                value={story}
                onChange={e => setStory(e.target.value)}
                placeholder="Share the full background, milestones, and how contributions will be utilized..."
              />
            </div>
          </div>
        )}

        {/* STEP 5: MEDIA & COVER */}
        {currentStep === 5 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Cover Image & Media
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              Select a curated photography preset, paste a secure HTTPS image link, or upload a local image.
            </p>

            {/* Curated Presets Selection */}
            <label className={s.formLabel}>Curated High-Resolution Photography Presets</label>
            <div className={s.photoPresetGrid}>
              {CURATED_PRESETS.map((p, idx) => (
                <div
                  key={idx}
                  className={`${s.photoPresetCard} ${coverImageUrl === p.url ? s.photoPresetCardSelected : ''}`}
                  onClick={() => setCoverImageUrl(p.url)}
                  title={p.label}
                >
                  <img src={p.url} alt={p.label} className={s.photoPresetImg} />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0,0,0,0.7)',
                      color: '#ffffff',
                      fontSize: 10,
                      padding: '2px 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.category}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom URL or File Upload */}
            <div style={{ marginTop: 20, maxWidth: 640 }}>
              <div className={s.formGroup} style={{ marginBottom: 14 }}>
                <label className={s.formLabel}>Cover Image URL (HTTPS)</label>
                <input
                  type="url"
                  className={s.inputField}
                  value={coverImageUrl}
                  onChange={e => setCoverImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div className={s.formGroup} style={{ marginBottom: 14 }}>
                <label className={s.formLabel}>Or Upload Cover File (Validated via /api/fund/media)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className={s.inputField}
                  onChange={handleFileChange}
                />
                {isUploadingMedia && (
                  <span style={{ fontSize: 12, color: '#0052cc', marginTop: 4 }}>
                    Validating and formatting image...
                  </span>
                )}
                {mediaUploadError && (
                  <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                    {mediaUploadError}
                  </span>
                )}
              </div>

              <div className={s.formGroup}>
                <label className={s.formLabel}>Optional Video Presentation URL (YouTube/Vimeo)</label>
                <input
                  type="url"
                  className={s.inputField}
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: THEME */}
        {currentStep === 6 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Campaign Color Theme
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              Themes reflect the occasion and adjust the hero accents, badges, and progress bar hues.
            </p>

            <div className={s.themeOptionGrid}>
              {[
                {
                  id: 'wedding_elegant',
                  name: 'Wedding Elegant',
                  desc: 'Warm gold and ivory accents for joyful nuptials.',
                  strip: 'linear-gradient(135deg, #2b1f13 0%, #9a6b1f 100%)',
                },
                {
                  id: 'birthday_celebration',
                  name: 'Birthday Celebration',
                  desc: 'Vibrant indigo and amber for energetic jubilees.',
                  strip: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 50%, #f59e0b 100%)',
                },
                {
                  id: 'medical_trust',
                  name: 'Medical Trust',
                  desc: 'Clinical sky blue and calm teal for patient health relief.',
                  strip: 'linear-gradient(135deg, #082f49 0%, #0284c7 100%)',
                },
                {
                  id: 'charity_warm',
                  name: 'Charity Warm',
                  desc: 'Deep forest green and emerald for grassroots charity.',
                  strip: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
                },
                {
                  id: 'community_impact',
                  name: 'Community Impact',
                  desc: 'Ocean teal and deep cyan for public civic infrastructure.',
                  strip: 'linear-gradient(135deg, #042f2e 0%, #0d9488 100%)',
                },
                {
                  id: 'classic_blue',
                  name: 'Classic HURIZA Blue',
                  desc: 'Authoritative blue gradient representing financial rigor.',
                  strip: 'linear-gradient(135deg, #081d40 0%, #0052cc 100%)',
                },
              ].map(t => (
                <div
                  key={t.id}
                  className={`${s.themeCard} ${theme === t.id ? s.themeCardSelected : ''}`}
                  onClick={() => setTheme(t.id as CampaignTheme)}
                >
                  <div className={s.themePreviewStrip} style={{ background: t.strip }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>{t.name}</strong>
                    {theme === t.id && <Check size={16} color="#0052cc" />}
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: PRIVACY & VISIBILITY */}
        {currentStep === 7 && (
          <div style={{ maxWidth: 680 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
              Privacy & Financial Governance
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              HURIZA gives organizers full control over who can inspect financial totals and donor identities.
            </p>

            <div className={s.formGroup} style={{ marginBottom: 16 }}>
              <label className={s.formLabel}>Campaign Visibility</label>
              <div className={s.radioCardRow}>
                <div
                  className={`${s.radioCard} ${visibility === 'public' ? s.radioCardSelected : ''}`}
                  onClick={() => setVisibility('public')}
                >
                  <span className={s.radioCardTitle}>Public</span>
                  <span className={s.radioCardSub}>Discoverable on HURIZA directory</span>
                </div>

                <div
                  className={`${s.radioCard} ${visibility === 'unlisted' ? s.radioCardSelected : ''}`}
                  onClick={() => setVisibility('unlisted')}
                >
                  <span className={s.radioCardTitle}>Unlisted</span>
                  <span className={s.radioCardSub}>Only accessible via direct link</span>
                </div>

                <div
                  className={`${s.radioCard} ${visibility === 'private' ? s.radioCardSelected : ''}`}
                  onClick={() => setVisibility('private')}
                >
                  <span className={s.radioCardTitle}>Private</span>
                  <span className={s.radioCardSub}>Requires explicit access grant</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Raised Totals Visibility</label>
                <select
                  className={s.selectField}
                  value={raisedVisibility}
                  onChange={e => setRaisedVisibility(e.target.value as StatsVisibility)}
                >
                  <option value="everyone">Everyone (Publicly visible)</option>
                  <option value="contributors_only">Contributors Only</option>
                  <option value="selected_contributors">Invited Donors Only</option>
                  <option value="team_only">Organizing Team Only</option>
                </select>
              </div>

              <div className={s.formGroup}>
                <label className={s.formLabel}>Contributors List Visibility</label>
                <select
                  className={s.selectField}
                  value={contributorsVisibility}
                  onChange={e => setContributorsVisibility(e.target.value as StatsVisibility)}
                >
                  <option value="everyone">Everyone (Publicly visible)</option>
                  <option value="contributors_only">Contributors Only</option>
                  <option value="selected_contributors">Invited Donors Only</option>
                  <option value="team_only">Organizing Team Only</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div className={s.formGroup}>
                <label className={s.formLabel}>Spending / Expenses Visibility</label>
                <select
                  className={s.selectField}
                  value={spendingVisibility}
                  onChange={e => setSpendingVisibility(e.target.value as StatsVisibility)}
                >
                  <option value="everyone">Everyone (Full Transparency)</option>
                  <option value="contributors_only">Contributors Only</option>
                  <option value="team_only">Organizing Team Only</option>
                </select>
              </div>

              <div className={s.formGroup}>
                <label className={s.formLabel}>Goal Target Visibility</label>
                <select
                  className={s.selectField}
                  value={goalVisibility}
                  onChange={e => setGoalVisibility(e.target.value as StatsVisibility)}
                >
                  <option value="everyone">Everyone (Public goal)</option>
                  <option value="contributors_only">Contributors Only</option>
                  <option value="team_only">Organizing Team Only</option>
                </select>
              </div>
            </div>

            {/* Engagement Toggles */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={e => setAllowComments(e.target.checked)}
                />
                <strong>Allow guestbook messages & words of encouragement</strong>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={allowAnonymous}
                  onChange={e => setAllowAnonymous(e.target.checked)}
                />
                <strong>Allow anonymous donations (donors can mask their identity)</strong>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={allowRsvp}
                  onChange={e => setAllowRsvp(e.target.checked)}
                />
                <strong>Enable Event RSVP tracking form on the campaign page</strong>
              </label>
            </div>
          </div>
        )}

        {/* STEP 8: MILESTONES OR GIFTS */}
        {currentStep === 8 && (
          <div>
            {family === 'moments' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px 0', color: '#1e293b' }}>
                      Gift Registry Items
                    </h2>
                    <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>
                      Allow supporters to contribute specifically toward meaningful celebration items.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={s.secondaryCtaBtn}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={populateSampleGifts}
                    >
                      Pre-fill Sample Registry
                    </button>
                    <button
                      type="button"
                      className={s.primaryCtaBtn}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={addEmptyGiftItem}
                    >
                      <Plus size={14} /> Add Gift Item
                    </button>
                  </div>
                </div>

                {giftItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {giftItems.map((g, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 14,
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 140px 40px',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          required
                          placeholder="Gift Title (e.g. Wedding Cake)"
                          className={s.inputField}
                          value={g.title}
                          onChange={e => updateGiftItem(idx, { title: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="Description (Optional)"
                          className={s.inputField}
                          value={g.description}
                          onChange={e => updateGiftItem(idx, { description: e.target.value })}
                        />
                        <input
                          type="number"
                          min="1000"
                          step="1000"
                          required
                          placeholder="Amount RWF"
                          className={s.inputField}
                          value={g.targetAmount}
                          onChange={e => updateGiftItem(idx, { targetAmount: Number(e.target.value) })}
                        />
                        <button
                          type="button"
                          onClick={() => removeGiftItem(idx)}
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: 6,
                            height: 38,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 20px', background: '#f8fafc', borderRadius: 8 }}>
                    <Gift size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <p style={{ color: '#64748b', fontSize: 13.5, margin: '0 0 12px 0' }}>
                      No gift registry items configured yet. You can add specific items or accept general gifts.
                    </p>
                    <button
                      type="button"
                      className={s.secondaryCtaBtn}
                      style={{ width: 'auto', margin: '0 auto', fontSize: 12 }}
                      onClick={populateSampleGifts}
                    >
                      Pre-fill Sample Registry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px 0', color: '#1e293b' }}>
                      HURIZA TrustFlow Milestones
                    </h2>
                    <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>
                      Define project delivery stages to demonstrate accountability to contributors.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={s.secondaryCtaBtn}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={populateSampleMilestones}
                    >
                      Pre-fill Standard Phases
                    </button>
                    <button
                      type="button"
                      className={s.primaryCtaBtn}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={addEmptyMilestone}
                    >
                      <Plus size={14} /> Add Milestone
                    </button>
                  </div>
                </div>

                {milestones.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {milestones.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 14,
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 140px 40px',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          required
                          placeholder="Milestone Title (e.g. Phase 1)"
                          className={s.inputField}
                          value={m.title}
                          onChange={e => updateMilestone(idx, { title: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="Description / Audit Deliverable"
                          className={s.inputField}
                          value={m.description}
                          onChange={e => updateMilestone(idx, { description: e.target.value })}
                        />
                        <input
                          type="number"
                          min="1000"
                          step="1000"
                          required
                          placeholder="Target RWF"
                          className={s.inputField}
                          value={m.targetAmount}
                          onChange={e => updateMilestone(idx, { targetAmount: Number(e.target.value) })}
                        />
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: 6,
                            height: 38,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 20px', background: '#f8fafc', borderRadius: 8 }}>
                    <ShieldCheck size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <p style={{ color: '#64748b', fontSize: 13.5, margin: '0 0 12px 0' }}>
                      No milestones added yet. Adding milestones increases contributor confidence and transparency score.
                    </p>
                    <button
                      type="button"
                      className={s.secondaryCtaBtn}
                      style={{ width: 'auto', margin: '0 auto', fontSize: 12 }}
                      onClick={populateSampleMilestones}
                    >
                      Pre-fill Standard Phases
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 9: REVIEW & PUBLISH */}
        {currentStep === 9 && (
          <div style={{ maxWidth: 720 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px 0', color: '#1e293b' }}>
              Review & Publish Fundraiser
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
              Verify campaign parameters before activating the ledger entry.
            </p>

            {submitError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13.5,
                }}
              >
                {submitError}
              </div>
            )}

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>{title || 'Untitled Campaign'}</h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Family: <strong>{family.toUpperCase()}</strong> • Category: <strong>{category}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0052cc' }}>
                    {Number(targetStr || 0).toLocaleString()} RWF
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Target Goal</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>ORGANIZER</span>
                  <strong>{organizerName || 'Not specified'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>BENEFICIARY</span>
                  <strong>{beneficiaryName || title}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>LOCATION</span>
                  <strong>{location}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>VISIBILITY</span>
                  <strong style={{ textTransform: 'capitalize' }}>{visibility}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>THEME ACCENT</span>
                  <strong style={{ textTransform: 'capitalize' }}>{theme.replace('_', ' ')}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>
                    {family === 'moments' ? 'GIFT REGISTRY' : 'TRUSTFLOW MILESTONES'}
                  </span>
                  <strong>
                    {family === 'moments'
                      ? `${giftItems.length} items configured`
                      : `${milestones.length} milestones configured`}
                  </strong>
                </div>
              </div>

              {coverImageUrl && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 11, marginBottom: 4 }}>COVER PREVIEW</span>
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }}
                  />
                </div>
              )}
            </div>

            <div className={s.simulatedDisclaimer} style={{ marginBottom: 20 }}>
              <Sparkles size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
              <strong>Simulated Demonstration Campaign:</strong> When published, this campaign will be
              initialized in the simulated test environment. All ledger mathematics will strictly maintain
              safe-integer Rwandan Franc integrity.
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              className={s.primaryCtaBtn}
              onClick={handlePublish}
              style={{ fontSize: 16, padding: '14px 24px' }}
            >
              {isSubmitting ? 'Publishing Campaign...' : 'Publish Fundraiser to HURIZA'}
            </button>
          </div>
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className={s.wizardFooterBar}>
        <div>
          {currentStep > 1 ? (
            <button
              type="button"
              className={s.secondaryCtaBtn}
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              style={{ width: 'auto', padding: '9px 18px' }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button
              type="button"
              className={s.secondaryCtaBtn}
              onClick={onCancel}
              style={{ width: 'auto', padding: '9px 18px' }}
            >
              Cancel
            </button>
          )}
        </div>

        <div>
          {currentStep < totalSteps ? (
            <button
              type="button"
              disabled={!canProceed()}
              className={s.primaryCtaBtn}
              onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
              style={{ width: 'auto', padding: '9px 24px' }}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
