'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  Coins,
  Cpu,
  FileSpreadsheet,
  Globe,
  HandCoins,
  HeartHandshake,
  Landmark,
  Layers,
  Leaf,
  Lock,
  LockKeyhole,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import LanguageToggle from '@/components/language-toggle';
import BrandLogo from '@/components/brand-logo';
import styles from './about.module.css';

type PillarCategory = 'all' | 'groups' | 'personal' | 'cooperative' | 'fund' | 'guardian' | 'access';

interface EpicCardItem {
  id: string;
  category: PillarCategory;
  categoryLabelEn: string;
  categoryLabelRw: string;
  titleEn: string;
  titleRw: string;
  descEn: string;
  descRw: string;
  photoSrc: string;
  photoAlt: string;
  floatingStatEn: string;
  floatingStatRw: string;
  icon: typeof Users;
  chipsEn: string[];
  chipsRw: string[];
  actionLabelEn: string;
  actionLabelRw: string;
  actionHref: string;
}

const EPIC_CARDS: EpicCardItem[] = [
  {
    id: 'groups',
    category: 'groups',
    categoryLabelEn: 'Community Savings',
    categoryLabelRw: 'Ubwizigame Rusange',
    titleEn: 'Dual Savings Engine: Itsinda & Ikimina',
    titleRw: 'Gahunda Ebyiri z’Ubwizigame: Itsinda n’Ikimina',
    descEn:
      'Purpose-built accounting models honoring Rwandan grassroots traditions. Itsinda manages accumulating cycles with dividend distribution and loan interest sharing. Ikimina orchestrates scheduled rotational rounds with multi-signature recipient authorization.',
    descRw:
      'Uburyo bw’ibarura bwubakiye ku muco n’imibereho y’abanyarwanda. Itsinda rigenga ubwizigame bwiyongera n’inyungu zigabanywa ku mpera z’icyiciro. Ikimina gicunga imisanzu izenguruka ihererekanywa kuri buri munyamuryango utahiwe mu mucyo usesuye.',
    photoSrc: '/images/community-cooperative-rwanda.webp',
    photoAlt: 'Rwandan community savings group gathering outdoors with financial ledger books',
    floatingStatEn: 'Dual-Model Logic',
    floatingStatRw: 'Uburyo Bubiri',
    icon: Users,
    chipsEn: ['Accumulating Itsinda', 'Rotating Ikimina', 'Multi-signature Payouts', 'Zero Cashbox Loss'],
    chipsRw: ['Itsinda ryiyongera', 'Ikimina kizenguruka', 'Ubwishyu bwemezwa na benshi', 'Nta bujura bwa sanduku'],
    actionLabelEn: 'Explore Savings Groups Demo',
    actionLabelRw: 'Reba igerageza ry’amatsinda',
    actionHref: '/demo?workspace=groups',
  },
  {
    id: 'personal',
    category: 'personal',
    categoryLabelEn: 'Household & Individual',
    categoryLabelRw: 'Imari Bwite n’Urugo',
    titleEn: 'Target-Based Goal Vaults & Family Budgeting',
    titleRw: 'Intego Bwite z’Imari n’Umutekano w’Urugo',
    descEn:
      'Tailored for Rwandan families planning for Mutuelle de Santé, school fees, agricultural inputs, or unexpected emergencies. Isolated tenant accounts ensure complete privacy, with optional private Google Sheets sync for sovereign ownership.',
    descRw:
      'Igenewe imiryango yitegura kwishyura Mutuelle de Santé, amafaranga y’ishuri, inyongeramusaruro cyangwa ibyago bitunguranye. Konti bwite zirinzwe kandi ziteganyirizwa kubika no gusangiza amakuru muri Google Sheets ku buryo bwigenga.',
    photoSrc: '/cel.webp',
    photoAlt: 'Smiling Rwandan man using his phone for personal savings',
    floatingStatEn: 'Sovereign Vaults',
    floatingStatRw: 'Intego Zirinzwe',
    icon: WalletCards,
    chipsEn: ['Mutuelle & School Goals', 'Paced Velocity', 'Private Google Sheets', 'Zero Cross-Leakage'],
    chipsRw: ['Mutuelle n’ishuri', 'Iteganyamari ryihuta', 'Guhuza na Google Sheets', 'Umutekano usesuye'],
    actionLabelEn: 'Start Personal Workspace',
    actionLabelRw: 'Tangira konti bwite',
    actionHref: '/signup?workspace=personal',
  },
  {
    id: 'cooperative',
    category: 'cooperative',
    categoryLabelEn: 'Enterprise & Farming',
    categoryLabelRw: 'Koperative n’Ubuhinzi',
    titleEn: 'Cooperative Value Engine & Digital Twin Assets',
    titleRw: 'Imicungire y’Amakoperative n’Umutungo Rusange',
    descEn:
      'Empowering agricultural and artisan cooperatives with 3-step expense approvals, bylaw allocation policies, harvest yield tracking, member share capital ledgers, and democratic ballot voting. Every member sees their equity share clearly.',
    descRw:
      'Gufasha amakoperative y’ubuhinzi, ubworozi n’ubukorikori gukurikirana ibyakiriwe n’ibyagurishijwe, imisanzu y’imigabane, gahunda y’ibyemezo n’amatora ya kidemokarasi, no kwemeza amafaranga asohoka mu ntambwe eshatu zizewe.',
    photoSrc: '/land.webp',
    photoAlt: 'Rwanda rolling hills and cooperative farmland',
    floatingStatEn: 'Bylaw Compliance',
    floatingStatRw: 'Icyemezo Cyubahirije Amategeko',
    icon: Landmark,
    chipsEn: ['3-Step Expense Flow', 'Member Share Capital', 'Democratic Ballots', 'Harvest Yield Tracking'],
    chipsRw: ['Kwemeza mu ntambwe 3', 'Imigabane y’abanyamuryango', 'Amatora ya kidemokarasi', 'Raporo z’umusaruro'],
    actionLabelEn: 'View Cooperative Workspace',
    actionLabelRw: 'Reba umwanya wa koperative',
    actionHref: '/demo?workspace=cooperative',
  },
  {
    id: 'fund',
    category: 'fund',
    categoryLabelEn: 'Community Crowdfunding',
    categoryLabelRw: 'Gukusanya Inkunga',
    titleEn: 'HURIZA Fund: Causes, Moments & Community Impact',
    titleRw: 'HURIZA Fund: Gukusanya Inkunga mu Mucyo',
    descEn:
      'Transparent crowdfunding engineered for community celebrations and emergencies. Milestone-locked escrow ensures contributed funds are only disbursed after verified progress receipts, eliminating fraud and building radical donor trust.',
    descRw:
      'Gukusanya inkunga z’ubukwe, amasabukuru, ibyago cyangwa imishinga y’abaturage. Amafaranga arindwa mu kigega gicungwa neza kugeza igihe ibikorwa byemejwe, bigatuma abaterankunga bose bagira icyizere cyuzuye.',
    photoSrc: '/smile.webp',
    photoAlt: 'Smiling Rwandan woman celebrating community support on mobile device',
    floatingStatEn: 'TrustFlow Verified',
    floatingStatRw: 'Umutekano Wizewe',
    icon: HeartHandshake,
    chipsEn: ['Milestone Escrow', 'Public Donor Receipts', 'Zero Fraud Tolerance', 'Social Updates Feed'],
    chipsRw: ['Ikigega cyizewe', 'Inyemezabwishyu ku bose', 'Nta buriganya na buke', 'Amakuru mashya y’umushinga'],
    actionLabelEn: 'Discover Active Campaigns',
    actionLabelRw: 'Reba imishinga iri gukusanyirizwa inkunga',
    actionHref: '/fund',
  },
  {
    id: 'guardian',
    category: 'guardian',
    categoryLabelEn: 'Deterministic AI & Risk',
    categoryLabelRw: 'Ubugenzuzi bw’Imari',
    titleEn: 'Guardian: Safe Liquidity & Reserve Stress-Testing',
    titleRw: 'Guardian: Isuzuma ry’Ububiko n’Umutekano w’Imari',
    descEn:
      'Deterministic financial intelligence with zero artificial hallucinations. Guardian assesses reserve basis points, repayment cycles, and post-loan liquidity before loans are granted. It never approves loans autonomously, keeping human leaders fully in control.',
    descRw:
      'Ibarura nyakuri ridashingiye ku bimenyetso by’ibihimbano cyangwa ubwenge bwa mudasobwa bwiyemeza. Guardian isuzuma ikigega kizigamwe n’amafaranga asigara mbere y’uko inguzanyo itangwa, igasigira abayobozi b’amatsinda ububasha busesuye bwo gufata umwanzuro.',
    photoSrc: '/kigali.webp',
    photoAlt: 'Modern Kigali skyline representing financial infrastructure and economic vision',
    floatingStatEn: '100% Deterministic',
    floatingStatRw: 'Ibarura Ridahinguka',
    icon: ShieldCheck,
    chipsEn: ['Reserve BPS Guard', 'Delinquency Modeling', 'Liquidity Thresholds', 'Human-in-the-Loop'],
    chipsRw: ['Ikigega ntarengwa', 'Gukumira ibirarane', 'Ibarura ry’amafaranga asigaye', 'Ibyemezo bifatwa n’abantu'],
    actionLabelEn: 'Test Guardian Risk Engine',
    actionLabelRw: 'Gerageza ubugenzuzi bwa Guardian',
    actionHref: '/demo#guardian',
  },
  {
    id: 'access',
    category: 'access',
    categoryLabelEn: 'Universal Inclusion',
    categoryLabelRw: 'Kugera Kuri Bose',
    titleEn: 'Inclusive Reach: *700# USSD & Offline-First Sync',
    titleRw: 'Kugera Kuri Bose: USSD *700# n’Uburyo Butagira Interineti',
    descEn:
      'No smartphone? No internet? No problem. HURIZA’s dual-channel architecture enables members to contribute, inspect balances, and vote on basic feature phones via USSD *700# with instant Mobile Money integration, backed by offline PWA synchronization.',
    descRw:
      'Nta telefone igezweho ufite? Nta interineti? Nta kibazo na gito. Abanyamuryango bashobora gutanga imisanzu, kureba ubwizigame no gutora bakoresheje telefone isanzwe binyuze kuri kode ya USSD *700# na MTN MoMo / Airtel Money.',
    photoSrc: '/por.webp',
    photoAlt: 'Rwandan community members using mobile phone in rural setting',
    floatingStatEn: 'Zero Tech Barrier',
    floatingStatRw: 'Kuri Telefone Yose',
    icon: Smartphone,
    chipsEn: ['Works on Any Phone', 'MoMo & Airtel Money', 'PWA Offline Sync', 'Bilingual Kinyarwanda'],
    chipsRw: ['Kuri telefone zose', 'MoMo na Airtel Money', 'Gukora nta interineti', 'Ikinyarwanda n’Icyongereza'],
    actionLabelEn: 'Try Interactive USSD Simulator',
    actionLabelRw: 'Gerageza USSD muri brawuza',
    actionHref: '/app/simulator',
  },
];

export default function AboutClient() {
  const { t, isKinyarwanda } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<PillarCategory>('all');
  const [simLoanAmount, setSimLoanAmount] = useState<number>(2_500_000);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Filter cards
  const filteredCards =
    activeCategory === 'all'
      ? EPIC_CARDS
      : EPIC_CARDS.filter((card) => card.category === activeCategory);

  // Guardian Mini-Simulator Math:
  // Base Treasury: 5,000,000 RWF
  // Reserve ratio: 20% (1,000,000 RWF)
  const totalTreasury = 5_000_000;
  const reserveAmount = 1_000_000; // 20% required reserve
  const remainingCash = totalTreasury - simLoanAmount;
  const isHealthy = remainingCash >= reserveAmount + 500_000;
  const isWarning = remainingCash >= reserveAmount && remainingCash < reserveAmount + 500_000;
  const isCritical = remainingCash < reserveAmount;

  const formatRwf = (amt: number) => {
    return `${new Intl.NumberFormat(isKinyarwanda ? 'rw-RW' : 'en-RW').format(amt)} RWF`;
  };

  const categories: { key: PillarCategory; labelEn: string; labelRw: string; count: number }[] = [
    { key: 'all', labelEn: 'All Pillars', labelRw: 'Byose Hamwe', count: EPIC_CARDS.length },
    { key: 'groups', labelEn: 'Savings Groups', labelRw: 'Amatsinda', count: 1 },
    { key: 'personal', labelEn: 'Household Vaults', labelRw: 'Imari Bwite', count: 1 },
    { key: 'cooperative', labelEn: 'Cooperatives', labelRw: 'Amakoperative', count: 1 },
    { key: 'fund', labelEn: 'Community Fund', labelRw: 'Gukusanya Inkunga', count: 1 },
    { key: 'guardian', labelEn: 'Guardian & Risk', labelRw: 'Umutekano w’Imari', count: 1 },
    { key: 'access', labelEn: 'USSD & Inclusion', labelRw: 'Kugera Kuri Bose', count: 1 },
  ];

  const faqs = [
    {
      qEn: 'Is HURIZA a bank or commercial credit lender?',
      qRw: 'Ese HURIZA ni banki cyangwa ikigo gitanga inguzanyo?',
      aEn:
        'No. HURIZA is an infrastructure software workspace designed to give individuals, community savings groups (Itsinda & Ikimina), and cooperatives sovereign, auditable management over their own collective funds. HURIZA never holds custody of deposits or lends money autonomously.',
      aRw:
        'Oya. HURIZA ni urubuga rw’ikoranabuhanga rufasha abantu ku giti cyabo, amatsinda yo kuzigama (Itsinda n’Ikimina) n’amakoperative gucunga amafaranga yabo bwite mu mucyo n’umutekano. HURIZA ntabwo ari banki kandi ntitanga inguzanyo ku giti cyayo.',
    },
    {
      qEn: 'What is the mathematical difference between Itsinda and Ikimina?',
      qRw: 'Itandukaniro ry’ibarura hagati y’Itsinda n’Ikimina ni irihe?',
      aEn:
        'Itsinda operates an accumulating cycle: members save periodic shares, internal loans generate interest, and the entire treasury (principal plus accumulated interest) is divided among members at the cycle shareout date. Ikimina operates rotational rounds: every member contributes a fixed amount per round, and the lump sum rotates to a scheduled recipient until the cycle completes.',
      aRw:
        'Itsinda rikora mu buryo bw’ubwizigame bwiyongera: abanyamuryango bagura imigabane, inguzanyo z’imbere zigatanga inyungu, maze ku mpera z’icyiciro ubwizigame n’inyungu bikagabanwa abanyamuryango bose. Ikimina cyo gikora mu buryo bwo guhererekanya: buri nshuro abanyamuryango bose batanga umusanzu ukajya ku munyamuryango utahiwe kugeza bose bagezweho.',
    },
    {
      qEn: 'How does Guardian protect community reserves from insolvency?',
      qRw: 'Guardian irinda ite ikigega cy’itsinda guhura n’igihombo cyangwa kubura amafaranga?',
      aEn:
        'Guardian runs pure, deterministic arithmetic across the group’s liquid cash, mandatory reserve basis points (e.g. 20%), expected repayments, and pending obligations. If a proposed loan breaches safety boundaries, Guardian highlights the shortfall and suggests a safe loan ceiling. It never makes autonomous lending decisions.',
      aRw:
        'Guardian ikoresha imibare ifatika y’ikigega kizigamwe, amafaranga y’ubwizigame n’imisanzu iteganyijwe. Iyo inguzanyo isabwe irenze ubushobozi bw’ikigega, Guardian igaragaza impamvu n’amafaranga ntarengwa yakwirinda igihombo, igasigira abanyamuryango ububasha bwo gufata umwanzuro.',
    },
    {
      qEn: 'Can community members without internet access use HURIZA?',
      qRw: 'Ese umunyamuryango udafite interineti ashobora gukoresha HURIZA?',
      aEn:
        'Yes! HURIZA includes an interactive USSD shortcode (*700#) protocol and offline Progressive Web App (PWA) capabilities. Rural members can deposit, inspect ledger balances, and confirm authorizations using simple feature phones with Mobile Money integration.',
      aRw:
        'Yego rwose! HURIZA yateganyije kode ya USSD (*700#) na tekinoloji ya PWA ikorana na telefone zose. Abanyamuryango badafite interineti bashobora kubitsa, kureba amakuru yabo no kwemeza imyanzuro bakoresheje telefone isanzwe binyuze kuri MoMo.',
    },
  ];

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        {t.common.skipToContent}
      </a>

      {/* Primary Sticky Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="HURIZA home">
          <BrandLogo size={36} priority />
          <div className={styles.brandText}>
            <span>HURIZA</span>
            <span className={styles.brandTagline}>
              {isKinyarwanda ? 'Umucyo mu Mari' : 'Financial Clarity'}
            </span>
          </div>
        </Link>

        <div className={styles.headerActions}>
          <LanguageToggle />
          <nav className={styles.navLinks} aria-label="Main navigation">
            <Link href="/">{t.nav.home}</Link>
            <Link href="/about" className={styles.activeNav}>
              {isKinyarwanda ? 'Abo turibo' : 'About'}
            </Link>
            <Link href="/fund">{isKinyarwanda ? 'Gukusanya Inkunga' : 'HURIZA Fund'}</Link>
            <Link href="/demo">{t.nav.demo}</Link>
            <Link href="/contact">{t.nav.contact}</Link>
            <Link href="/signup" className={styles.navCta}>
              {t.common.signUp} <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Page Body */}
      <main id="main-content" className={styles.main}>
        {/* Breadcrumb Trail */}
        <div className={styles.breadcrumb}>
          <Link href="/">
            <ArrowLeft size={13} /> {isKinyarwanda ? 'Ahabanza' : 'Home'}
          </Link>
          <span>/</span>
          <span>{isKinyarwanda ? 'Abo turibo' : 'About Us'}</span>
        </div>

        {/* EPIC HERO SECTION */}
        <section className={styles.heroSection}>
          <div className={styles.heroGlowOrb1} aria-hidden="true" />
          <div className={styles.heroGlowOrb2} aria-hidden="true" />

          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <div className={styles.heroBadge}>
                <span className={styles.pulseDot} aria-hidden="true" />
                {isKinyarwanda
                  ? 'Urubuga rw’Imari Nyarwanda · Rwandan Financial Ecosystem'
                  : 'Rwandan Financial Ecosystem · Vision 2050'}
              </div>

              <h1 className={styles.heroTitle}>
                {isKinyarwanda ? (
                  <>
                    Umucyo, Umutekano n’Ikoranabuhanga mu{' '}
                    <span className={styles.heroTitleGradient}>Mari Rusange y’Urwanda</span>.
                  </>
                ) : (
                  <>
                    Radical Clarity and Mathematical Integrity for{' '}
                    <span className={styles.heroTitleGradient}>Rwandan Community Finance</span>.
                  </>
                )}
              </h1>

              <p className={styles.heroSubtitle}>
                {isKinyarwanda
                  ? 'HURIZA ihuza intego z’umuryango ku giti cyawo, amatsinda yo kuzigama (Itsinda n’Ikimina), amakoperative y’abahinzi n’aborozi, n’ibikorwa byo gukusanya inkunga mu buryo bwizewe kandi bukorera kuri telefone zose.'
                  : 'HURIZA unifies personal household vaults, grassroots savings groups (Itsinda & Ikimina), agricultural cooperatives, and verified community fundraising into one deterministic, tamper-proof financial operating system.'}
              </p>

              <div className={styles.heroCtaGroup}>
                <Link href="/demo" className={styles.heroPrimaryBtn}>
                  <Sparkles size={16} />
                  {isKinyarwanda ? 'Reba igerageza ry’urubuga' : 'Explore Interactive Demo'}
                </Link>
                <Link href="/signup" className={styles.heroSecondaryBtn}>
                  {isKinyarwanda ? 'Fungura konti ku buntu' : 'Create Free Account'}
                  <ArrowRight size={15} />
                </Link>
              </div>

              {/* Quick Metrics Strip */}
              <div className={styles.heroMetricsStrip}>
                <div className={styles.metricItem}>
                  <strong>5</strong>
                  <span>{isKinyarwanda ? 'Imyanya y’imari yihariye' : 'Dedicated Workspaces'}</span>
                </div>
                <div className={styles.metricItem}>
                  <strong>100%</strong>
                  <span>{isKinyarwanda ? 'Ibarura ridahinguka' : 'Deterministic Math'}</span>
                </div>
                <div className={styles.metricItem}>
                  <strong>Dual</strong>
                  <span>{isKinyarwanda ? 'Itsinda & Ikimina Models' : 'Accumulating & Rotating'}</span>
                </div>
                <div className={styles.metricItem}>
                  <strong>Safe RWF</strong>
                  <span>{isKinyarwanda ? 'Nta makosa y’igiceri' : 'Zero Floating Point Error'}</span>
                </div>
              </div>
            </div>

            {/* Hero Showcase Photo & Floating Pills */}
            <div className={styles.heroShowcase}>
              {/* Floating Glassmorphic Tags */}
              <div className={styles.floatingTagTop}>
                <ShieldCheck size={16} color="#60a5fa" />
                <span>{isKinyarwanda ? 'Ikigega Cyizewe · 20% Reserve Guard' : '20% Reserve BPS Guard'}</span>
              </div>

              <div className={styles.heroImageFrame}>
                <Image
                  src="/images/community-cooperative-rwanda.webp"
                  alt="Rwandan cooperative members meeting together outdoors to review collective savings"
                  fill
                  sizes="(max-width: 768px) 100vw, 45vw"
                  priority
                  className={styles.heroPhoto}
                />
                <div className={styles.heroImageOverlay} />
                <div className={styles.photoCaptionPill}>
                  <Users size={16} />
                  <span>
                    {isKinyarwanda
                      ? 'Abanyamuryango b’itsinda mu nama y’ubwizigame no gusaranganya inyungu.'
                      : 'Authentic community savings group reviewing member ledgers in Rwanda.'}
                  </span>
                </div>
              </div>

              <div className={styles.floatingTagBottom}>
                <Smartphone size={16} color="#f59e0b" />
                <span>{isKinyarwanda ? 'Kode ya USSD *700# Native' : '*700# USSD & MoMo Native'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: PILLARS & AMAZING EPIC CARDS */}
        <section className={styles.pillarsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>
              <Layers size={13} />
              {isKinyarwanda ? 'Inkingi z’Urubuga' : 'Core Architecture & Workspaces'}
            </span>
            <h2 className={styles.sectionTitle}>
              {isKinyarwanda
                ? 'Imyanya Itanu y’Imari Ihuje Buri Cyiciro cy’Ubuzima'
                : 'Engineered for Every Stage of Rwandan Economic Life'}
            </h2>
            <p className={styles.sectionDesc}>
              {isKinyarwanda
                ? 'Kuva ku muryango usanzwe uzigamira amashuri kugeza kuri koperative nini y’ikawa, reba uko amakarita yacu yihariye agufasha kubigeraho mu mucyo usesuye.'
                : 'From a smallholder farmer preparing for Mutuelle de Santé to a nationwide coffee cooperative and emergency fundraising causes — explore our epic purpose-built workspaces.'}
            </p>
          </div>

          {/* Interactive Filter Pills */}
          <div className={styles.filterTabs} role="tablist" aria-label="Workspaces filter">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`${styles.filterBtn} ${activeCategory === cat.key ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                <span>{isKinyarwanda ? cat.labelRw : cat.labelEn}</span>
                <span className={styles.filterCount}>{cat.count}</span>
              </button>
            ))}
          </div>

          {/* AMAZING EPIC CARDS GRID */}
          <div className={styles.epicCardsGrid}>
            {filteredCards.map((card) => {
              const IconComponent = card.icon;
              return (
                <article key={card.id} className={styles.epicCard}>
                  {/* Card Photo Header */}
                  <div className={styles.cardPhotoFrame}>
                    <Image
                      src={card.photoSrc}
                      alt={card.photoAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1040px) 50vw, 33vw"
                      className={card.photoSrc.includes('land.webp') ? styles.cardPhoto : styles.cardPhoto}
                    />
                    <div className={styles.cardPhotoOverlay} />
                    <span className={styles.cardCategoryBadge}>
                      {isKinyarwanda ? card.categoryLabelRw : card.categoryLabelEn}
                    </span>
                    <span className={styles.cardFloatingStat}>
                      {isKinyarwanda ? card.floatingStatRw : card.floatingStatEn}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className={styles.cardBody}>
                    <div className={styles.cardIconTitleRow}>
                      <div className={styles.cardIconWrap}>
                        <IconComponent size={20} />
                      </div>
                      <h3 className={styles.cardTitle}>
                        {isKinyarwanda ? card.titleRw : card.titleEn}
                      </h3>
                    </div>

                    <p className={styles.cardDesc}>
                      {isKinyarwanda ? card.descRw : card.descEn}
                    </p>

                    {/* Feature Chips */}
                    <div className={styles.cardChipsList}>
                      {(isKinyarwanda ? card.chipsRw : card.chipsEn).map((chip, idx) => (
                        <span key={idx} className={styles.cardChip}>
                          <CheckCircle2 size={11} />
                          {chip}
                        </span>
                      ))}
                    </div>

                    {/* Footer Action */}
                    <div className={styles.cardFooter}>
                      <Link href={card.actionHref} className={styles.cardActionLink}>
                        {isKinyarwanda ? card.actionLabelRw : card.actionLabelEn}
                        <ArrowRight size={14} />
                      </Link>
                      <span className={styles.cardActionBadge}>
                        {isKinyarwanda ? 'Konti Zirinzwe' : 'Verified'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* LIVE INTERACTIVE GUARDIAN RISK SIMULATOR */}
        <section className={styles.simulatorBanner}>
          <div className={styles.simLayout}>
            <div className={styles.simIntro}>
              <span className={styles.sectionEyebrow} style={{ background: 'rgba(255,255,255,0.1)', color: '#93c5fd', borderColor: 'rgba(255,255,255,0.18)' }}>
                <Cpu size={13} />
                {isKinyarwanda ? 'Igerageza ry’Umutekano ry’Ako Kanya' : 'Live Risk Intelligence'}
              </span>
              <h3>
                {isKinyarwanda
                  ? 'Isuzumiro rya Guardian: Suzuma Ubushobozi bw’Ikigega mbere yo Gutanga Inguzanyo'
                  : 'Guardian Simulator: Test Treasury Solvency Before Releasing Funds'}
              </h3>
              <p>
                {isKinyarwanda
                  ? 'Hindura amafaranga y’inguzanyo ifuzwa urebe uko ikigega kigabanuka, n’uko uburyo bwacu buburira abayobozi mu gihe ikigega kirinzwe cya 20% cyaba cyegerewe.'
                  : 'Adjust the loan request below. Watch how Guardian evaluates the 20% statutory reserve threshold, preventing over-leveraging and ensuring no community member faces unexpected insolvency.'}
              </p>

              {/* Slider Control */}
              <div className={styles.simSliderBox}>
                <div className={styles.simSliderHeader}>
                  <span className={styles.simSliderLabel}>
                    {isKinyarwanda ? 'Amafaranga y’Inguzanyo Isabwe:' : 'Proposed Loan Request:'}
                  </span>
                  <span className={styles.simSliderValue}>{formatRwf(simLoanAmount)}</span>
                </div>
                <input
                  type="range"
                  min="500000"
                  max="4800000"
                  step="100000"
                  value={simLoanAmount}
                  onChange={(e) => setSimLoanAmount(Number(e.target.value))}
                  className={styles.simRangeInput}
                  aria-label="Loan amount slider"
                />
                <div className={styles.simRangeTicks}>
                  <span>500,000 RWF</span>
                  <span>2,500,000 RWF</span>
                  <span>4,800,000 RWF</span>
                </div>
              </div>
            </div>

            {/* Dynamic Result Card */}
            <div className={styles.simResultCard}>
              <div className={styles.simStatusHeader}>
                <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
                  {isKinyarwanda ? 'Ikigega Rusange: 5,000,000 RWF' : 'Group Treasury: 5,000,000 RWF'}
                </span>
                <span
                  className={`${styles.simStatusPill} ${
                    isHealthy
                      ? styles.statusHealthy
                      : isWarning
                      ? styles.statusWarning
                      : styles.statusCritical
                  }`}
                >
                  {isHealthy && <CheckCircle2 size={13} />}
                  {isWarning && <Zap size={13} />}
                  {isCritical && <ShieldAlert size={13} />}
                  {isHealthy
                    ? isKinyarwanda
                      ? 'Umutekano Usesuye'
                      : 'Safe & Liquid'
                    : isWarning
                    ? isKinyarwanda
                      ? 'Iteganyirize Ryegerewe'
                      : 'Near Reserve Buffer'
                    : isKinyarwanda
                    ? 'Iteganyirize Ryarenzwe'
                    : 'Critical Reserve Breach'}
                </span>
              </div>

              <div className={styles.simRows}>
                <div className={styles.simRow}>
                  <span>{isKinyarwanda ? 'Ikigega cy’Umutekano Kirinzwe (20%):' : 'Mandatory Reserve (20%):'}</span>
                  <strong>{formatRwf(reserveAmount)}</strong>
                </div>
                <div className={styles.simRow}>
                  <span>{isKinyarwanda ? 'Amafaranga Azasigara mu Kawa:' : 'Post-Loan Liquidity:'}</span>
                  <strong style={{ color: remainingCash < reserveAmount ? '#f87171' : '#38bdf8' }}>
                    {formatRwf(remainingCash)}
                  </strong>
                </div>
                <div className={styles.simRow}>
                  <span>{isKinyarwanda ? 'Inguzanyo Ntarengwa Yemewe:' : 'Max Safe Lending Limit:'}</span>
                  <strong>{formatRwf(totalTreasury - reserveAmount)}</strong>
                </div>
              </div>

              <p className={styles.simExplanationText}>
                {isHealthy
                  ? isKinyarwanda
                    ? '✓ Guardian irabyemeza: Amafaranga asigaye yikubye kenshi ikigega kirinzwe cy’ubwiteganyirize. Nta nkomyi ku bikorwa by’itsinda.'
                    : '✓ Deterministic check passed: Remaining cash safely exceeds the 20% reserve threshold. Group maintains robust liquidity buffer.'
                  : isWarning
                  ? isKinyarwanda
                    ? '⚠️ Iburira rya Guardian: Amafaranga asigaye yegereye ikigega kirinzwe. Abayobozi bagomba kwitonda mbere yo kwemeza.'
                    : '⚠️ Caution: The remaining liquidity is close to the reserve floor. Approvals require unanimous executive review.'
                  : isKinyarwanda
                  ? '⛔ Guardian iraburira: Iyi nguzanyo irenze amafaranga y’ubwiteganyirize. Birasabwa kugabanya inguzanyo ikagera munsi ya 4,000,000 RWF.'
                  : '⛔ Unsafe scenario: This loan breaches the statutory reserve requirement. The maximum safe lending capacity is 4,000,000 RWF.'}
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: HERITAGE & MODERN LEAP (PHOTO STORY SPLIT) */}
        <section className={styles.heritageSection}>
          <div className={styles.heritageGrid}>
            <div className={styles.heritageCopy}>
              <span className={styles.sectionEyebrow}>
                <Leaf size={13} />
                {isKinyarwanda ? 'Umuco n’Iterambere' : 'Tradition & Modern Engineering'}
              </span>
              <h3>
                {isKinyarwanda
                  ? 'Icyizere cy’Umuryango Nyarwanda, Giherekejwe n’Ikoranabuhanga Ridahinguka'
                  : 'Rooted in Rwandan Community Solidarity, Elevated by Cryptographic Precision'}
              </h3>
              <p>
                {isKinyarwanda
                  ? 'Umuco nyarwanda wahoze wubakiye ku gukorera hamwe: Ikimina, Itsinda, n’Umuganda. HURIZA ntije gusimbura uyu muco mwiza, ahubwo ije kuwushyigikira iwurinda ibibazo byo gutakaza amakayi, amakosa y’ibarura, cyangwa ubujura bwa sanduku z’icyuma.'
                  : 'For generations, Rwandan communities have flourished through mutual self-help: Ikimina, Itsinda, and Umuganda. HURIZA was built not to replace this rich social fabric, but to arm it with tamper-proof ledgers, transparent governance, and mathematical certainty.'}
              </p>

              <div className={styles.heritageList}>
                <div className={styles.heritageItem}>
                  <div className={styles.heritageItemIcon}>
                    <Scale size={16} />
                  </div>
                  <div className={styles.heritageItemContent}>
                    <strong>
                      {isKinyarwanda ? 'Gusimbura Sanduku z’Icyuma' : 'Beyond Physical Metal Cashboxes'}
                    </strong>
                    <span>
                      {isKinyarwanda
                        ? 'Kugabanya ibyago by’ubujura n’ibihombo binyuze mu kubika amakuru kuri mudasobwa no kwemeza ubwishyu mu mucyo.'
                        : 'Eliminating the physical theft risks and transport vulnerabilities associated with locking cash in village lockboxes.'}
                    </span>
                  </div>
                </div>

                <div className={styles.heritageItem}>
                  <div className={styles.heritageItemIcon}>
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className={styles.heritageItemContent}>
                    <strong>
                      {isKinyarwanda ? 'Kurangiza Amakosa y’Amakayi' : 'Permanent End to Paper Ledger Drift'}
                    </strong>
                    <span>
                      {isKinyarwanda
                        ? 'Buri munyamuryango abona amakuru ye kuri telefone, nta kurogoya cyangwa gutakaza inyandiko zandikishijwe ikaramu.'
                        : 'Automated double-entry ledgers ensure complete audit trails without manual calculation mistakes or lost handwritten notebooks.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dual Photo Collage */}
            <div className={styles.collageFrame}>
              <div className={styles.collageItem1}>
                <Image
                  src="/por.webp"
                  alt="Rwandan cooperative leader holding mobile phone in community setting"
                  fill
                  sizes="(max-width: 768px) 100vw, 30vw"
                  className={styles.collagePhoto}
                />
                <span className={styles.collageBadge}>
                  {isKinyarwanda ? 'Ubuyobozi bushingiye ku Mucyo' : 'Grassroots Leadership'}
                </span>
              </div>
              <div className={styles.collageItem2}>
                <Image
                  src="/smile.webp"
                  alt="Young Rwandan entrepreneur managing savings on smartphone"
                  fill
                  sizes="(max-width: 768px) 100vw, 30vw"
                  className={styles.collagePhoto}
                />
                <span className={styles.collageBadge}>
                  {isKinyarwanda ? 'Icyizere cy’Ejo Hazaza' : 'Empowered Households'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: 4 ARCHITECTURAL PILLARS (HIGH-TECH GLASS CARDS) */}
        <section className={styles.tenetsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>
              <ShieldCheck size={13} />
              {isKinyarwanda ? 'Amahame Agenga Imyubakire' : 'Our Engineering Commitments'}
            </span>
            <h2 className={styles.sectionTitle}>
              {isKinyarwanda
                ? 'Amahame Akomeye y’Ikoranabuhanga Rirambye'
                : 'Built on Uncompromising Technical Integrity'}
            </h2>
          </div>

          <div className={styles.tenetsGrid}>
            <div className={styles.tenetCard}>
              <div className={styles.tenetIcon}>
                <Coins size={22} color="#2563eb" />
              </div>
              <h4>{isKinyarwanda ? 'Ibarura rya Safe Integer RWF' : 'Safe Integer RWF Math'}</h4>
              <p>
                {isKinyarwanda
                  ? 'Nta mibare y’ibice (floating point) ikoreshwa mu ibaruramari. Buri kofaranga ry’u Rwanda ribarirwa ku kanyamuryango nta kosa na rito ryo gukata.'
                  : 'Every single ledger entry is calculated using exact safe integer RWF and BigInt intermediate arithmetic. Zero floating-point rounding drifts.'}
              </p>
            </div>

            <div className={styles.tenetCard}>
              <div className={styles.tenetIcon}>
                <LockKeyhole size={22} color="#0f243e" />
              </div>
              <h4>{isKinyarwanda ? 'Konti Zitarangwamo Kuvanga' : 'Strict Tenant Isolation'}</h4>
              <p>
                {isKinyarwanda
                  ? 'Buri muryango na koperative ifite umwanya wayo wihariye. Nta muntu ushobora kubona cyangwa guhuza amakuru y’abandi batamuhaye uburenganzira.'
                  : 'Server-side authorization guarantees that personal vaults, cooperative share capital, and group rosters remain strictly siloed and permissioned.'}
              </p>
            </div>

            <div className={styles.tenetCard}>
              <div className={styles.tenetIcon}>
                <TrendingUp size={22} color="#10b981" />
              </div>
              <h4>{isKinyarwanda ? 'Guhagarara ku Kuri kw’Amakuru' : 'Zero Invented Findings'}</h4>
              <p>
                {isKinyarwanda
                  ? 'HURIZA ntiyigera ihimba imibare cyangwa ibipimo bya NISR. Amakuru yose agaragazwa yerekana neza imbibi z’igerageza n’ibimenyetso byemewe.'
                  : 'We strictly differentiate synthetic demonstration records from official published statistics. We never invent claims or misrepresent impact.'}
              </p>
            </div>

            <div className={styles.tenetCard}>
              <div className={styles.tenetIcon}>
                <FileSpreadsheet size={22} color="#f59e0b" />
              </div>
              <h4>{isKinyarwanda ? 'Guhuza na Google Sheets' : 'Two-Way Sheets Reliability'}</h4>
              <p>
                {isKinyarwanda
                  ? 'Konti zishobora gusangiza amakuru muri Google Sheets y’umuryango mu buryo bwikora, bigatuma ububiko budashingira ku rubuga rumwe gusa.'
                  : 'Automated transactional outbox workers deliver scoped financial projections directly into user Google Sheets for offline independence.'}
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: INTERACTIVE FAQ */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>
              <Sparkles size={13} />
              {isKinyarwanda ? 'Ibibazo Bikunze Kubazwa' : 'Frequently Asked Questions'}
            </span>
            <h2 className={styles.sectionTitle}>
              {isKinyarwanda ? 'Ibisobanuro ku Bibazo By’Ingenzi' : 'Everything You Need to Know'}
            </h2>
          </div>

          <div className={styles.faqList}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}>
                  <button
                    type="button"
                    className={styles.faqTrigger}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                  >
                    <span>{isKinyarwanda ? faq.qRw : faq.qEn}</span>
                    <ChevronDown
                      size={18}
                      className={`${styles.faqChevron} ${isOpen ? styles.faqChevronOpen : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className={styles.faqContent}>
                      <p>{isKinyarwanda ? faq.aRw : faq.aEn}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* EPIC CLOSING CALL-TO-ACTION */}
        <section className={styles.closingCta}>
          <div className={styles.ctaOrb} aria-hidden="true" />
          <h2>
            {isKinyarwanda
              ? 'Tangira Urugendo rw’Umucyo mu Mari Uyu Munsi'
              : 'Step Into the Future of Rwandan Financial Clarity'}
          </h2>
          <p>
            {isKinyarwanda
              ? 'Urubuga rwacu rufunguye ku baturage bose, amatsinda yo kuzigama n’amakoperative mu Rwanda. Kwinjira mu igerageza ntibisaba kwishyura.'
              : 'Whether you want to organize your personal savings goals, manage a 30-member savings group, or lead an agricultural cooperative — HURIZA is ready.'}
          </p>

          <div className={styles.ctaActions}>
            <Link href="/signup" className={styles.ctaPrimaryBtn}>
              {isKinyarwanda ? 'Fungura konti ku buntu' : 'Get Started Free'}
              <ArrowRight size={15} />
            </Link>
            <Link href="/demo" className={styles.ctaSecondaryBtn}>
              <Sparkles size={16} />
              {isKinyarwanda ? 'Reba igerageza ry’urubuga' : 'Try the Guided Demo'}
            </Link>
            <Link href="/contact" className={styles.ctaSecondaryBtn}>
              {isKinyarwanda ? 'Vugana natwe' : 'Talk with Team'}
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      {/* RICH MODERN FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrandSection}>
            <Link href="/" className={styles.brand} aria-label="HURIZA home">
              <BrandLogo size={32} />
              <div className={styles.brandText}>
                <span>HURIZA</span>
                <span className={styles.brandTagline}>
                  {isKinyarwanda ? 'Umucyo mu Mari' : 'Financial Clarity'}
                </span>
              </div>
            </Link>
            <p>
              {isKinyarwanda
                ? 'Urubuga rw’imari rwegereye abaturage, ruhuza ubwizigame bwite, amatsinda, amakoperative n’ubugenzuzi bwa Guardian.'
                : 'A sovereign, unified financial workspace bringing radical transparency, dual savings logic, and deterministic intelligence to Rwandan communities.'}
            </p>
          </div>

          <div className={styles.footerCol}>
            <h5>{isKinyarwanda ? 'Urubuga' : 'Platform'}</h5>
            <nav className={styles.footerColNav}>
              <Link href="/">{t.nav.home}</Link>
              <Link href="/about">{isKinyarwanda ? 'Abo turibo' : 'About'}</Link>
              <Link href="/fund">{isKinyarwanda ? 'Gukusanya Inkunga' : 'HURIZA Fund'}</Link>
              <Link href="/demo">{t.nav.demo}</Link>
              <Link href="/signup">{t.common.signUp}</Link>
            </nav>
          </div>

          <div className={styles.footerCol}>
            <h5>{isKinyarwanda ? 'Amakuru n’Amategeko' : 'Transparency & Terms'}</h5>
            <nav className={styles.footerColNav}>
              <Link href="/contact">{t.nav.contact}</Link>
              <Link href="/privacy">{t.footer.privacy}</Link>
              <Link href="/terms">{t.footer.terms}</Link>
              <Link href="/methodology">{t.footer.methodology}</Link>
              <Link href="/app/simulator">{isKinyarwanda ? 'USSD Simulator' : 'USSD *700# Simulator'}</Link>
            </nav>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} HURIZA. {t.common.brandTagline}</span>
          <span>{t.common.demoDisclosure}</span>
          <Link href="/methodology">
            {t.footer.methodology} <ArrowUpRight size={12} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
