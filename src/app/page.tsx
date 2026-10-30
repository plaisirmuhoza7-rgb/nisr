'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, BadgeCheck, Building2, Check, CircleHelp, Coins, Flame, HandCoins, HeartHandshake, Landmark, LockKeyhole, Radio, ShieldCheck, Smartphone, Sparkles, Users, WalletCards } from 'lucide-react';
import { calculateScenario } from '@/lib/guardian';
import LandingNavigation from '@/components/landing-navigation';
import BrandLogo from '@/components/brand-logo';
import { useLanguage } from '@/lib/i18n/context';
import styles from './landing.module.css';

const workspaceIcons = {
  personal: WalletCards,
  groups: Users,
  fundraising: HeartHandshake,
  cooperative: Landmark,
} as const;

const whyIcons = {
  precision: Coins,
  community: Users,
  guardian: ShieldCheck,
  inclusive: Smartphone,
} as const;

type WorkspaceKey = keyof typeof workspaceIcons;
const workspaceKeys: WorkspaceKey[] = ['personal', 'groups', 'fundraising', 'cooperative'];

const scenario = calculateScenario({ cash: 5_000_000, reserveBps: 2_000, requests: 1, loanAmount: 4_250_000, contributions: 0, expectedRepayments: 0, delayBps: 0, investment: 0, outstandingLoans: 0 });

export default function HomePage() {
  const { t, isKinyarwanda } = useLanguage();
  const money = (amount: number) => `${new Intl.NumberFormat(isKinyarwanda ? 'rw-RW' : 'en-RW').format(amount)} ${t.common.rwf}`;

  return <main className={styles.page}>
    <LandingNavigation />
    <section className={styles.heroBanner}>
      <div className={styles.heroContent}>
        <h1>{t.hero.title}</h1>
        <div className={styles.heroButtons}>
          <Link href="/signup" className={styles.heroStart}>{t.hero.getStarted} <ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/app" className={styles.heroContact}>{t.hero.myWorkspace} <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>

    <section className={styles.quickAbout} aria-labelledby="quick-about-title">
      <div className={styles.aboutArtwork}>
        <div className={styles.aboutImage}><Image src="/cel.webp" width={1254} height={1254} sizes="(max-width: 760px) 100vw, 45vw" alt="A smiling man using his phone, surrounded by savings illustrations" /></div>
        <div className={styles.aboutNote}><span><Sparkles size={19} aria-hidden="true" /></span><div><strong>{t.aboutSection.stepCounts}</strong><small>{t.aboutSection.stepPace}</small></div></div>
      </div>
      <div className={styles.aboutCopy}>
        <span className={styles.sectionEyebrow}>{t.aboutSection.eyebrow}</span>
        <h2 id="quick-about-title" style={{ whiteSpace: 'pre-line' }}>{t.aboutSection.title}</h2>
        <p>{t.aboutSection.p1}</p>
        <p>{t.aboutSection.p2}</p>
        <div className={styles.aboutHighlights}>
          <span><WalletCards size={17} aria-hidden="true" /> {t.aboutSection.personalGoals}</span>
          <span><Users size={17} aria-hidden="true" /> {t.aboutSection.communitySavings}</span>
        </div>
        <Link href="/signup" className={styles.aboutCta}>{t.aboutSection.getStarted} <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>

    <section className={styles.solutions} id="solutions">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.sectionEyebrow}>{t.solutions.eyebrow}</span>
          <h2 style={{ whiteSpace: 'pre-line' }}>{t.solutions.title}</h2>
        </div>
        <p>{t.solutions.subtitle}</p>
      </div>
      <div className={styles.workspaceGrid}>
        {workspaceKeys.map((id, index) => {
          const ws = t.solutions.workspaces[id];
          const Icon = workspaceIcons[id];
          return (
            <article className={styles.workspaceCard} key={id}>
              <div className={styles.workspaceTop}>
                <span className={styles.workspaceIcon}><Icon size={20} aria-hidden="true"/></span>
                <span className={styles.cardIndex}>0{index + 1}</span>
              </div>
              <span className={styles.cardEyebrow}>{ws.label}</span>
              <h3>{ws.title}</h3>
              <p>{ws.copy}</p>
              <div className={styles.workspaceDetail}>{ws.detail}</div>
              <div className={styles.workspaceLinks}>
                <Link className={styles.workspaceStart} href={`/signup?workspace=${id}`}>{t.solutions.getStarted} <ArrowRight size={15} aria-hidden="true"/></Link>
                <Link className={styles.workspacePreview} href={`/demo?workspace=${id}`}>{t.solutions.preview} <ArrowUpRight size={14} aria-hidden="true"/></Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>

    <section className={styles.whySection} id="why-choose-us" aria-labelledby="why-choose-us-title">
      <div className={styles.whyHeader}>
        <span className={styles.sectionEyebrow}>{t.whyChooseUs.eyebrow}</span>
        <h2 id="why-choose-us-title" style={{ whiteSpace: 'pre-line' }}>{t.whyChooseUs.title}</h2>
        <p>{t.whyChooseUs.subtitle}</p>
      </div>

      <div className={styles.whyLayout}>
        <div className={styles.whyVisual}>
          <div className={styles.whyImageCard}>
            <Image
              src="/star.webp"
              alt="HURIZA team and community members collaborating together on shared finances"
              width={1254}
              height={1254}
              sizes="(max-width: 760px) 100vw, (max-width: 1020px) 48vw, 540px"
            />
          </div>
          <div className={styles.whyFloatingBadge}>
            <Sparkles size={16} aria-hidden="true" />
            <span>{t.whyChooseUs.badgeText}</span>
          </div>
          <div className={styles.whyFloatingStat}>
            <span className={styles.whyStatIcon}>
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <strong>{t.whyChooseUs.statsHighlight}</strong>
              <small>{t.whyChooseUs.statsSubtext}</small>
            </div>
          </div>
        </div>

        <div className={styles.whyCardsGrid}>
          {t.whyChooseUs.cards.map((card) => {
            const Icon = whyIcons[card.id as keyof typeof whyIcons] ?? ShieldCheck;
            return (
              <article className={styles.whyCard} key={card.id}>
                <div className={styles.whyCardTop}>
                  <span className={styles.whyCardIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className={styles.whyCardTag}>{card.tag}</span>
                </div>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
                <span className={styles.whyCardPill}>{card.pill}</span>
              </article>
            );
          })}
        </div>
      </div>
    </section>

    <section className={styles.savingsHubSection} id="savings" aria-labelledby="savings-hub-title">
      <span id="savings-groups" className={styles.anchorOffset} aria-hidden="true" />
      <div className={styles.savingsHubContainer}>
        {/* Ambient atmospheric glows */}
        <div className={styles.savingsAtmosphereGlow} aria-hidden="true" />
        <div className={styles.savingsAtmosphereGlowAlt} aria-hidden="true" />

        {/* Hero Storytelling Grid: Storytelling & Dual CTAs (Left) + Visual Focal Art & Live UI Overlays (Right) */}
        <div className={styles.savingsHeroGrid}>
          {/* Left Content Column */}
          <div className={styles.savingsCopyColumn}>
            <div className={styles.savingsEyebrowBadge}>
              <span className={styles.savingsEyebrowDot} aria-hidden="true" />
              <span>{t.savingsHub.eyebrow}</span>
            </div>

            <h2 id="savings-hub-title" className={styles.savingsHeroTitle} style={{ whiteSpace: 'pre-line' }}>
              {t.savingsHub.title}
            </h2>

            <p className={styles.savingsHeroLead}>
              {t.savingsHub.subtitle}
            </p>

            {/* Two Clear Conversion Paths */}
            <div className={styles.savingsCtaGroup}>
              <Link href="/signup?workspace=personal" className={styles.savingsPrimaryCta}>
                <span>{t.savingsHub.ctaPersonal}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/app/groups/start" className={styles.savingsSecondaryCta}>
                <Users size={17} aria-hidden="true" />
                <span>{t.savingsHub.ctaGroups}</span>
              </Link>
            </div>

            <div className={styles.savingsTrustRow}>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{t.savingsHub.trustBadge}</span>
            </div>
          </div>

          {/* Right Visual Area: svx Lifestyle Artwork with Authentic UI Overlays */}
          <div className={styles.savingsVisualColumn}>
            <div className={styles.savingsVisualFrame}>
              <Image
                src="/svx.png"
                alt="Young Rwandan woman and community members planning personal goals and shared savings with HURIZA"
                width={1254}
                height={1254}
                sizes="(max-width: 760px) 100vw, (max-width: 1080px) 48vw, 530px"
                className={styles.savingsVisualImage}
                priority={false}
              />

              <div className={styles.savingsVisualOverlayGradient} aria-hidden="true" />

              {/* Floating Mockup 1: Personal Savings Goal Progress Card */}
              <div className={styles.savingsFloatPersonal}>
                <div className={styles.savingsFloatHeader}>
                  <span className={styles.savingsFloatIconPersonal}>
                    <WalletCards size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{t.savingsHub.visual.personalGoalTitle}</strong>
                    <small>{t.savingsHub.visual.personalGoalProgress}</small>
                  </div>
                </div>
                <div className={styles.savingsProgressBarTrack}>
                  <div className={styles.savingsProgressBarFill} style={{ width: '82%' }} />
                </div>
                <div className={styles.savingsProgressMeta}>
                  <span>{t.savingsHub.visual.personalGoalTarget}</span>
                  <span className={styles.savingsProgressPercent}>82%</span>
                </div>
              </div>

              {/* Floating Mockup 2: Savings Groups Cycle / Rotation Status */}
              <div className={styles.savingsFloatGroup}>
                <div className={styles.savingsFloatHeader}>
                  <span className={styles.savingsFloatIconGroup}>
                    <Users size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <div className={styles.savingsFloatTitleRow}>
                      <strong>{t.savingsHub.visual.groupStatusTitle}</strong>
                      <span className={styles.savingsPulseDot} aria-hidden="true" />
                    </div>
                    <small>{t.savingsHub.visual.groupStatusSub}</small>
                  </div>
                </div>
                <div className={styles.savingsGroupAvatars}>
                  <span className={styles.savingsAvatarBadge}>A</span>
                  <span className={styles.savingsAvatarBadge}>B</span>
                  <span className={styles.savingsAvatarBadge}>C</span>
                  <span className={styles.savingsAvatarCount}>+9</span>
                  <span className={styles.savingsGroupActiveLabel}>{t.savingsHub.visual.groupStatusMembers}</span>
                </div>
              </div>

              {/* Verified Security Badge */}
              <div className={styles.savingsSafetyBadge}>
                <Sparkles size={14} aria-hidden="true" />
                <span>{t.savingsHub.visual.verifiedBadge}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights: Personal Saving, Itsinda, Ikimina */}
        <div className={styles.savingsHighlightsGrid}>
          {/* Personal Saving */}
          <article className={styles.savingsHighlightCard}>
            <div className={styles.savingsHighlightTop}>
              <span className={styles.savingsHighlightIcon}>
                <WalletCards size={20} aria-hidden="true" />
              </span>
              <span className={styles.savingsHighlightTag}>{t.savingsHub.highlights.personal.tag}</span>
            </div>
            <h3 className={styles.savingsHighlightTitle}>{t.savingsHub.highlights.personal.title}</h3>
            <p className={styles.savingsHighlightDesc}>{t.savingsHub.highlights.personal.desc}</p>
            <Link href="/signup?workspace=personal" className={styles.savingsHighlightLink}>
              <span>{t.savingsHub.highlights.personal.action}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </article>

          {/* Itsinda */}
          <article className={styles.savingsHighlightCard}>
            <div className={styles.savingsHighlightTop}>
              <span className={styles.savingsHighlightIcon}>
                <Landmark size={20} aria-hidden="true" />
              </span>
              <span className={styles.savingsHighlightTag}>{t.savingsHub.highlights.itsinda.tag}</span>
            </div>
            <h3 className={styles.savingsHighlightTitle}>{t.savingsHub.highlights.itsinda.title}</h3>
            <p className={styles.savingsHighlightDesc}>{t.savingsHub.highlights.itsinda.desc}</p>
            <Link href="/app/groups/start" className={styles.savingsHighlightLink}>
              <span>{t.savingsHub.highlights.itsinda.action}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </article>

          {/* Ikimina */}
          <article className={styles.savingsHighlightCard}>
            <div className={styles.savingsHighlightTop}>
              <span className={styles.savingsHighlightIcon}>
                <Coins size={20} aria-hidden="true" />
              </span>
              <span className={styles.savingsHighlightTag}>{t.savingsHub.highlights.ikimina.tag}</span>
            </div>
            <h3 className={styles.savingsHighlightTitle}>{t.savingsHub.highlights.ikimina.title}</h3>
            <p className={styles.savingsHighlightDesc}>{t.savingsHub.highlights.ikimina.desc}</p>
            <Link href="/app/groups/start" className={styles.savingsHighlightLink}>
              <span>{t.savingsHub.highlights.ikimina.action}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </div>
    </section>

    <section className={styles.guardianSection} id="guardian">
      <div className={styles.guardianCopy}>
        <span className={styles.sectionEyebrow}>{t.guardian.eyebrow}</span>
        <h2 style={{ whiteSpace: 'pre-line' }}>{t.guardian.title}</h2>
        <p>{t.guardian.description}</p>
        <ul>
          <li><Check size={16}/> {t.guardian.point1}</li>
          <li><Check size={16}/> {t.guardian.point2}</li>
          <li><Check size={16}/> {t.guardian.point3}</li>
        </ul>
        <Link href="/demo#guardian" className={styles.textLink}>{t.guardian.openDemo} <ArrowUpRight size={15}/></Link>
      </div>
      <div className={styles.guardianPanel}>
        <div className={styles.panelTop}>
          <span><i/> {t.guardian.scenarioBadge}</span>
          <b>{t.guardian.syntheticRwf}</b>
        </div>
        <div className={styles.questionCard}>
          <span>{t.guardian.proposedDecision}</span>
          <strong>{t.guardian.question}</strong>
          <small>{t.guardian.scenarioContext}</small>
        </div>
        <div className={styles.scenarioMetrics}>
          <div><span>{t.guardian.requiredReserve}</span><strong>{money(scenario.reserve)}</strong></div>
          <div><span>{t.guardian.modeledEndingCash}</span><strong>{money(scenario.cashAfter)}</strong></div>
          <div><span>{t.guardian.reserveGap}</span><strong>{money(scenario.shortfall)}</strong></div>
        </div>
        <div className={styles.verdict}>
          <CircleHelp size={18}/>
          <div>
            <b>{t.guardian.verdictTitle}</b>
            <p>{scenario.explanation}</p>
          </div>
        </div>
        <div className={styles.disclosure}>
          <Sparkles size={14}/> {t.guardian.disclosure}
        </div>
      </div>
    </section>

    <section className={styles.ussdSection} id="ussd" aria-labelledby="ussd-title">
      <div className={styles.ussdStage}>
        <div className={styles.ussdCopy}>
          <span className={styles.ussdEyebrow}>
            <Flame size={15} aria-hidden="true" />
            {t.ussd.eyebrow}
          </span>
          <h2 id="ussd-title" style={{ whiteSpace: 'pre-line' }}>{t.ussd.title}</h2>
          <p className={styles.ussdLead}>{t.ussd.description}</p>

          <div className={styles.ussdFeatures}>
            <div className={styles.ussdFeatureItem}>
              <span className={styles.ussdFeatureIcon}>
                <Users size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{t.ussd.features.staff.title}</strong>
                <p>{t.ussd.features.staff.desc}</p>
              </div>
            </div>

            <div className={styles.ussdFeatureItem}>
              <span className={styles.ussdFeatureIcon}>
                <Radio size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{t.ussd.features.universal.title}</strong>
                <p>{t.ussd.features.universal.desc}</p>
              </div>
            </div>

            <div className={styles.ussdFeatureItem}>
              <span className={styles.ussdFeatureIcon}>
                <ShieldCheck size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{t.ussd.features.sync.title}</strong>
                <p>{t.ussd.features.sync.desc}</p>
              </div>
            </div>
          </div>

          <div className={styles.ussdActions}>
            <Link href="/demo#ussd" className={styles.ussdStartButton}>
              <Flame size={16} aria-hidden="true" />
              {t.ussd.exploreDemo}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <div className={styles.ussdNote}>
              <LockKeyhole size={16} aria-hidden="true" />
              <span>
                <b>{t.ussd.prototypeNote}:</b> {t.ussd.prototypeSub}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.ussdVisual}>
          <div className={styles.flameAura} aria-hidden="true" />

          {/* Minimalistic artistic SVG flames */}
          <svg
            className={styles.flameSvgArt}
            viewBox="0 0 500 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="flameGradAmber" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ff3d00" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#ff9100" stopOpacity="0.95" />
                <stop offset="80%" stopColor="#ffea00" stopOpacity="0.98" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="flameGradCyan" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#0077b6" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#00b4d8" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#90e0ef" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="flameGradWarm" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d00000" stopOpacity="0.35" />
                <stop offset="45%" stopColor="#ff5400" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#ffbd00" stopOpacity="0.95" />
              </linearGradient>
              <filter id="flameGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              d="M 250,560 C 130,500 70,370 110,260 C 135,190 185,160 205,90 C 230,150 265,185 275,235 C 295,185 345,145 355,65 C 400,165 435,255 415,355 C 395,465 340,540 250,560 Z"
              stroke="url(#flameGradCyan)"
              strokeWidth="2.5"
              fill="none"
              opacity="0.55"
            />
            <path
              d="M 250,540 C 175,480 135,385 165,285 C 185,215 225,185 245,85 C 270,175 315,225 325,305 C 340,385 310,480 250,540 Z"
              stroke="url(#flameGradWarm)"
              strokeWidth="2.8"
              fill="none"
              filter="url(#flameGlow)"
              opacity="0.8"
            />
            <path
              d="M 250,510 C 205,455 185,375 210,295 C 225,240 245,185 250,135 C 260,195 290,255 290,325 C 290,405 270,465 250,510 Z"
              stroke="url(#flameGradAmber)"
              strokeWidth="3.2"
              fill="none"
              filter="url(#flameGlow)"
              opacity="0.95"
            />
            <circle cx="205" cy="80" r="3.5" fill="#ffea00" filter="url(#flameGlow)" />
            <circle cx="360" cy="55" r="3" fill="#ffbd00" opacity="0.85" />
            <circle cx="250" cy="115" r="4" fill="#ffffff" filter="url(#flameGlow)" />
            <circle cx="145" cy="210" r="2.5" fill="#00e5ff" opacity="0.7" />
            <circle cx="380" cy="235" r="3" fill="#ff9100" opacity="0.8" />
          </svg>

          {/* Slightly Rotated Phone Mockup */}
          <div className={styles.ussdPhoneCard}>
            <Image
              src="/ussd.png"
              alt="HURIZA *700# USSD mobile keypad mockup"
              width={1254}
              height={1254}
              sizes="(max-width: 760px) 100vw, (max-width: 1020px) 45vw, 420px"
              priority={false}
            />
          </div>

          {/* Floating Badges */}
          <div className={styles.flameTopBadge}>
            <Flame size={15} aria-hidden="true" />
            <span>{t.ussd.badgeFlame}</span>
          </div>

          <div className={styles.flameBottomBadge}>
            <span className={styles.livePulseDot} aria-hidden="true" />
            <span>*700# · {t.ussd.badgeOffline}</span>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.fundraisingSection} id="fundraising" aria-labelledby="fundraising-title">
      {/* Ambient atmospheric glows spanning the full section width */}
      <div className={styles.fundraisingGlowOrb} aria-hidden="true" />
      <div className={styles.fundraisingGlowOrbLeft} aria-hidden="true" />

      <div className={styles.fundraisingContainer}>
        {/* Visual column: Kigali cityscape artwork with overlay badges */}
        <div className={styles.fundraisingVisual}>
          <div className={styles.kigaliImageContainer}>
            <Image
              src="/kigali.webp"
              alt="Scenic view of Kigali, Rwanda, symbolizing safe community fundraising and transparency"
              width={1672}
              height={941}
              sizes="(max-width: 760px) 100vw, (max-width: 1020px) 90vw, 560px"
              className={styles.kigaliImage}
              priority={false}
            />
            <div className={styles.kigaliGradientOverlay} aria-hidden="true" />

            {/* Top Floating Badge */}
            <div className={styles.kigaliTopBadge}>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>{t.fundraisingShowcase.badgeEscrow}</span>
            </div>

            {/* Bottom Floating Stats Card */}
            <div className={styles.kigaliStatCard}>
              <div className={styles.kigaliStatLeft}>
                <span className={styles.kigaliLiveDot} aria-hidden="true" />
                <div>
                  <strong>{t.fundraisingShowcase.badgeTransparency}</strong>
                  <small>{t.fundraisingShowcase.badgeLocation}</small>
                </div>
              </div>
              <div className={styles.kigaliStatRight}>
                <BadgeCheck size={16} aria-hidden="true" />
                <span>{t.fundraisingShowcase.badgeMomo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy column: Safety reassurance, trust pillars, and high-conversion CTAs */}
        <div className={styles.fundraisingCopy}>
          <span className={styles.fundraisingEyebrow}>
            <Sparkles size={14} aria-hidden="true" />
            {t.fundraisingShowcase.eyebrow}
          </span>
          <h2 id="fundraising-title" className={styles.fundraisingTitle}>
            <span>{t.fundraisingShowcase.titleLine1}</span>
            <span className={styles.fundraisingTitleAlight}>
              {t.fundraisingShowcase.titleLine2}
            </span>
          </h2>
          <p className={styles.fundraisingLead}>
            {t.fundraisingShowcase.subtitle}
          </p>

          <div className={styles.fundraisingPillars}>
            <div className={styles.fundraisingPillarItem}>
              <span className={styles.fundraisingPillarIcon}>
                <ShieldCheck size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>{t.fundraisingShowcase.pillars.escrow.title}</strong>
                <p>{t.fundraisingShowcase.pillars.escrow.desc}</p>
              </div>
            </div>

            <div className={styles.fundraisingPillarItem}>
              <span className={styles.fundraisingPillarIcon}>
                <Coins size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>{t.fundraisingShowcase.pillars.organizers.title}</strong>
                <p>{t.fundraisingShowcase.pillars.organizers.desc}</p>
              </div>
            </div>

            <div className={styles.fundraisingPillarItem}>
              <span className={styles.fundraisingPillarIcon}>
                <Sparkles size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>{t.fundraisingShowcase.pillars.guardian.title}</strong>
                <p>{t.fundraisingShowcase.pillars.guardian.desc}</p>
              </div>
            </div>
          </div>

          <div className={styles.fundraisingActions}>
            <Link href="/signup?workspace=fundraising" className={styles.fundraisingPrimaryCta}>
              <span>{t.fundraisingShowcase.ctaPrimary}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/fund" className={styles.fundraisingSecondaryCta}>
              <span>{t.fundraisingShowcase.ctaSecondary}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.fundraisingGuarantee}>
            <LockKeyhole size={14} aria-hidden="true" />
            <span>{t.fundraisingShowcase.guaranteePill}</span>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.closingSection} aria-labelledby="closing-title">
      <div className={styles.closingCard}>
        <div className={styles.closingCopy}>
          <span className={styles.closingEyebrow}>{t.closing.eyebrow}</span>
          <h2 id="closing-title" style={{ whiteSpace: 'pre-line' }}>{t.closing.title}</h2>
          <p>{t.closing.copy}</p>
          <div className={styles.closingActions}>
            <Link href="/signup" className={styles.closingButton}>{t.closing.getStarted} <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/demo" className={styles.closingDemo}>{t.closing.exploreDemo} <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
        <div className={styles.closingPhoto}><Image src="/smile.webp" alt="A smiling woman using her phone" fill sizes="(max-width: 760px) 100vw, 45vw" /></div>
      </div>
    </section>

    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.brand}><BrandLogo size={32} /><strong>HURIZA</strong></Link>
          <p style={{ whiteSpace: 'pre-line' }}>{t.footer.tagline}</p>
          <small>{t.footer.subline}</small>
        </div>
        <div className={styles.footerColumn}>
          <b>{t.footer.workspaces}</b>
          {workspaceKeys.map((key) => <Link href={`/signup?workspace=${key}`} key={key}>{t.solutions.workspaces[key].title}</Link>)}
        </div>
        <div className={styles.footerColumn}>
          <b>{t.footer.explore}</b>
          <Link href="/demo#guardian">{t.footer.guardianLink}</Link>
          <Link href="/demo">{t.footer.productDemo}</Link>
          <a href="#fundraising">{t.footer.fundraisingLink}</a>
        </div>
        <div className={styles.footerColumn}>
          <b>{t.footer.company}</b>
          <Link href="/about">{t.footer.about}</Link>
          <Link href="/contact">{t.footer.contact}</Link>
          <Link href="/privacy">{t.footer.privacy}</Link>
          <Link href="/terms">{t.footer.terms}</Link>
          <Link href="/login">{t.footer.signIn}</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} HURIZA</span>
        <span>{t.footer.disclaimer}</span>
        <Link href="/methodology">{t.footer.methodology}</Link>
      </div>
    </footer>
  </main>;
}
