'use client';

import { useState, useMemo, useTransition } from 'react';
import type {
  NGOState,
  NGOProfile,
  NGOStaffMember,
  NGORole,
  NGOProgram,
  NGOProject,
  NGOGrant,
  NGOBudgetLine,
  NGOActivity,
  NGOExpense,
  NGOBeneficiaryCohort,
  NGOFieldVisit,
  NGOIndicator,
  NGODataQualityIssue,
  NGOReportSnapshot,
  NGODonorAccessGrant,
  NGOLinkedEntityAggregate,
  NGOImpactTraceChain,
  NGODistrictContext,
  NGOGuardianInsight,
  FinanceState,
} from '@/lib/contracts';
import {
  Activity,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  FileText,
  Plus,
  RefreshCw,
  Users,
  Landmark,
  Download,
  Lock,
  DollarSign,
  Calendar,
  ChevronRight,
  Info,
  Check,
  Smartphone,
  Filter,
  Layers,
  Wifi,
  WifiOff,
  MapPin,
  UserCheck,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Share2,
} from 'lucide-react';
import s from './ngo-impact-dashboard.module.css';

export interface NgoImpactDashboardProps {
  ngoState?: NGOState;
  legacyImpact: FinanceState['impact'];
  interventions: { id: string; title: string; createdAt?: string }[];
  act: (payload: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  money: (n: number) => string;
  isRw: boolean;
}

type TabKey =
  | 'overview'
  | 'impact_trace'
  | 'programs'
  | 'grants_budget'
  | 'groups_coops_map'
  | 'beneficiaries'
  | 'field_ops'
  | 'meal_center'
  | 'donor_reports'
  | 'team_onboarding';

const ALL_NGO_ROLES: { role: NGORole; en: string; rw: string }[] = [
  { role: 'country_director', en: 'Country Director', rw: "Umuyobozi w'Igihugu" },
  { role: 'program_director', en: 'Program Director', rw: 'Umuyobozi wa Gahunda' },
  { role: 'program_manager', en: 'Program Manager', rw: "Umuyobozi w'Imishinga" },
  { role: 'project_officer', en: 'Project Officer', rw: "Umukozi w'Umushinga" },
  { role: 'field_officer', en: 'Field Officer', rw: 'Umukozi wo mu Murima' },
  { role: 'meal_officer', en: 'MEAL Officer', rw: 'Umukozi wa MEAL / Igenzura' },
  { role: 'finance_manager', en: 'Finance Manager', rw: "Umuyobozi w'Imari" },
  { role: 'accountant', en: 'Accountant', rw: 'Umucungamari' },
  { role: 'grants_officer', en: 'Grants Officer', rw: 'Ushinzwe Inkunga' },
  { role: 'safeguarding_officer', en: 'Safeguarding Officer', rw: 'Ushinzwe Kurinda Abagenerwabikorwa' },
  { role: 'donor_viewer', en: 'Donor Viewer', rw: 'Umuterankunga (Kureba Gusa)' },
  { role: 'partner_user', en: 'Partner User', rw: 'Umufatanyabikorwa' },
  { role: 'auditor', en: 'Independent Auditor', rw: 'Umugenzuzi wigenga' },
  { role: 'super_admin', en: 'Super Admin', rw: 'Umuyobozi Mukuru' },
];

export function NgoImpactDashboard({
  ngoState,
  legacyImpact,
  interventions,
  act,
  busy,
  money,
  isRw,
}: NgoImpactDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Active Trace selection
  const [selectedTraceId, setSelectedTraceId] = useState<string>('');

  // Form toggles
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showBudgetLineForm, setShowBudgetLineForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCohortForm, setShowCohortForm] = useState(false);
  const [showIndicatorForm, setShowIndicatorForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showDonorAccessForm, setShowDonorAccessForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);

  // Filters & State
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'proposed' | 'program_reviewed' | 'finance_approved' | 'paid'>('all');
  const [indicatorLevelFilter, setIndicatorLevelFilter] = useState<string>('all');
  const [surveyMode, setSurveyMode] = useState<'synced' | 'queued_offline'>('synced');
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [wizardStep, setWizardStep] = useState<number>(1);

  // Forms inputs state
  const [interventionText, setInterventionText] = useState('');
  const [paymentRefInput, setPaymentRefInput] = useState<Record<string, string>>({});
  const [indicatorValueInput, setIndicatorValueInput] = useState<Record<string, string>>({});
  const [dqResolutionInput, setDqResolutionInput] = useState<Record<string, string>>({});

  // Defaults fallback
  const profile: NGOProfile = useMemo(() => {
    return (
      ngoState?.profile || {
        tenantId: 'demo-tenant',
        orgId: 'ngo-imizi',
        name: 'Community Growth Initiative Rwanda (CGI Rwanda)',
        ngoType: 'national_ngo',
        designation: 'National Financial Inclusion Partner',
        mission:
          'Empowering rural communities through sustainable savings groups, cooperative strengthening, and verified institutional financial resilience.',
        focusSectors: ['Financial Inclusion', 'Savings Groups', 'Cooperatives', 'Rural Livelihoods'],
        operatingDistricts: ['Gasabo', 'Kicukiro', 'Rulindo', 'Rwamagana', 'Huye'],
        contactEmail: 'impact@cgi-rwanda.org',
        contactPhone: '+250 788 310 400',
        website: 'https://cgi-rwanda.org',
        registrationRef: 'RGB/NGO/2021/0418',
        reportingPeriod: 'quarterly',
        approvalThresholdRwf: 500000,
        dataRetentionMonths: 84,
        createdAt: '2021-04-18T08:00:00Z',
      }
    );
  }, [ngoState?.profile]);

  const kpis = useMemo(() => {
    if (ngoState?.kpis) return ngoState.kpis;
    return {
      activeProgramsCount: ngoState?.programs?.length || 2,
      activeGrantsCount: ngoState?.grants?.length || 2,
      totalGrantAwardedRwf: 130000000,
      totalGrantReceivedRwf: 95000000,
      totalApprovedBudgetRwf: 110000000,
      totalCommittedExpensesRwf: 46250000,
      totalConfirmedPaidRwf: 42100000,
      remainingRestrictedBalanceRwf: 52900000,
      supportedSavingsGroupsCount: legacyImpact.groups || 80,
      supportedCooperativesCount: 12,
      enrolledBeneficiariesCount: legacyImpact.members || 2000,
      femaleBeneficiariesPct: 72,
      verifiedIndicatorsPct: 88,
      openDataQualityIssuesCount: 2,
    };
  }, [ngoState?.kpis, ngoState?.programs?.length, ngoState?.grants?.length, legacyImpact]);

  const programs: NGOProgram[] = useMemo(() => ngoState?.programs || [], [ngoState?.programs]);
  const projects: NGOProject[] = useMemo(() => ngoState?.projects || [], [ngoState?.projects]);
  const grants: NGOGrant[] = useMemo(() => ngoState?.grants || [], [ngoState?.grants]);
  const budgetLines: NGOBudgetLine[] = useMemo(() => ngoState?.budgetLines || [], [ngoState?.budgetLines]);
  const activities: NGOActivity[] = useMemo(() => ngoState?.activities || [], [ngoState?.activities]);
  const expenses: NGOExpense[] = useMemo(() => ngoState?.expenses || [], [ngoState?.expenses]);
  const cohorts: NGOBeneficiaryCohort[] = useMemo(() => ngoState?.beneficiaryCohorts || [], [ngoState?.beneficiaryCohorts]);
  const fieldVisits: NGOFieldVisit[] = useMemo(() => ngoState?.fieldVisits || [], [ngoState?.fieldVisits]);
  const indicators: NGOIndicator[] = useMemo(() => ngoState?.indicators || [], [ngoState?.indicators]);
  const dataQualityIssues: NGODataQualityIssue[] = useMemo(() => ngoState?.dataQualityIssues || [], [ngoState?.dataQualityIssues]);
  const reportSnapshots: NGOReportSnapshot[] = useMemo(() => ngoState?.reportSnapshots || [], [ngoState?.reportSnapshots]);
  const donorAccessGrants: NGODonorAccessGrant[] = useMemo(() => ngoState?.donorAccessGrants || [], [ngoState?.donorAccessGrants]);
  const linkedEntities: NGOLinkedEntityAggregate[] = useMemo(() => ngoState?.linkedEntities || [], [ngoState?.linkedEntities]);
  const impactTraceChains: NGOImpactTraceChain[] = useMemo(() => ngoState?.impactTraceChains || [], [ngoState?.impactTraceChains]);
  const districtContexts: NGODistrictContext[] = useMemo(() => ngoState?.districtContexts || [], [ngoState?.districtContexts]);
  const guardianInsights: NGOGuardianInsight[] = useMemo(() => ngoState?.guardianInsights || [], [ngoState?.guardianInsights]);
  const staff: NGOStaffMember[] = useMemo(() => ngoState?.staff || [], [ngoState?.staff]);
  const viewerRole: NGORole = ngoState?.viewerRole || 'country_director';
  const perms = useMemo(() => {
    return (
      ngoState?.viewerPermissions || {
        canManageOrganization: true,
        canManageStaff: true,
        canManagePrograms: true,
        canManageGrantsAndBudget: true,
        canApproveExpenses: true,
        canConfirmPayments: true,
        canSubmitFieldData: true,
        canVerifyMeal: true,
        canGenerateReports: true,
        canManageDonorAccess: true,
        isReadOnlyDonorOrAuditor: false,
      }
    );
  }, [ngoState?.viewerPermissions]);

  // Set default trace
  const activeTrace = useMemo(() => {
    if (!impactTraceChains.length) return null;
    return impactTraceChains.find((c) => c.traceId === selectedTraceId) || impactTraceChains[0];
  }, [impactTraceChains, selectedTraceId]);

  // Offline visits count
  const offlineVisitsCount = useMemo(() => {
    return fieldVisits.filter((v) => v.syncStatus === 'queued_offline').length;
  }, [fieldVisits]);

  // Action dispatcher with feedback toast
  const handleAction = async (payload: Record<string, unknown>, successMsg?: string) => {
    startTransition(async () => {
      try {
        setFeedback(null);
        const ok = await act(payload);
        if (ok) {
          setFeedback({
            type: 'success',
            message:
              successMsg ||
              (isRw ? 'Igikorwa cyakozwe neza muri sisitemu!' : 'Institutional action completed successfully!'),
          });
        } else {
          setFeedback({
            type: 'error',
            message: isRw ? 'Ntabwo igikorwa cyakunze. Ongera ugerageze.' : 'Action failed. Please try again.',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setFeedback({
          type: 'error',
          message: msg || (isRw ? 'Habaye ikosa.' : 'An unexpected error occurred.'),
        });
      }
    });
  };

  const roleMeta = useMemo(() => {
    return ALL_NGO_ROLES.find((r) => r.role === viewerRole) || { role: viewerRole, en: viewerRole, rw: viewerRole };
  }, [viewerRole]);

  return (
    <div className={s.container}>
      {/* 1. Header Banner */}
      <header className={s.headerBanner}>
        <div className={s.headerTop}>
          <div className={s.titleArea}>
            <div className={s.badgeRow}>
              <span className={s.brandBadge}>
                <Sparkles size={13} />
                {isRw ? 'HURIZA IMPACT — UBUSHISHOZI BUKOMEYE BW’IBIGO' : 'HURIZA IMPACT — OPERATION INSTITUTIONAL INTELLIGENCE'}
              </span>
              <span className={s.roleBadge}>
                <ShieldCheck size={13} />
                {isRw ? roleMeta.rw : roleMeta.en}
              </span>
              <span className={s.registrationBadge}>
                RGB: {profile.registrationRef}
              </span>
            </div>
            <h1 className={s.orgTitle}>{profile.name}</h1>
            <p className={s.tagline}>
              {isRw
                ? 'Cunga Gahunda. Emeza Iterambere. Gwiza Umusaruro.'
                : 'Manage Programs. Prove Progress. Multiply Impact.'}
            </p>
          </div>

          <div className={s.headerActionGroup}>
            <a
              href="/api/export?type=impact"
              className={`${s.button} ${s.buttonSecondary}`}
              title={isRw ? 'Kura hanze imbonerahamwe ya CSV' : 'Export institutional CSV telemetry'}
            >
              <Download size={14} />
              {isRw ? 'Kura hanze CSV' : 'Export CSV'}
            </a>
            {offlineVisitsCount > 0 && (
              <button
                type="button"
                className={`${s.button} ${s.buttonSuccess}`}
                onClick={() =>
                  handleAction(
                    { action: 'syncOfflineFieldVisits' },
                    isRw ? 'Kwandukura raporo zo mu murima byakozwe neza!' : 'Synced offline field surveys!'
                  )
                }
                disabled={busy || isPending}
              >
                <Wifi size={14} />
                {isRw ? `Kwandukura (${offlineVisitsCount})` : `Sync Offline (${offlineVisitsCount})`}
              </button>
            )}
          </div>
        </div>

        <div className={s.orgMetaRow}>
          <span className={s.metaItem}>
            <MapPin size={14} />
            <b>{isRw ? 'Uturere:' : 'Districts:'}</b> {profile.operatingDistricts.join(', ')}
          </span>
          <span className={s.metaItem}>
            <Layers size={14} />
            <b>{isRw ? 'Inzego:' : 'Focus:'}</b> {profile.focusSectors.join(', ')}
          </span>
          <span className={s.metaItem}>
            <Calendar size={14} />
            <b>{isRw ? 'Igihe cya Raporo:' : 'Reporting Cycle:'}</b> {profile.reportingPeriod.toUpperCase()}
          </span>
          <span className={s.metaItem}>
            <DollarSign size={14} />
            <b>{isRw ? 'Icyemezo Cy’Imari:' : 'Approval Cap:'}</b> {money(profile.approvalThresholdRwf)}
          </span>
        </div>
      </header>

      {/* 2. Explicit NISR & Synthetic Integrity Notice Banner */}
      <div className={s.nisrNoticeBanner}>
        <div className={s.noticeContent}>
          <Info size={20} className={s.noticeIcon} />
          <div>
            <div className={s.noticeTitle}>
              {isRw ? 'Inyandiko y’Ubusugire bw’Amakuru ya NISR n’Ibyitegererezo' : 'NISR & Synthetic Demo Integrity Notice'}
              <span className={s.noticeSourceTag}>NISR FinScope Rwanda · EICV5</span>
            </div>
            <p className={s.noticeText}>
              {isRw
                ? 'Imibare yose igaragara muri iyi sisitemu ni ibipimo rusange by’ibyitegererezo bigamije kwerekana uko igenzura ry’ibigo rikorwa. Ntabwo bivangwa n’inguzanyo z’abanyamuryango ku giti cyabo cyangwa ngo byemezwe nk’ingaruka nyakuri z’ubukungu nta suzuma rifatika rikozwe.'
                : 'Observed program monitoring aggregates & synthetic demonstration data; never conflated with causal impact or personal group member loans. Aggregate telemetry respects statutory anonymity and complies with NISR statistical principles.'}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`${s.feedbackToast} ${
            feedback.type === 'success' ? s.feedbackSuccess : s.feedbackError
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className={`${s.button} ${s.buttonSmall}`}
            onClick={() => setFeedback(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* 3. Navigation Tabs (10 Rich Tabs) */}
      <nav className={s.tabsContainer} aria-label="NGO Institutional Tabs">
        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'overview' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} />
          <span>{isRw ? 'Incamake y’Ubuyobozi' : 'Overview & Guardian'}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'impact_trace' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('impact_trace')}
        >
          <Sparkles size={16} />
          <span>HURIZA ImpactTrace</span>
          <span className={s.tabBadge}>{impactTraceChains.length}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'programs' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('programs')}
        >
          <Layers size={16} />
          <span>{isRw ? 'Gahunda n’Imishinga' : 'Programs & Workplan'}</span>
          <span className={s.tabBadge}>{programs.length}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'grants_budget' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('grants_budget')}
        >
          <DollarSign size={16} />
          <span>{isRw ? 'Inkunga n’Amafaranga' : 'Grants & 4-Step Expenses'}</span>
          <span className={s.tabBadge}>{expenses.filter((e) => e.status !== 'paid').length}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'groups_coops_map' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('groups_coops_map')}
        >
          <Landmark size={16} />
          <span>{isRw ? 'Amatsinda na Koperative' : 'Groups, Coops & NISR Map'}</span>
          <span className={s.tabBadge}>{kpis.supportedSavingsGroupsCount + kpis.supportedCooperativesCount}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'beneficiaries' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('beneficiaries')}
        >
          <Users size={16} />
          <span>{isRw ? 'Abagenerwabikorwa n’Umutekano' : 'Beneficiaries & Safeguarding'}</span>
          <span className={s.tabBadge}>{cohorts.length}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'field_ops' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('field_ops')}
        >
          <Smartphone size={16} />
          <span>{isRw ? 'Ibikorwa byo mu Murima' : 'Field Ops & Surveys'}</span>
          {offlineVisitsCount > 0 ? (
            <span className={s.tabBadgeWarning}>{offlineVisitsCount} offline</span>
          ) : (
            <span className={s.tabBadge}>{fieldVisits.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'meal_center' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('meal_center')}
        >
          <ShieldCheck size={16} />
          <span>{isRw ? 'Igenzura rya MEAL' : 'MEAL & Data Quality'}</span>
          {kpis.openDataQualityIssuesCount > 0 && (
            <span className={s.tabBadgeWarning}>{kpis.openDataQualityIssuesCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'donor_reports' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('donor_reports')}
        >
          <FileText size={16} />
          <span>{isRw ? 'Raporo z’Abaterankunga' : 'Donor Reports & Portal'}</span>
          <span className={s.tabBadge}>{reportSnapshots.length}</span>
        </button>

        <button
          type="button"
          className={`${s.tabButton} ${activeTab === 'team_onboarding' ? s.tabButtonActive : ''}`}
          onClick={() => setActiveTab('team_onboarding')}
        >
          <UserCheck size={16} />
          <span>{isRw ? 'Abakozi n’Imiyoborere' : 'Staff & Governance'}</span>
          <span className={s.tabBadge}>{staff.length}</span>
        </button>
      </nav>

      {/* 4. TAB CONTENTS */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <section className={s.tabContent}>
          {/* Quick Action Navigation Bar */}
          <div className={s.quickActionBar}>
            <span className={s.quickActionText}>
              <Sparkles size={16} />
              {isRw ? 'Ibyihutirwa by’ubuyobozi:' : 'Executive Quick Access:'}
            </span>
            <button
              type="button"
              className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
              onClick={() => setActiveTab('impact_trace')}
            >
              <Sparkles size={14} />
              {isRw ? 'Kugenzura Urugendo rw’Inkunga (ImpactTrace)' : 'View ImpactTrace Chains'}
            </button>
            <button
              type="button"
              className={`${s.button} ${s.buttonSecondary} ${s.buttonSmall}`}
              onClick={() => setActiveTab('grants_budget')}
            >
              <DollarSign size={14} />
              {isRw ? 'Kwemeza Amafaranga (Expense Queue)' : 'Expense Approval Queue'}
            </button>
            <button
              type="button"
              className={`${s.button} ${s.buttonOutline} ${s.buttonSmall}`}
              onClick={() => setActiveTab('field_ops')}
            >
              <Smartphone size={14} />
              {isRw ? 'Kwandika Igikorwa cyo mu Murima' : 'Mobile Field Survey'}
            </button>
          </div>

          {/* 8 Primary Institutional KPIs */}
          <div className={s.kpiGrid}>
            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Gahunda Zikora' : 'Active Programs'}</span>
                <div className={s.kpiIconWrapper}><Layers size={16} /></div>
              </div>
              <div className={s.kpiValue}>{kpis.activeProgramsCount}</div>
              <div className={s.kpiMeta}>
                <span>{programs.map((p) => p.name).join(' · ')}</span>
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Inkunga z’Abaterankunga' : 'Active Grants'}</span>
                <div className={s.kpiIconWrapper}><Award size={16} /></div>
              </div>
              <div className={s.kpiValue}>{kpis.activeGrantsCount}</div>
              <div className={s.kpiMeta}>
                <span>{grants.map((g) => g.donorName).join(', ')}</span>
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Inkunga Yatsindiwe' : 'Total Grant Awarded'}</span>
                <div className={s.kpiIconWrapper}><DollarSign size={16} /></div>
              </div>
              <div className={s.kpiValue}>{money(kpis.totalGrantAwardedRwf)}</div>
              <div className={s.kpiMeta}>
                <span className={s.kpiMetaHighlight}>{money(kpis.totalGrantReceivedRwf)}</span> {isRw ? 'yakiriwe' : 'received'}
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Amafaranga Yemejwe/Yishyuwe' : 'Confirmed Disbursed'}</span>
                <div className={s.kpiIconWrapper}><CheckCircle2 size={16} /></div>
              </div>
              <div className={s.kpiValue}>{money(kpis.totalConfirmedPaidRwf)}</div>
              <div className={s.kpiMeta}>
                <span>{money(kpis.totalCommittedExpensesRwf)} {isRw ? 'yose yagenwe' : 'committed'}</span>
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Isalido y’Inkunga Isigaye' : 'Remaining Restricted Cash'}</span>
                <div className={s.kpiIconWrapper}><Clock size={16} /></div>
              </div>
              <div className={s.kpiValue}>{money(kpis.remainingRestrictedBalanceRwf)}</div>
              <div className={s.kpiMeta}>
                <span className={s.kpiMetaHighlight}>
                  {Math.round((kpis.totalConfirmedPaidRwf / (kpis.totalGrantAwardedRwf || 1)) * 100)}% {isRw ? 'yakoreshejwe' : 'burn rate'}
                </span>
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Amatsinda Ashyigikiwe' : 'Supported Groups'}</span>
                <div className={s.kpiIconWrapper}><Users size={16} /></div>
              </div>
              <div className={s.kpiValue}>{kpis.supportedSavingsGroupsCount}</div>
              <div className={s.kpiMeta}>
                <span>{legacyImpact.groups ? `${legacyImpact.groups} active on HURIZA` : '80 community groups'}</span>
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Koperative Zishyigikiwe' : 'Supported Cooperatives'}</span>
                <div className={s.kpiIconWrapper}><Landmark size={16} /></div>
              </div>
              <div className={s.kpiValue}>{kpis.supportedCooperativesCount}</div>
              <div className={s.kpiMeta}>
                <span>{isRw ? 'Koperative z’ibanze zanditswe' : 'Primary coops registered'}</span>
              </div>
            </div>

            <div className={s.kpiCard}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{isRw ? 'Abagenerwabikorwa Banditswe' : 'Enrolled Participants'}</span>
                <div className={s.kpiIconWrapper}><UserCheck size={16} /></div>
              </div>
              <div className={s.kpiValue}>{kpis.enrolledBeneficiariesCount.toLocaleString()}</div>
              <div className={s.kpiMeta}>
                <span className={s.kpiMetaHighlight}>{kpis.femaleBeneficiariesPct}% {isRw ? 'Abagore' : 'Female'}</span> ·{' '}
                <span>{kpis.verifiedIndicatorsPct}% {isRw ? 'ibipimo byemejwe' : 'MEAL verified'}</span>
              </div>
            </div>
          </div>

          {/* 5 HURIZA Guardian NGO Intelligence Cards */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <ShieldCheck size={20} color="#2463A6" />
                  {isRw ? 'Ubugenzuzi n’Inama bya HURIZA Guardian' : 'HURIZA Guardian Institutional Intelligence'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Inama n’ubugenzuzi bikorwa n’ikoranabuhanga ku micungire y’inkunga, ibipimo n’ubuziranenge bw’amakuru.'
                    : 'Algorithmic checks across restricted grant compliance, MEAL evidence verification, and data quality assurance.'}
                </p>
              </div>
              {kpis.openDataQualityIssuesCount > 0 && (
                <span className={`${s.statusBadge} ${s.statusWarning}`}>
                  <AlertTriangle size={13} />
                  {kpis.openDataQualityIssuesCount} {isRw ? 'Ibibazo by’ubuziranenge bifunguye' : 'Open DQ alerts'}
                </span>
              )}
            </div>

            <div className={s.guardianGrid}>
              {guardianInsights.map((g) => (
                <div
                  key={g.id}
                  className={`${s.guardianCard} ${
                    g.severity === 'critical'
                      ? s.guardianCardCritical
                      : g.severity === 'warning'
                      ? s.guardianCardWarning
                      : s.guardianCardInfo
                  }`}
                >
                  <div className={s.guardianHeader}>
                    <span className={s.guardianLensTag}>{g.lens.replace(/_/g, ' ')}</span>
                    <span
                      className={`${s.statusBadge} ${
                        g.severity === 'critical'
                          ? s.statusCritical
                          : g.severity === 'warning'
                          ? s.statusWarning
                          : s.statusApproved
                      }`}
                    >
                      {g.severity.toUpperCase()}
                    </span>
                  </div>
                  <h3 className={s.guardianTitle}>{g.title}</h3>
                  <p className={s.guardianExplanation}>{g.explanation}</p>
                  <span className={s.guardianMetric}>{g.metricLabel}</span>
                  <div className={s.guardianActionBox}>
                    <ChevronRight size={14} />
                    <span><b>{isRw ? 'Icyo gukora:' : 'Action:'}</b> {g.recommendedAction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: IMPACT_TRACE (Flagship Innovation) */}
      {activeTab === 'impact_trace' && (
        <section className={s.tabContent}>
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Sparkles size={20} color="#2463A6" />
                  {isRw ? 'HURIZA ImpactTrace — Urugendo rw’Imiyoborere n’Umusaruro' : 'HURIZA ImpactTrace — End-to-End Accountability Chain'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Kugenzura intambwe ku yindi kuva ku nkunga y’umuterankunga kugeza ku muturage no kuri raporo yemezwa.'
                    : 'Trace restricted donor shillings directly through budget categories, field activities, verified group cohorts, and MEAL indicators.'}
                </p>
              </div>
            </div>

            {/* Trace Chain Selector */}
            <div className={s.traceSelector}>
              <label htmlFor="traceSelect" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                {isRw ? 'Hitamo Urugendo rwo kugenzura:' : 'Select Trace Chain:'}
              </label>
              <select
                id="traceSelect"
                className={s.traceSelectorSelect}
                value={activeTrace?.traceId || ''}
                onChange={(e) => setSelectedTraceId(e.target.value)}
              >
                {impactTraceChains.map((c) => (
                  <option key={c.traceId} value={c.traceId}>
                    {c.traceId} · {c.donorName} → {c.activityTitle} ({c.activityDistrict})
                  </option>
                ))}
              </select>
            </div>

            {activeTrace ? (
              <div className={s.traceChainFlow}>
                {/* Step 1: Donor Grant */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>1</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>{isRw ? '1. Inkunga y’Umuterankunga' : '1. Donor Grant'}</span>
                      <span className={`${s.statusBadge} ${s.statusApproved}`}>Award Confirmed</span>
                    </div>
                    <h3 className={s.traceStepTitle}>{activeTrace.grantTitle}</h3>
                    <div className={s.traceStepDetails}>
                      <span><b>{isRw ? 'Umuterankunga:' : 'Donor:'}</b> {activeTrace.donorName}</span>
                      <span><b>{isRw ? 'Kode:' : 'Grant Code:'}</b> {activeTrace.grantId}</span>
                      <span className={s.traceStepValue}>
                        <b>{isRw ? 'Amafaranga yose:' : 'Award Amount:'}</b> {money(activeTrace.grantAwardRwf)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={s.traceStepConnector}>↓</div>

                {/* Step 2: Restricted Budget Line */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>2</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>{isRw ? '2. Umurongo w’Ingengo y’Imari' : '2. Restricted Budget Line'}</span>
                      <span className={`${s.statusBadge} ${s.statusReviewed}`}>Restricted Code</span>
                    </div>
                    <h3 className={s.traceStepTitle}>
                      {activeTrace.budgetLineCode} — {activeTrace.budgetCategory.replace(/_/g, ' ')}
                    </h3>
                    <div className={s.traceStepDetails}>
                      <span><b>{isRw ? 'Icyiciro:' : 'Category:'}</b> {activeTrace.budgetCategory}</span>
                      <span className={s.traceStepValue}>
                        <b>{isRw ? 'Amafaranga yagenwe:' : 'Allocated:'}</b> {money(activeTrace.budgetAllocatedRwf)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={s.traceStepConnector}>↓</div>

                {/* Step 3: Implemented Activity & Confirmed Expense */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>3</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>
                        {isRw ? '3. Igikorwa Cyashyizwe mu bikorwa & Amafaranga Yishyuwe' : '3. Implemented Activity & Confirmed Expense'}
                      </span>
                      <span className={`${s.statusBadge} ${s.statusApproved}`}>{activeTrace.activityStatus}</span>
                    </div>
                    <h3 className={s.traceStepTitle}>{activeTrace.activityTitle}</h3>
                    <div className={s.traceStepDetails}>
                      <span><MapPin size={13} /> {activeTrace.activityDistrict}</span>
                      <span><b>Activity ID:</b> {activeTrace.activityId}</span>
                      <span className={s.traceStepValue}>
                        <b>{isRw ? 'Amafaranga yemejwe/yishyuwe:' : 'Confirmed Paid:'}</b> {money(activeTrace.confirmedExpenseRwf)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={s.traceStepConnector}>↓</div>

                {/* Step 4: Participating Group / Cohort */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>4</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>
                        {isRw ? '4. Itsinda / Koperative Yitabiriye' : '4. Participating Group / Cohort'}
                      </span>
                      <span className={`${s.statusBadge} ${s.statusReviewed}`}>Anonymized Entity</span>
                    </div>
                    <h3 className={s.traceStepTitle}>{activeTrace.beneficiaryCohortName}</h3>
                    <div className={s.traceStepDetails}>
                      <span><b>HURIZA Linked Org ID:</b> {activeTrace.linkedEntityId}</span>
                      <span className={s.traceStepValue}>
                        <Users size={13} /> {activeTrace.participantsReached} {isRw ? 'abanyamuryango bagezweho' : 'participants reached'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={s.traceStepConnector}>↓</div>

                {/* Step 5: Field Evidence */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>5</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>{isRw ? '5. Ibimenyetso byo mu Murima' : '5. Field Evidence & Verification'}</span>
                      <span
                        className={`${s.statusBadge} ${
                          activeTrace.evidenceVerified ? s.statusApproved : s.statusWarning
                        }`}
                      >
                        {activeTrace.evidenceVerified ? 'Verified by MEAL' : 'Pending Verification'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                      {activeTrace.fieldEvidenceSummary}
                    </p>
                  </div>
                </div>

                <div className={s.traceStepConnector}>↓</div>

                {/* Step 6: Observed MEAL Indicator */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>6</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>{isRw ? '6. Igipimo cya MEAL Cyagenzuwe' : '6. Observed MEAL Indicator'}</span>
                      <span className={`${s.statusBadge} ${s.statusApproved}`}>
                        {activeTrace.indicatorVerificationStatus}
                      </span>
                    </div>
                    <h3 className={s.traceStepTitle}>
                      {activeTrace.indicatorCode} — {activeTrace.indicatorName}
                    </h3>
                    <div className={s.traceStepDetails}>
                      <span className={s.traceStepValue}>
                        <b>{isRw ? 'Icyagezweho:' : 'Observed Value:'}</b> {activeTrace.indicatorObservedValue} / {activeTrace.indicatorTargetValue}
                      </span>
                      <span>
                        ({Math.round((activeTrace.indicatorObservedValue / (activeTrace.indicatorTargetValue || 1)) * 100)}% progress)
                      </span>
                    </div>
                  </div>
                </div>

                <div className={s.traceStepConnector}>↓</div>

                {/* Step 7: Approved Donor Report */}
                <div className={s.traceStepCard}>
                  <div className={s.traceStepNumber}>7</div>
                  <div className={s.traceStepBody}>
                    <div className={s.traceStepTop}>
                      <span className={s.traceStepStage}>{isRw ? '7. Raporo Yemewe y’Umuterankunga' : '7. Approved Donor Report Snapshot'}</span>
                      <span className={`${s.statusBadge} ${s.statusApproved}`}>{activeTrace.reportStatus}</span>
                    </div>
                    <h3 className={s.traceStepTitle}>{activeTrace.reportTitle}</h3>
                    <div className={s.traceStepDetails}>
                      <span>{isRw ? 'Raporo ifunzwe kandi yemejwe n’ubuyobozi' : 'Locked governance snapshot with CSV audit pack'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={s.emptyState}>
                <p>{isRw ? 'Nta rugendo rw’inkunga rurandikwa muri iyi gahunda.' : 'No ImpactTrace chains recorded yet.'}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: PROGRAMS, PROJECTS & WORKPLAN */}
      {activeTab === 'programs' && (
        <section className={s.tabContent}>
          {/* Programs Section */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Layers size={20} color="#2463A6" />
                  {isRw ? 'Gahunda z’Umuryango (NGO Programs)' : 'Institutional Programs'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw ? 'Gahunda ngenderwaho zishyirwa mu bikorwa mu turere dutandukanye.' : 'Multi-year strategic programs across target districts.'}
                </p>
              </div>
              {perms.canManagePrograms && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowProgramForm(!showProgramForm)}
                >
                  <Plus size={14} />
                  {showProgramForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Ongeraho Gahunda' : 'New Program')}
                </button>
              )}
            </div>

            {/* Create Program Form */}
            {showProgramForm && perms.canManagePrograms && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const name = String(fd.get('name') || '').trim();
                  const code = String(fd.get('code') || '').trim();
                  const objective = String(fd.get('objective') || '').trim();
                  const description = String(fd.get('description') || '').trim();
                  const totalBudget = Number(fd.get('totalBudget') || 25000000);
                  const districtsRaw = String(fd.get('districts') || 'Gasabo, Rulindo');
                  const districts = districtsRaw.split(',').map((d) => d.trim()).filter(Boolean);
                  const leadOfficer = String(fd.get('leadOfficer') || profile.name);
                  const fundingSource = String(fd.get('fundingSource') || 'Donor Grant');

                  handleAction(
                    {
                      action: 'createNgoProgram',
                      name,
                      code,
                      objective,
                      description,
                      totalBudget,
                      districts,
                      leadOfficer,
                      fundingSource,
                    },
                    isRw ? 'Gahunda nshya yashyizweho neza!' : 'New program created successfully!'
                  );
                  setShowProgramForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kurema Gahunda Nshya' : 'Create New NGO Program'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina rya Gahunda:' : 'Program Name:'}</label>
                    <input className={s.formInput} name="name" required placeholder="e.g. Financial Resilience & Community Inclusion" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Kode ya Gahunda:' : 'Program Code:'}</label>
                    <input className={s.formInput} name="code" defaultValue={`PRG-${Math.floor(100 + Math.random() * 900)}`} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ingengo yose (RWF):' : 'Total Budget (RWF):'}</label>
                    <input className={s.formInput} type="number" name="totalBudget" defaultValue={30000000} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Uturere (byandikishe ikoma):' : 'Districts (comma-separated):'}</label>
                    <input className={s.formInput} name="districts" defaultValue="Gasabo, Rulindo, Rwamagana" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umuyobozi Ushinzwe:' : 'Lead Officer:'}</label>
                    <input className={s.formInput} name="leadOfficer" defaultValue="Diane Uwimana" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Inkomoko y’Amafaranga:' : 'Funding Source:'}</label>
                    <input className={s.formInput} name="fundingSource" defaultValue="USAID & East Africa Resilience Fund" />
                  </div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Intego Nyakuri:' : 'Objective:'}</label>
                  <textarea className={s.formTextarea} name="objective" rows={2} defaultValue="Strengthen savings groups and community cooperatives with digital transparency tools." />
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowProgramForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Gahunda' : 'Create Program'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.kpiGrid}>
              {programs.map((p) => (
                <div key={p.id} className={s.card} style={{ gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`${s.statusBadge} ${s.statusReviewed}`}>{p.code}</span>
                    <span className={`${s.statusBadge} ${s.statusApproved}`}>{p.status}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{p.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.825rem', color: '#475569', lineHeight: 1.4 }}>
                    {p.objective || p.description}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span><b>{isRw ? 'Ingengo:' : 'Budget:'}</b> {money(p.totalBudget)}</span>
                    <span><b>{isRw ? 'Uturere:' : 'Districts:'}</b> {p.districts.join(', ')}</span>
                    <span><b>{isRw ? 'Ushinzwe:' : 'Lead:'}</b> {p.leadOfficer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* District Projects Table */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <MapPin size={20} color="#2463A6" />
                  {isRw ? 'Imishinga yo mu Turere (District Projects)' : 'District Field Projects'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw ? 'Imishinga ishamikiye kuri gahunda ikorera mu turere n’imirenge.' : 'Field operational sites allocated to programs.'}
                </p>
              </div>
              {perms.canManagePrograms && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowProjectForm(!showProjectForm)}
                >
                  <Plus size={14} />
                  {showProjectForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Ongeraho Umushinga' : 'New Project')}
                </button>
              )}
            </div>

            {/* Create District Project Form */}
            {showProjectForm && perms.canManagePrograms && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const name = String(fd.get('name') || '').trim();
                  const code = String(fd.get('code') || '').trim();
                  const district = String(fd.get('district') || 'Gasabo');
                  const sector = String(fd.get('sector') || 'Kimironko');
                  const siteName = String(fd.get('siteName') || `${district} Center`);
                  const budgetAllocated = Number(fd.get('budgetAllocated') || 10000000);

                  handleAction(
                    {
                      action: 'createNgoProject',
                      programId,
                      name,
                      code,
                      district,
                      sector,
                      siteName,
                      budgetAllocated,
                    },
                    isRw ? 'Umushinga w’akarere washyizweho neza!' : 'District project created successfully!'
                  );
                  setShowProjectForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kurema Umushinga wo mu Karere' : 'Create District Field Project'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Gahunda:' : 'Parent Program:'}</label>
                    <select className={s.formSelect} name="programId">
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina ry’Umushinga:' : 'Project Name:'}</label>
                    <input className={s.formInput} name="name" required placeholder="e.g. Gasabo Urban Groups Digitalization" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Kode:' : 'Code:'}</label>
                    <input className={s.formInput} name="code" defaultValue={`PRJ-${Math.floor(100 + Math.random() * 900)}`} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Akarere:' : 'District:'}</label>
                    <input className={s.formInput} name="district" defaultValue="Gasabo" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umurenge:' : 'Sector:'}</label>
                    <input className={s.formInput} name="sector" defaultValue="Kimironko" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ingengo Yagenwe (RWF):' : 'Budget Allocated (RWF):'}</label>
                    <input className={s.formInput} type="number" name="budgetAllocated" defaultValue={10000000} />
                  </div>
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowProjectForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Umushinga' : 'Create Project'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Kode' : 'Code'}</th>
                    <th>{isRw ? 'Umushinga' : 'Project'}</th>
                    <th>{isRw ? 'Akarere / Umurenge' : 'District / Sector'}</th>
                    <th>{isRw ? 'Ingengo Yagenwe' : 'Allocated'}</th>
                    <th>{isRw ? 'Amafaranga Yakoreshejwe' : 'Spent'}</th>
                    <th>{isRw ? 'Imikoreshereze' : 'Burn Rate'}</th>
                    <th>{isRw ? 'Imimerere' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((pr) => {
                    const pct = pr.budgetAllocated > 0 ? Math.round((pr.budgetSpent / pr.budgetAllocated) * 100) : 0;
                    return (
                      <tr key={pr.id}>
                        <td><b>{pr.code}</b></td>
                        <td>{pr.name}</td>
                        <td>{pr.district} · {pr.sector}</td>
                        <td>{money(pr.budgetAllocated)}</td>
                        <td>{money(pr.budgetSpent)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className={s.progressBar} style={{ width: '80px' }}>
                              <div
                                className={`${s.progressFill} ${pct > 90 ? s.progressFillWarning : s.progressFillSuccess}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span>{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`${s.statusBadge} ${s.statusApproved}`}>{pr.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!projects.length && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta mishinga yo mu turere irandikwa.' : 'No district projects recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activities Workplan & Verification */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Calendar size={20} color="#2463A6" />
                  {isRw ? 'Gahunda y’Ibikorwa n’Isuzuma (Activities Workplan)' : 'Field Activities Workplan & Verification'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw ? 'Ibikorwa byakozwe mu murima no kwemezwa n’abashinzwe MEAL.' : 'Activities executed in field sites and MEAL sign-off.'}
                </p>
              </div>
              {perms.canSubmitFieldData && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowActivityForm(!showActivityForm)}
                >
                  <Plus size={14} />
                  {showActivityForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Andika Igikorwa' : 'Record Activity')}
                </button>
              )}
            </div>

            {/* Record Activity Form */}
            {showActivityForm && perms.canSubmitFieldData && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const projectId = String(fd.get('projectId') || projects[0]?.id || 'proj-gasabo');
                  const grantId = String(fd.get('grantId') || grants[0]?.id || 'grant-rift-2026');
                  const budgetLineId = String(fd.get('budgetLineId') || budgetLines[0]?.id || 'bl-101');
                  const title = String(fd.get('title') || '').trim();
                  const activityType = String(fd.get('activityType') || 'group_training');
                  const district = String(fd.get('district') || 'Gasabo');
                  const sector = String(fd.get('sector') || 'Kimironko');
                  const targetParticipants = Number(fd.get('targetParticipants') || 40);
                  const actualParticipants = Number(fd.get('actualParticipants') || targetParticipants);
                  const linkedEntityType = String(fd.get('linkedEntityType') || 'savings_group');
                  const linkedEntityId = String(fd.get('linkedEntityId') || 'group-ubumwe');
                  const evidenceUrl = String(fd.get('evidenceUrl') || '').trim();
                  const evidenceNote = String(fd.get('evidenceNote') || '').trim();

                  handleAction(
                    {
                      action: 'recordNgoActivity',
                      programId,
                      projectId,
                      grantId,
                      budgetLineId,
                      title,
                      activityType,
                      district,
                      sector,
                      targetParticipants,
                      actualParticipants,
                      linkedEntityType,
                      linkedEntityId,
                      evidenceUrl,
                      evidenceNote,
                    },
                    isRw ? 'Igikorwa cyanditswe neza!' : 'Field activity recorded successfully!'
                  );
                  setShowActivityForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kwandika Igikorwa Cyakozwe mu Murima' : 'Record Executed Field Activity'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umutwe w’Igikorwa:' : 'Activity Title:'}</label>
                    <input className={s.formInput} name="title" required placeholder="e.g. Dual-control Bookkeeping Clinic" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ubwoko bw’Igikorwa:' : 'Activity Type:'}</label>
                    <select className={s.formSelect} name="activityType">
                      <option value="group_training">Group Leadership & Governance Training</option>
                      <option value="digital_ledger_onboarding">Digital Ledger Onboarding Clinic</option>
                      <option value="cooperative_advisory">Cooperative Advisory & Governance Session</option>
                      <option value="field_monitoring">Field Monitoring & Audit Visit</option>
                      <option value="safeguarding_clinic">Safeguarding & Consent Dialogue</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Akarere:' : 'District:'}</label>
                    <input className={s.formInput} name="district" defaultValue="Gasabo" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umurenge:' : 'Sector:'}</label>
                    <input className={s.formInput} name="sector" defaultValue="Kimironko" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Abitabiriye (Intego):' : 'Target Attendees:'}</label>
                    <input className={s.formInput} type="number" name="targetParticipants" defaultValue={40} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Abitabiriye Nyakuri:' : 'Actual Attendees:'}</label>
                    <input className={s.formInput} type="number" name="actualParticipants" defaultValue={42} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umurongo w’Ingengo (Budget Line):' : 'Budget Line:'}</label>
                    <select className={s.formSelect} name="budgetLineId">
                      {budgetLines.map((bl) => (
                        <option key={bl.id} value={bl.id}>{bl.lineCode} - {bl.category}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Itsinda / Koperative Ihujwe:' : 'Linked Org ID:'}</label>
                    <input className={s.formInput} name="linkedEntityId" defaultValue="group-ubumwe" />
                  </div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Inyandiko y’Ibimenyetso:' : 'Evidence Summary / URL:'}</label>
                  <input className={s.formInput} name="evidenceNote" placeholder="Signed attendance register scanned and filed at field office" />
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowActivityForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Ohereza Igikorwa' : 'Save Activity'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Igikorwa' : 'Activity'}</th>
                    <th>{isRw ? 'Akarere' : 'District'}</th>
                    <th>{isRw ? 'Abitabiriye' : 'Participants'}</th>
                    <th>{isRw ? 'Itsinda/Koperative' : 'Linked Entity'}</th>
                    <th>{isRw ? 'Isuzuma rya MEAL' : 'MEAL Verification'}</th>
                    <th>{isRw ? 'Ibikorwa' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((actv) => (
                    <tr key={actv.id}>
                      <td>
                        <b>{actv.title}</b>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {actv.activityType.replace(/_/g, ' ')} · {actv.leadOfficer}
                        </div>
                      </td>
                      <td>{actv.district} ({actv.sector})</td>
                      <td>
                        {actv.actualParticipants} / {actv.targetParticipants}
                      </td>
                      <td>
                        <span className={`${s.statusBadge} ${s.statusReviewed}`}>{actv.linkedEntityId}</span>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            actv.verificationStatus === 'approved'
                              ? s.statusApproved
                              : actv.verificationStatus === 'meal_reviewed'
                              ? s.statusReviewed
                              : s.statusWarning
                          }`}
                        >
                          {actv.verificationStatus}
                        </span>
                      </td>
                      <td>
                        {perms.canVerifyMeal && actv.verificationStatus !== 'approved' && (
                          <button
                            type="button"
                            className={`${s.button} ${s.buttonSuccess} ${s.buttonSmall}`}
                            onClick={() =>
                              handleAction(
                                {
                                  action: 'verifyNgoActivity',
                                  activityId: actv.id,
                                  verificationStatus: 'approved',
                                },
                                isRw ? 'Igikorwa cyemejwe neza na MEAL!' : 'Activity approved by MEAL!'
                              )
                            }
                            disabled={busy || isPending}
                          >
                            <Check size={12} />
                            {isRw ? 'Emeza' : 'Approve'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!activities.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta bikorwa birandikwa.' : 'No field activities recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: GRANTS, BUDGET & 4-STEP EXPENSE WORKFLOW */}
      {activeTab === 'grants_budget' && (
        <section className={s.tabContent}>
          {/* Multi-Grant Cards */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Award size={20} color="#2463A6" />
                  {isRw ? 'Inkunga z’Abaterankunga (Restricted Donor Grants)' : 'Restricted Donor Grants'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Inkunga zigomba gukoreshwa hakurikijwe amasezerano n’ingengo yemejwe.'
                    : 'Institutional awards with statutory currency conversions and restricted utilization caps.'}
                </p>
              </div>
              {perms.canManageGrantsAndBudget && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowGrantForm(!showGrantForm)}
                >
                  <Plus size={14} />
                  {showGrantForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Ongeraho Inkunga' : 'Register Grant')}
                </button>
              )}
            </div>

            {/* Register Grant Form */}
            {showGrantForm && perms.canManageGrantsAndBudget && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const donorName = String(fd.get('donorName') || '').trim();
                  const grantCode = String(fd.get('grantCode') || '').trim();
                  const title = String(fd.get('title') || '').trim();
                  const currency = String(fd.get('currency') || 'RWF');
                  const originalAmount = Number(fd.get('originalAmount') || 50000000);
                  const exchangeRateRwf = Number(fd.get('exchangeRateRwf') || 1);
                  const receivedAmountRwf = Number(fd.get('receivedAmountRwf') || originalAmount * exchangeRateRwf);
                  const conditionsNote = String(fd.get('conditionsNote') || 'Restricted to approved program budget lines.');

                  handleAction(
                    {
                      action: 'createNgoGrant',
                      programId,
                      donorName,
                      grantCode,
                      title,
                      currency,
                      originalAmount,
                      exchangeRateRwf,
                      receivedAmountRwf,
                      conditionsNote,
                    },
                    isRw ? 'Inkunga nshya yanditswe neza!' : 'New donor grant registered successfully!'
                  );
                  setShowGrantForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kwandika Inkunga Nshya y’Umuterankunga' : 'Register New Institutional Grant'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina ry’Umuterankunga:' : 'Donor Name:'}</label>
                    <input className={s.formInput} name="donorName" required placeholder="e.g. Rwanda Innovation & Finance Trust" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umutwe w’Inkunga:' : 'Grant Title:'}</label>
                    <input className={s.formInput} name="title" required placeholder="e.g. Grassroots Digital Bookkeeping Program" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Kode y’Inkunga:' : 'Grant Code:'}</label>
                    <input className={s.formInput} name="grantCode" defaultValue={`GRT-${Math.floor(100 + Math.random() * 900)}`} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ifaranga:' : 'Currency:'}</label>
                    <select className={s.formSelect} name="currency">
                      <option value="RWF">RWF (Rwanda Franc)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Amafaranga y’Ibanze:' : 'Original Amount:'}</label>
                    <input className={s.formInput} type="number" name="originalAmount" defaultValue={50000000} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Igipimo cy’Ivunjisha (RWF):' : 'Exchange Rate (RWF):'}</label>
                    <input className={s.formInput} type="number" name="exchangeRateRwf" defaultValue={1} />
                  </div>
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowGrantForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Inkunga' : 'Save Grant'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.kpiGrid}>
              {grants.map((g) => (
                <div key={g.id} className={s.card} style={{ gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`${s.statusBadge} ${s.statusReviewed}`}>{g.grantCode}</span>
                    <span className={`${s.statusBadge} ${s.statusApproved}`}>{g.status}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{g.donorName}</h3>
                  <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>{g.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span>
                      <b>{isRw ? 'Ifaranga / Amafaranga:' : 'Award Currency:'}</b> {g.currency} {g.originalAmount.toLocaleString()}
                      {g.currency !== 'RWF' && ` (Rate: ${g.exchangeRateRwf})`}
                    </span>
                    <span><b>{isRw ? 'Agaciro muri RWF:' : 'Award RWF:'}</b> {money(g.awardAmountRwf)}</span>
                    <span><b>{isRw ? 'Yakiriwe muri RWF:' : 'Received RWF:'}</b> {money(g.receivedAmountRwf)}</span>
                    <span><b>{isRw ? 'Yishyuwe kugeza ubu:' : 'Confirmed Paid:'}</b> {money(g.confirmedPaidRwf)}</span>
                    <span style={{ color: '#1f8a5b', fontWeight: 700 }}>
                      <b>{isRw ? 'Isalido Isigaye:' : 'Restricted Balance:'}</b> {money(g.remainingBudgetRwf)}
                    </span>
                    <span><b>{isRw ? 'Raporo Itaha:' : 'Next Report Due:'}</b> {g.nextReportDue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Budget Lines & Utilization Bars */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <FileText size={20} color="#2463A6" />
                  {isRw ? 'Imirongo y’Ingengo y’Imari (Restricted Budget Lines)' : 'Restricted Budget Lines & Utilization'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw ? 'Imirongo y’ingengo ifatika ijyanye n’amabwiriza y’umuterankunga.' : 'Budget categories strictly controlled against over-allocation.'}
                </p>
              </div>
              {perms.canManageGrantsAndBudget && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowBudgetLineForm(!showBudgetLineForm)}
                >
                  <Plus size={14} />
                  {showBudgetLineForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Ongeraho Umurongo' : 'Add Budget Line')}
                </button>
              )}
            </div>

            {/* Add Budget Line Form */}
            {showBudgetLineForm && perms.canManageGrantsAndBudget && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const grantId = String(fd.get('grantId') || grants[0]?.id || 'grant-rift-2026');
                  const category = String(fd.get('category') || 'savings_group_capacity');
                  const lineCode = String(fd.get('lineCode') || '').trim();
                  const description = String(fd.get('description') || '').trim();
                  const allocatedAmount = Number(fd.get('allocatedAmount') || 5000000);

                  handleAction(
                    {
                      action: 'createNgoBudgetLine',
                      programId,
                      grantId,
                      category,
                      lineCode,
                      description,
                      allocatedAmount,
                    },
                    isRw ? 'Umurongo w’ingengo washyizweho neza!' : 'Budget line added successfully!'
                  );
                  setShowBudgetLineForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kurema Umurongo w’Ingengo y’Imari' : 'Create Grant Budget Line'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Inkunga:' : 'Parent Grant:'}</label>
                    <select className={s.formSelect} name="grantId">
                      {grants.map((g) => (
                        <option key={g.id} value={g.id}>{g.grantCode} - {g.donorName}</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Icyiciro:' : 'Category:'}</label>
                    <input className={s.formInput} name="category" defaultValue="savings_group_capacity" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Kode y’Umurongo:' : 'Line Code:'}</label>
                    <input className={s.formInput} name="lineCode" defaultValue={`BL-${Math.floor(100 + Math.random() * 900)}`} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Amafaranga Yagenwe (RWF):' : 'Allocated Amount (RWF):'}</label>
                    <input className={s.formInput} type="number" name="allocatedAmount" defaultValue={8000000} />
                  </div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ibisobanuro by’Umurongo:' : 'Description:'}</label>
                  <input className={s.formInput} name="description" required placeholder="e.g. Training venue, facilitators and participant transportation" />
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowBudgetLineForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Umurongo' : 'Save Budget Line'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Kode' : 'Code'}</th>
                    <th>{isRw ? 'Ibisobanuro & Icyiciro' : 'Description & Category'}</th>
                    <th>{isRw ? 'Yagenwe' : 'Allocated'}</th>
                    <th>{isRw ? 'Yiyemejwe' : 'Committed'}</th>
                    <th>{isRw ? 'Yishyuwe' : 'Spent'}</th>
                    <th>{isRw ? 'Isigaye' : 'Remaining'}</th>
                    <th>{isRw ? 'Imikoreshereze' : 'Utilization'}</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetLines.map((bl) => {
                    const pct = bl.allocatedAmount > 0 ? Math.round((bl.spentAmount / bl.allocatedAmount) * 100) : 0;
                    return (
                      <tr key={bl.id}>
                        <td><b>{bl.lineCode}</b></td>
                        <td>
                          {bl.description}
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{bl.category}</div>
                        </td>
                        <td>{money(bl.allocatedAmount)}</td>
                        <td>{money(bl.committedAmount)}</td>
                        <td><b>{money(bl.spentAmount)}</b></td>
                        <td style={{ color: '#1f8a5b', fontWeight: 700 }}>{money(bl.remainingAmount)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className={s.progressBar} style={{ width: '80px' }}>
                              <div
                                className={`${s.progressFill} ${pct > 90 ? s.progressFillWarning : s.progressFillSuccess}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!budgetLines.length && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta mirongo y’ingengo y’imari irandikwa.' : 'No budget lines recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4-Step NGO Expense Approval & Disbursement Queue */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <CheckCircle2 size={20} color="#2463A6" />
                  {isRw ? 'Urugendo rwo Kwemeza Amafaranga (4-Step Expense Approval & Disbursement)' : '4-Step NGO Expense Approval & Disbursement Queue'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? '1. Gusaba (Field) → 2. Isuzuma rya Gahunda → 3. Kwemeza kw’Imari → 4. Kwemeza Ubwishyu (MoMo/Bank)'
                    : '1. Proposed → 2. Program Reviewed → 3. Finance Approved → 4. Paid with Disbursement Ref'}
                </p>
              </div>
              <button
                type="button"
                className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                onClick={() => setShowExpenseForm(!showExpenseForm)}
              >
                <Plus size={14} />
                {showExpenseForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Saba Amafaranga' : 'Propose Expense')}
              </button>
            </div>

            {/* 4-Step Visual Tracker Bar */}
            <div className={s.stepTracker}>
              <div className={s.stepItem}>
                <div className={`${s.stepDot} ${s.stepDotActive}`}>1</div>
                <span className={s.stepLabel}>{isRw ? '1. Gusaba' : '1. Proposed'}</span>
              </div>
              <div className={s.stepItem}>
                <div className={`${s.stepDot} ${s.stepDotActive}`}>2</div>
                <span className={s.stepLabel}>{isRw ? '2. Gahunda' : '2. Program Review'}</span>
              </div>
              <div className={s.stepItem}>
                <div className={`${s.stepDot} ${s.stepDotActive}`}>3</div>
                <span className={s.stepLabel}>{isRw ? '3. Imari' : '3. Finance Sign-off'}</span>
              </div>
              <div className={s.stepItem}>
                <div className={`${s.stepDot} ${s.stepDotCompleted}`}>4</div>
                <span className={s.stepLabel}>{isRw ? '4. Kwishyura' : '4. Confirmed Paid'}</span>
              </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['all', 'proposed', 'program_reviewed', 'finance_approved', 'paid'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`${s.button} ${s.buttonSmall} ${expenseFilter === st ? s.buttonPrimary : s.buttonOutline}`}
                  onClick={() => setExpenseFilter(st)}
                >
                  {st === 'all'
                    ? isRw ? 'Byose' : 'All Expenses'
                    : st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Propose Expense Form */}
            {showExpenseForm && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const grantId = String(fd.get('grantId') || grants[0]?.id || 'grant-rift-2026');
                  const budgetLineId = String(fd.get('budgetLineId') || budgetLines[0]?.id || 'bl-101');
                  const title = String(fd.get('title') || '').trim();
                  const category = String(fd.get('category') || 'savings_group_capacity');
                  const vendorName = String(fd.get('vendorName') || '').trim();
                  const amount = Number(fd.get('amount') || 100000);
                  const receiptUrl = String(fd.get('receiptUrl') || '').trim();
                  const description = String(fd.get('description') || '').trim();

                  handleAction(
                    {
                      action: 'requestNgoExpense',
                      programId,
                      grantId,
                      budgetLineId,
                      title,
                      category,
                      vendorName,
                      amount,
                      receiptUrl,
                      description,
                    },
                    isRw ? 'Ubusabe bw’amafaranga bwakiriwe neza!' : 'Expense proposal submitted successfully!'
                  );
                  setShowExpenseForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Gusaba Amafaranga ya Gahunda (Step 1)' : 'Propose Program Expense (Step 1)'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umutwe w’Ikiguzi:' : 'Expense Title:'}</label>
                    <input className={s.formInput} name="title" required placeholder="e.g. Facilitator transport & workshop catering" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Amafaranga (RWF):' : 'Amount (RWF):'}</label>
                    <input className={s.formInput} type="number" name="amount" defaultValue={450000} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umurongo w’Ingengo:' : 'Budget Line:'}</label>
                    <select className={s.formSelect} name="budgetLineId">
                      {budgetLines.map((bl) => (
                        <option key={bl.id} value={bl.id}>{bl.lineCode} · {bl.description} ({money(bl.remainingAmount)} left)</option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina rya Rwiyemezamirimo:' : 'Vendor Name:'}</label>
                    <input className={s.formInput} name="vendorName" placeholder="e.g. Kigali Conference Logistics Ltd" />
                  </div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ibisobanuro:' : 'Description:'}</label>
                  <input className={s.formInput} name="description" placeholder="Milestone support for district governance clinic" />
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowExpenseForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Ohereza Ubusabe' : 'Submit Proposal'}
                  </button>
                </div>
              </form>
            )}

            {/* Expenses List */}
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Ikiguzi' : 'Expense & Vendor'}</th>
                    <th>{isRw ? 'Amafaranga' : 'Amount'}</th>
                    <th>{isRw ? 'Ubusabe / Isuzuma' : 'Requested / Reviewed'}</th>
                    <th>{isRw ? 'Imimerere' : 'Workflow Stage'}</th>
                    <th>{isRw ? 'Icyemezo & Ubwishyu' : 'Actions & Confirmation'}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses
                    .filter((e) => expenseFilter === 'all' || e.status === expenseFilter)
                    .map((exp) => (
                      <tr key={exp.id}>
                        <td>
                          <b>{exp.title}</b>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {exp.vendorName || 'Direct Field'} · {exp.category}
                          </div>
                        </td>
                        <td>
                          <b style={{ fontSize: '0.95rem' }}>{money(exp.amount)}</b>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                            <div><b>Req:</b> {exp.requestedBy}</div>
                            {exp.reviewedBy && <div><b>Rev:</b> {exp.reviewedBy}</div>}
                            {exp.approvedBy && <div><b>App:</b> {exp.approvedBy}</div>}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${s.statusBadge} ${
                              exp.status === 'paid'
                                ? s.statusApproved
                                : exp.status === 'finance_approved'
                                ? s.statusReviewed
                                : exp.status === 'program_reviewed'
                                ? s.statusSubmitted
                                : s.statusWarning
                            }`}
                          >
                            {exp.status.replace(/_/g, ' ')}
                          </span>
                          {exp.paymentReference && (
                            <div style={{ fontSize: '0.7rem', color: '#1f8a5b', fontWeight: 600 }}>
                              {exp.paymentReference}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {/* Step 2 Review */}
                            {perms.canApproveExpenses && exp.status === 'proposed' && (
                              <button
                                type="button"
                                className={`${s.button} ${s.buttonSecondary} ${s.buttonSmall}`}
                                onClick={() =>
                                  handleAction(
                                    { action: 'reviewNgoExpense', expenseId: exp.id },
                                    isRw ? 'Ikiguzi cyasuzumwe na gahunda!' : 'Expense milestone reviewed by Program Manager!'
                                  )
                                }
                                disabled={busy || isPending}
                              >
                                {isRw ? '2. Isuzuma rya Gahunda' : 'Step 2: Program Review'}
                              </button>
                            )}

                            {/* Step 3 Finance Approve */}
                            {perms.canApproveExpenses &&
                              (exp.status === 'proposed' || exp.status === 'program_reviewed') && (
                                <button
                                  type="button"
                                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                                  onClick={() =>
                                    handleAction(
                                      { action: 'approveNgoExpense', expenseId: exp.id },
                                      isRw ? 'Ikiguzi cyemejwe n’ubuyobozi bw’imari!' : 'Expense finance-approved against budget line!'
                                    )
                                  }
                                  disabled={busy || isPending}
                                >
                                  {isRw ? '3. Kwemeza kw’Imari' : 'Step 3: Finance Approve'}
                                </button>
                              )}

                            {/* Step 4 Confirm Payment */}
                            {perms.canConfirmPayments && exp.status === 'finance_approved' && (
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <input
                                  className={s.formInput}
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: '130px' }}
                                  placeholder="MOMO/EFT Ref"
                                  value={paymentRefInput[exp.id] || ''}
                                  onChange={(e) =>
                                    setPaymentRefInput({ ...paymentRefInput, [exp.id]: e.target.value })
                                  }
                                />
                                <button
                                  type="button"
                                  className={`${s.button} ${s.buttonSuccess} ${s.buttonSmall}`}
                                  onClick={() =>
                                    handleAction(
                                      {
                                        action: 'confirmNgoExpensePayment',
                                        expenseId: exp.id,
                                        paymentReference: paymentRefInput[exp.id] || `MOMO-NGO-DISB-${Math.floor(1000 + Math.random() * 9000)}`,
                                      },
                                      isRw ? 'Ubwishyu bwashyizwe mu gitabo cy’imari!' : 'Payment confirmed and posted to budget line!'
                                    )
                                  }
                                  disabled={busy || isPending}
                                >
                                  {isRw ? '4. Emeza Ubwishyu' : 'Step 4: Confirm Paid'}
                                </button>
                              </div>
                            )}

                            {exp.status === 'paid' && (
                              <span style={{ fontSize: '0.75rem', color: '#1f8a5b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Check size={12} /> {isRw ? 'Ubwishyu bwarangije' : 'Reconciled & Paid'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!expenses.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta busabe bw’amafaranga burandikwa.' : 'No expense records found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 5: GROUPS, COOPS & NISR FINSCOPE MAP */}
      {activeTab === 'groups_coops_map' && (
        <section className={s.tabContent}>
          {/* Statutory Privacy Safeguard Notice */}
          <div className={s.privacyBox}>
            <ShieldCheck size={20} color="#1F8A5B" style={{ flexShrink: 0 }} />
            <div>
              <b>{isRw ? 'Umutekano w’Amakuru y’Abaturage (Privacy Protection Notice):' : 'Community Member Privacy Protection Safeguard:'}</b>{' '}
              {isRw
                ? 'Sisitemu igaragaza gusa imibare rusange y’amatsinda na koperative. Nta burenganzira bw’ikigo bwo kubona amakuru y’inguzanyo z’umuntu ku giti cye cyangwa agatabo ke k’ubwizigame mu itsinda.'
                : 'Only group-level operational aggregates, reserve ratios, and governance health indicators are visible to institutional NGO viewers. Individual member passbooks, personal savings records, and household loan ledger entries remain strictly confidential to local group members.'}
            </div>
          </div>

          {/* Live Linked HURIZA Organizations */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Landmark size={20} color="#2463A6" />
                  {isRw ? 'Imiryango n’Amatsinda Bishyigikiwe (Supported HURIZA Organizations)' : 'Live Linked HURIZA Organizations (Itsinda · Ikimina · Cooperatives)'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Amatsinda 80 n’amashyirahamwe 12 akoresha sisitemu ya HURIZA mu buryo butanga umutekano w’imari.'
                    : 'Real-time operational aggregates across accumulating savings groups (Itsinda), rotating groups (Ikimina), and primary cooperatives.'}
                </p>
              </div>
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Umuryango' : 'Organization'}</th>
                    <th>{isRw ? 'Ubwoko' : 'Model'}</th>
                    <th>{isRw ? 'Akarere' : 'District'}</th>
                    <th>{isRw ? 'Abanyamuryango' : 'Members'}</th>
                    <th>{isRw ? 'Ubwizigame / Imigabane' : 'Aggregate Savings / Capital'}</th>
                    <th>{isRw ? 'Ubuzima bw’Ikigega' : 'Reserve Health'}</th>
                    <th>{isRw ? 'Imiyoborere' : 'Governance Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedEntities.map((ent) => (
                    <tr key={ent.orgId}>
                      <td>
                        <b>{ent.name}</b>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{ent.orgId}</div>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            ent.entityType === 'cooperative'
                              ? s.statusReviewed
                              : ent.entityType === 'ikimina_rotating_group'
                              ? s.statusSubmitted
                              : s.statusApproved
                          }`}
                        >
                          {ent.entityType === 'itsinda_savings_group'
                            ? 'Itsinda (Accumulating)'
                            : ent.entityType === 'ikimina_rotating_group'
                            ? 'Ikimina (Rotating)'
                            : 'Cooperative'}
                        </span>
                      </td>
                      <td>{ent.district}</td>
                      <td>{ent.memberCount}</td>
                      <td><b>{money(ent.aggregateSavingsOrCapitalRwf)}</b></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div className={s.progressBar} style={{ width: '60px' }}>
                            <div
                              className={`${s.progressFill} ${ent.reserveHealthPercent < 15 ? s.progressFillWarning : s.progressFillSuccess}`}
                              style={{ width: `${Math.min(ent.reserveHealthPercent * 3, 100)}%` }}
                            />
                          </div>
                          <span>{ent.reserveHealthPercent}%</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            ent.governanceStatus === 'verified_healthy'
                              ? s.statusApproved
                              : s.statusWarning
                          }`}
                        >
                          {ent.governanceStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Also show legacy impact organizations if not duplicated */}
                  {legacyImpact.organizations
                    ?.filter((o) => !linkedEntities.some((le) => le.orgId === o.id))
                    .map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.name}</b>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{o.id}</div>
                        </td>
                        <td>
                          <span className={`${s.statusBadge} ${s.statusApproved}`}>Itsinda (Demo)</span>
                        </td>
                        <td>{o.district}</td>
                        <td>{o.members}</td>
                        <td><b>{money(o.savings)}</b></td>
                        <td>
                          <span className={`${s.statusBadge} ${s.statusApproved}`}>20%</span>
                        </td>
                        <td>
                          <span className={`${s.statusBadge} ${s.statusApproved}`}>{o.reportingStatus}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rwanda District Financial Inclusion Context Table (NISR FinScope Benchmark) */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <MapPin size={20} color="#2463A6" />
                  {isRw ? 'Ubushishozi ku Turere: Intego n’Amakuru ya NISR FinScope' : 'Rwanda District Financial Inclusion Context (NISR FinScope / EICV)'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Kugereranya ibikorwa bya gahunda n’ibipimo ngenderwaho by’igihugu bya NISR FinScope.'
                    : 'Pairing CGI Rwanda monitoring telemetry alongside official NISR FinScope & EICV district statistics with source separation.'}
                </p>
              </div>
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Akarere / Intara' : 'District & Province'}</th>
                    <th>{isRw ? 'Amatsinda / Koperative' : 'CGI Groups / Coops'}</th>
                    <th>{isRw ? 'Abaturage Bagezweho' : 'Enrolled Members'}</th>
                    <th>{isRw ? 'Amafaranga Yemejwe' : 'Confirmed Disbursements'}</th>
                    <th>{isRw ? 'NISR Formal Inclusion' : 'NISR Formal Inclusion'}</th>
                    <th>{isRw ? 'NISR Informal Savings' : 'NISR Informal Savings'}</th>
                    <th>{isRw ? 'NISR Poverty Headcount' : 'NISR Poverty Headcount'}</th>
                    <th>{isRw ? 'Icyiciro cy’Ibyihutirwa' : 'Priority Level'}</th>
                  </tr>
                </thead>
                <tbody>
                  {districtContexts.map((dc) => (
                    <tr key={dc.district}>
                      <td>
                        <b>{dc.district}</b>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{dc.province}</div>
                      </td>
                      <td>
                        {dc.programGroupsSupported} {isRw ? 'amatsinda' : 'groups'} · {dc.programCooperativesSupported} coops
                      </td>
                      <td><b>{dc.programParticipantsEnrolled.toLocaleString()}</b></td>
                      <td>{money(dc.programConfirmedDisbursementsRwf)}</td>
                      <td>
                        <span className={s.statusBadge} style={{ background: '#eaf3fe', color: '#2463a6' }}>
                          {dc.nisrFinScopeFormalInclusionPct}%
                        </span>
                      </td>
                      <td>
                        <span className={s.statusBadge} style={{ background: '#e8f7ee', color: '#1f8a5b' }}>
                          {dc.nisrFinScopeInformalSavingsUsagePct}%
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            dc.nisrEicvPovertyHeadcountPct > 35 ? s.statusWarning : s.statusSubmitted
                          }`}
                        >
                          {dc.nisrEicvPovertyHeadcountPct}%
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            dc.contextPriorityLevel === 'high_priority_rural'
                              ? s.statusCritical
                              : dc.contextPriorityLevel === 'peri_urban_growth'
                              ? s.statusReviewed
                              : s.statusApproved
                          }`}
                        >
                          {dc.contextPriorityLevel.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 6: BENEFICIARY COHORTS & SAFEGUARDING CENTER */}
      {activeTab === 'beneficiaries' && (
        <section className={s.tabContent}>
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Users size={20} color="#2463A6" />
                  {isRw ? 'Icyiciro cy’Abagenerwabikorwa n’Umutekano (Beneficiary Cohorts & Safeguarding)' : 'Beneficiary Cohorts & Safeguarding Center'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Abagenerwabikorwa bose babitswe mu matsinda no mu byiciro bibarinda kuvukirengera amakuru bwite.'
                    : 'Participant clusters disaggregated by gender and youth, adhering to informed consent and safeguarding confidentiality.'}
                </p>
              </div>
              {perms.canSubmitFieldData && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowCohortForm(!showCohortForm)}
                >
                  <Plus size={14} />
                  {showCohortForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Injiza Icyiciro Gishya' : 'Enroll Cohort')}
                </button>
              )}
            </div>

            {/* Enroll Cohort Form */}
            {showCohortForm && perms.canSubmitFieldData && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const name = String(fd.get('name') || '').trim();
                  const cohortCode = String(fd.get('cohortCode') || `COH-${Math.floor(100 + Math.random() * 900)}`).trim();
                  const cohortType = String(fd.get('cohortType') || 'savings_group_itsinda');
                  const district = String(fd.get('district') || 'Gasabo');
                  const sector = String(fd.get('sector') || 'Kimironko');
                  const linkedOrgId = String(fd.get('linkedOrgId') || 'group-ubumwe');
                  const householdsCount = Number(fd.get('householdsCount') || 30);
                  const participantsCount = Number(fd.get('participantsCount') || 30);
                  const femaleCount = Number(fd.get('femaleCount') || 22);
                  const youthCount = Number(fd.get('youthCount') || 14);
                  const safeguardingLevel = String(fd.get('safeguardingLevel') || 'standard');
                  const notes = String(fd.get('notes') || '').trim();

                  handleAction(
                    {
                      action: 'enrollNgoBeneficiaryCohort',
                      programId,
                      name,
                      cohortCode,
                      cohortType,
                      district,
                      sector,
                      linkedOrgId,
                      householdsCount,
                      participantsCount,
                      femaleCount,
                      youthCount,
                      safeguardingLevel,
                      notes,
                    },
                    isRw ? 'Icyiciro cy’abagenerwabikorwa cyanditswe neza!' : 'Beneficiary cohort enrolled successfully!'
                  );
                  setShowCohortForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kwandika Icyiciro Gishya cy’Abagenerwabikorwa' : 'Enroll New Beneficiary Cohort'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina ry’Icyiciro:' : 'Cohort Name:'}</label>
                    <input className={s.formInput} name="name" required placeholder="e.g. Gasabo Eastern Women VSL Network" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ubwoko:' : 'Cohort Type:'}</label>
                    <select className={s.formSelect} name="cohortType">
                      <option value="savings_group_itsinda">Itsinda Accumulating Savings Group Network</option>
                      <option value="savings_group_ikimina">Ikimina Rotating Savings ROSCA Cluster</option>
                      <option value="cooperative">Primary Cooperative Network</option>
                      <option value="women_collective">Women Economic Collective</option>
                      <option value="youth_enterprise">Youth Enterprise & Savings Cohort</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Akarere:' : 'District:'}</label>
                    <input className={s.formInput} name="district" defaultValue="Gasabo" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umurenge:' : 'Sector:'}</label>
                    <input className={s.formInput} name="sector" defaultValue="Kimironko" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Itsinda Rifatika (HURIZA Org):' : 'Linked Org ID:'}</label>
                    <input className={s.formInput} name="linkedOrgId" defaultValue="group-ubumwe" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ingo Zose:' : 'Households Count:'}</label>
                    <input className={s.formInput} type="number" name="householdsCount" defaultValue={30} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Abanyamuryango Bose:' : 'Participants Count:'}</label>
                    <input className={s.formInput} type="number" name="participantsCount" defaultValue={32} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Abagore:' : 'Female Count:'}</label>
                    <input className={s.formInput} type="number" name="femaleCount" defaultValue={24} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Urubyiruko (<30):' : 'Youth Count (<30):'}</label>
                    <input className={s.formInput} type="number" name="youthCount" defaultValue={16} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Urwego rw’Umutekano:' : 'Safeguarding Level:'}</label>
                    <select className={s.formSelect} name="safeguardingLevel">
                      <option value="standard">Standard Institutional Privacy</option>
                      <option value="protected_youth">Protected Youth Protocols (Enhanced Consent)</option>
                      <option value="high_confidentiality">High Confidentiality Anonymization</option>
                    </select>
                  </div>
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowCohortForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Icyiciro' : 'Save Cohort'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Icyiciro / Kode' : 'Cohort & Code'}</th>
                    <th>{isRw ? 'Akarere / Umurenge' : 'District & Sector'}</th>
                    <th>{isRw ? 'Ingo / Abaturage' : 'Households / Members'}</th>
                    <th>{isRw ? 'Ibyiciro (Disaggregation)' : 'Disaggregation'}</th>
                    <th>{isRw ? 'Urwego rw’Umutekano' : 'Safeguarding Level'}</th>
                    <th>{isRw ? 'Ubwumvikane' : 'Consent Basis'}</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => {
                    const femalePct = c.participantsCount > 0 ? Math.round((c.femaleCount / c.participantsCount) * 100) : 0;
                    const youthPct = c.participantsCount > 0 ? Math.round((c.youthCount / c.participantsCount) * 100) : 0;
                    return (
                      <tr key={c.id}>
                        <td>
                          <b>{c.name}</b>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {c.cohortCode} · {c.cohortType.replace(/_/g, ' ')}
                          </div>
                        </td>
                        <td>{c.district} ({c.sector})</td>
                        <td>
                          <b>{c.participantsCount}</b> {isRw ? 'abaturage' : 'members'}
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.householdsCount} households</div>
                        </td>
                        <td>
                          <div className={s.chipContainer}>
                            <span className={s.chip}>{c.femaleCount} Female ({femalePct}%)</span>
                            <span className={s.chip}>{c.youthCount} Youth ({youthPct}%)</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${s.statusBadge} ${
                              c.safeguardingLevel === 'standard'
                                ? s.statusApproved
                                : c.safeguardingLevel === 'protected_youth'
                                ? s.statusReviewed
                                : s.statusWarning
                            }`}
                          >
                            <Lock size={11} /> {c.safeguardingLevel.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`${s.statusBadge} ${s.statusSubmitted}`}>{c.consentBasis}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!cohorts.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta byiciro by’abagenerwabikorwa birandikwa.' : 'No cohorts enrolled yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 7: FIELD OPERATIONS & MOBILE SURVEY STUDIO */}
      {activeTab === 'field_ops' && (
        <section className={s.tabContent}>
          {/* Offline Sync Banner if any */}
          {offlineVisitsCount > 0 && (
            <div className={`${s.card} ${s.guardianCardWarning}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <WifiOff size={24} color="#C57B17" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                      {isRw ? 'Raporo zo mu Murima Zibitswe Muri Telefoni (Offline Queue)' : 'Field Surveys Queued Offline'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: '#475569' }}>
                      {isRw
                        ? `Ufite raporo ${offlineVisitsCount} zibitswe muri telefoni zitegereje koherezwa kuri seriveri.`
                        : `You have ${offlineVisitsCount} field surveys saved in offline mobile storage ready for institutional sync.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${s.button} ${s.buttonSuccess}`}
                  onClick={() =>
                    handleAction(
                      { action: 'syncOfflineFieldVisits' },
                      isRw ? 'Raporo zose zo mu murima zashyizwe muri seriveri!' : 'Offline field surveys synced and submitted to MEAL!'
                    )
                  }
                  disabled={busy || isPending}
                >
                  <RefreshCw size={14} />
                  {isRw ? 'Kwandukura ubu (Sync Now)' : 'Sync Offline Queue Now'}
                </button>
              </div>
            </div>
          )}

          {/* Survey Studio Container (Form + Phone Preview) */}
          <div className={s.surveyContainer}>
            {/* Structured Survey Form */}
            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardHeaderTitle}>
                  <h2 className={s.cardTitle}>
                    <Smartphone size={20} color="#2463A6" />
                    {isRw ? 'Kwandika Raporo yo mu Murima (Field Survey Studio)' : 'Mobile-First Structured Field Survey Studio'}
                  </h2>
                  <p className={s.cardSubtitle}>
                    {isRw
                      ? 'Inyandiko y’isuzuma ry’amatsinda, koperative, cyangwa amahugurwa mu buryo bwa mobile.'
                      : 'Capture structured field monitoring records online or in simulated offline queue mode.'}
                  </p>
                </div>

                {/* Mode Selector */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className={`${s.button} ${s.buttonSmall} ${surveyMode === 'synced' ? s.buttonPrimary : s.buttonOutline}`}
                    onClick={() => setSurveyMode('synced')}
                  >
                    <Wifi size={13} /> {isRw ? 'Kuri Murandasi' : 'Live Online'}
                  </button>
                  <button
                    type="button"
                    className={`${s.button} ${s.buttonSmall} ${surveyMode === 'queued_offline' ? s.buttonWarning : s.buttonOutline}`}
                    onClick={() => setSurveyMode('queued_offline')}
                  >
                    <WifiOff size={13} /> {isRw ? 'Nta Murandasi' : 'Queue Offline'}
                  </button>
                </div>
              </div>

              <form
                className={s.formGrid}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const activityId = String(fd.get('activityId') || activities[0]?.id || 'act-101');
                  const district = String(fd.get('district') || 'Gasabo');
                  const sector = String(fd.get('sector') || 'Kimironko');
                  const communityName = String(fd.get('communityName') || `${sector} Community Center`);
                  const formType = String(fd.get('formType') || 'savings_group_monitoring');
                  const purpose = String(fd.get('purpose') || '').trim();
                  const attendeesCount = Number(fd.get('attendeesCount') || 25);
                  const observations = String(fd.get('observations') || '').trim();
                  const outcomesRecorded = String(fd.get('outcomesRecorded') || '').trim();
                  const followUpNeeded = String(fd.get('followUpNeeded') || '').trim();
                  const evidenceAttachment = String(fd.get('evidenceAttachment') || '').trim();

                  handleAction(
                    {
                      action: 'submitNgoFieldVisit',
                      programId,
                      activityId,
                      district,
                      sector,
                      communityName,
                      formType,
                      purpose,
                      attendeesCount,
                      observations,
                      outcomesRecorded,
                      followUpNeeded,
                      evidenceAttachment,
                      syncStatus: surveyMode,
                    },
                    isRw
                      ? surveyMode === 'queued_offline'
                        ? 'Raporo yabitswe muri telefoni (Offline)!'
                        : 'Raporo yo mu murima yoherejwe neza!'
                      : surveyMode === 'queued_offline'
                      ? 'Field visit saved to local offline queue!'
                      : 'Field visit survey submitted to server!'
                  );
                }}
              >
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ubwoko bw’Isuzuma (Form Template):' : 'Survey Template:'}</label>
                  <select className={s.formSelect} name="formType">
                    <option value="savings_group_monitoring">Savings Group Monitoring Visit</option>
                    <option value="cooperative_support_visit">Cooperative Support & Governance Visit</option>
                    <option value="training_attendance">Training Attendance & Capacity Session</option>
                    <option value="group_registration">Group Registration & Baseline Visit</option>
                    <option value="beneficiary_enrollment">Beneficiary Enrollment Intake</option>
                    <option value="follow_up_assessment">Follow-up & Outcome Assessment</option>
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Intego y’Uruzinduko:' : 'Visit Purpose:'}</label>
                  <input className={s.formInput} name="purpose" required placeholder="e.g. Post-training digital bookkeeping audit" />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Akarere:' : 'District:'}</label>
                  <input className={s.formInput} name="district" defaultValue="Gasabo" />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Umurenge:' : 'Sector:'}</label>
                  <input className={s.formInput} name="sector" defaultValue="Kimironko" />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Ahantu / Umuryango:' : 'Community / Site Name:'}</label>
                  <input className={s.formInput} name="communityName" defaultValue="Ubumwe Center" />
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Abitabiriye:' : 'Attendees Count:'}</label>
                  <input className={s.formInput} type="number" name="attendeesCount" defaultValue={28} />
                </div>

                <div className={s.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label className={s.formLabel}>{isRw ? 'Ibyo Wabonye mu Murima (Observations):' : 'Key Field Observations:'}</label>
                  <textarea className={s.formTextarea} name="observations" rows={2} defaultValue="Treasurer reconciled all physical passbooks with HURIZA USSD demo wallet; zero discrepancies." />
                </div>

                <div className={s.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label className={s.formLabel}>{isRw ? 'Umusaruro Wabonetse (Outcomes):' : 'Outcomes Recorded:'}</label>
                  <textarea className={s.formTextarea} name="outcomesRecorded" rows={2} defaultValue="Group voted to increase emergency reserve contribution from 200 RWF to 500 RWF per meeting." />
                </div>

                <div className={s.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label className={s.formLabel}>{isRw ? 'Icyo gukurikiranaho (Follow Up Needed):' : 'Follow Up Needed:'}</label>
                  <input className={s.formInput} name="followUpNeeded" defaultValue="Review next cycle share-out plan in Q3." />
                </div>

                <div className={s.formActions} style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    <Smartphone size={14} />
                    {isRw
                      ? surveyMode === 'queued_offline'
                        ? 'Bika muri Telefoni (Queue Offline)'
                        : 'Ohereza Raporo (Submit Survey)'
                      : surveyMode === 'queued_offline'
                      ? 'Queue Offline Survey'
                      : 'Submit Live Survey'}
                  </button>
                </div>
              </form>
            </div>

            {/* Mobile Phone Simulation Preview */}
            <div className={s.phonePreview}>
              <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                HURIZA FIELD AGENT OS
              </div>
              <div className={s.phoneScreen}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: '#2463a6' }}>SURVEY FORM</span>
                  <span>{surveyMode === 'synced' ? '4G ONLINE' : 'OFFLINE STORE'}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>OFFICER:</div>
                  <b>Solange Mukamana</b>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TEMPLATE:</div>
                  <span className={`${s.statusBadge} ${s.statusReviewed}`}>Savings Group Monitoring</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>LOCATION:</div>
                  <div>Gasabo · Kimironko · Ubumwe</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1f8a5b', fontWeight: 700 }}>VERIFICATION CHECK:</div>
                  <div>✓ Cash box retired</div>
                  <div>✓ Dual approval tested</div>
                  <div>✓ Member passbooks balanced</div>
                </div>
                <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.7rem', color: '#64748b' }}>
                  Encrypted local SQLite / IndexedDB queue
                </div>
              </div>
            </div>
          </div>

          {/* Field Visits Log Table */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <FileText size={20} color="#2463A6" />
                  {isRw ? 'Igitabo cy’Ingendo zo mu Murima (Field Visits Log)' : 'Field Visits & Verification Log'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw ? 'Raporo zose z’abakozi zo mu murima zanditse.' : 'Historical inspection and monitoring records.'}
                </p>
              </div>
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Itariki / Umukozi' : 'Date & Officer'}</th>
                    <th>{isRw ? 'Akarere / Umuryango' : 'Location'}</th>
                    <th>{isRw ? 'Ubwoko' : 'Form Type'}</th>
                    <th>{isRw ? 'Abitabiriye' : 'Attendees'}</th>
                    <th>{isRw ? 'Ibyabonetse' : 'Observations & Outcome'}</th>
                    <th>{isRw ? 'Imimerere y’Ubwiko' : 'Sync Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldVisits.map((fv) => (
                    <tr key={fv.id}>
                      <td>
                        <b>{fv.visitDate}</b>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{fv.officerName}</div>
                      </td>
                      <td>
                        {fv.district} ({fv.sector})
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{fv.communityName}</div>
                      </td>
                      <td>
                        <span className={`${s.statusBadge} ${s.statusReviewed}`}>
                          {fv.formType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td><b>{fv.attendeesCount}</b></td>
                      <td>
                        <div style={{ maxWidth: '280px', fontSize: '0.8rem' }}>
                          <b>{fv.purpose}</b>
                          <p style={{ margin: 0, color: '#475569' }}>{fv.observations}</p>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            fv.syncStatus === 'verified'
                              ? s.statusApproved
                              : fv.syncStatus === 'synced'
                              ? s.statusReviewed
                              : s.statusWarning
                          }`}
                        >
                          {fv.syncStatus === 'queued_offline' ? (
                            <>
                              <WifiOff size={11} /> Queued Offline
                            </>
                          ) : (
                            <>
                              <Check size={11} /> {fv.syncStatus}
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!fieldVisits.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta ngendo zo mu murima zirandikwa.' : 'No field visits recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legacy Intervention Notes (Ensures 100% backward compatibility) */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Activity size={20} color="#2463A6" />
                  {isRw ? 'Inyandiko z’Ibikorwa bya Gahunda (Intervention Notes)' : 'Program Intervention Notes Archive'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Inyandiko z’amateka z’ibikorwa by’uyu muryango muri sisitemu.'
                    : 'Universal audit notes and quick intervention entries.'}
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!interventionText.trim()) return;
                handleAction(
                  { action: 'addIntervention', title: interventionText },
                  isRw ? 'Inyandiko yongewemo neza!' : 'Intervention note recorded!'
                );
                setInterventionText('');
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
            >
              <input
                className={s.formInput}
                style={{ flex: 1, minWidth: '240px' }}
                placeholder={isRw ? 'Andika igikorwa cya gahunda...' : 'Record a program activity or intervention note...'}
                value={interventionText}
                onChange={(e) => setInterventionText(e.target.value)}
              />
              <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                <Plus size={14} />
                {isRw ? 'Ongeraho' : 'Add Note'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {interventions.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{inv.title}</span>
                  <span className={`${s.statusBadge} ${s.statusSubmitted}`}>{isRw ? 'Icyitegererezo' : 'Demo Note'}</span>
                </div>
              ))}
              {!interventions.length && (
                <div className={s.emptyState}>
                  <p>{isRw ? 'Nta nyandiko z’ibikorwa zirandikwa.' : 'No intervention notes recorded yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 8: MEAL RESULTS CHAIN, INDICATORS & DATA QUALITY */}
      {activeTab === 'meal_center' && (
        <section className={s.tabContent}>
          {/* Theory of Change / Results Chain */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <ShieldCheck size={20} color="#2463A6" />
                  {isRw ? 'Urugendo rw’Impinduka (Theory of Change & Results Chain)' : 'Institutional Theory of Change & Results Chain'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Kugenzura intambwe ku yindi: Inkunga (Inputs) → Ibikorwa (Activities) → Ibisubizo (Outputs) → Impinduka (Outcomes) → Umusaruro Rusange (Contextual Impact)'
                    : 'Systematic MEAL tiers aligning field inputs with verifiable outputs and observed resilience outcomes.'}
                </p>
              </div>
            </div>

            {/* Results Chain Interactive Tiers */}
            <div className={s.resultsChainFlow}>
              <div
                className={`${s.resultsChainNode} ${indicatorLevelFilter === 'input' ? s.resultsChainNodeActive : ''}`}
                onClick={() => setIndicatorLevelFilter(indicatorLevelFilter === 'input' ? 'all' : 'input')}
              >
                <span className={s.nodeLevelTitle}>1. Inputs</span>
                <span className={s.nodeCountBadge}>{indicators.filter((i) => i.level === 'input').length}</span>
                <span className={s.nodeDescription}>
                  {isRw ? 'Inkunga, ingengo, n’abakozi' : 'Grants, budget lines, field tablets'}
                </span>
              </div>

              <div
                className={`${s.resultsChainNode} ${indicatorLevelFilter === 'activity' ? s.resultsChainNodeActive : ''}`}
                onClick={() => setIndicatorLevelFilter(indicatorLevelFilter === 'activity' ? 'all' : 'activity')}
              >
                <span className={s.nodeLevelTitle}>2. Activities</span>
                <span className={s.nodeCountBadge}>{indicators.filter((i) => i.level === 'activity').length}</span>
                <span className={s.nodeDescription}>
                  {isRw ? 'Amahugurwa n’ingendo zo mu murima' : 'Clinics, trainings, audits'}
                </span>
              </div>

              <div
                className={`${s.resultsChainNode} ${indicatorLevelFilter === 'output' ? s.resultsChainNodeActive : ''}`}
                onClick={() => setIndicatorLevelFilter(indicatorLevelFilter === 'output' ? 'all' : 'output')}
              >
                <span className={s.nodeLevelTitle}>3. Outputs</span>
                <span className={s.nodeCountBadge}>{indicators.filter((i) => i.level === 'output').length}</span>
                <span className={s.nodeDescription}>
                  {isRw ? 'Amatsinda yanditswe n’abitabiriye' : 'Groups onboarded, members saving'}
                </span>
              </div>

              <div
                className={`${s.resultsChainNode} ${indicatorLevelFilter === 'outcome' ? s.resultsChainNodeActive : ''}`}
                onClick={() => setIndicatorLevelFilter(indicatorLevelFilter === 'outcome' ? 'all' : 'outcome')}
              >
                <span className={s.nodeLevelTitle}>4. Outcomes</span>
                <span className={s.nodeCountBadge}>{indicators.filter((i) => i.level === 'outcome').length}</span>
                <span className={s.nodeDescription}>
                  {isRw ? 'Ubuzima bw’ikigega n’ubwishyu' : 'Reserve ratio (>=15%), on-time repayment'}
                </span>
              </div>

              <div
                className={`${s.resultsChainNode} ${indicatorLevelFilter === 'impact_context' ? s.resultsChainNodeActive : ''}`}
                onClick={() => setIndicatorLevelFilter(indicatorLevelFilter === 'impact_context' ? 'all' : 'impact_context')}
              >
                <span className={s.nodeLevelTitle}>5. Contextual Impact</span>
                <span className={s.nodeCountBadge}>{indicators.filter((i) => i.level === 'impact_context').length}</span>
                <span className={s.nodeDescription}>
                  {isRw ? 'Guhuza n’intego za NISR' : 'NISR district financial inclusion benchmark'}
                </span>
              </div>
            </div>
          </div>

          {/* Indicators Table & Create Indicator Form */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <TrendingUp size={20} color="#2463A6" />
                  {isRw ? 'Ibipimo bya MEAL (Institutional MEAL Indicators)' : 'Institutional MEAL Indicators'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Ibipimo byose bishingiye ku makuru nyayo y’amatsinda bitabeshye ku ngaruka z’ubukungu.'
                    : 'Systematic progress tracking with baseline, target, observed value, and MEAL sign-off.'}
                </p>
              </div>
              {perms.canVerifyMeal && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowIndicatorForm(!showIndicatorForm)}
                >
                  <Plus size={14} />
                  {showIndicatorForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Ongeraho Igipimo' : 'Define Indicator')}
                </button>
              )}
            </div>

            {/* Create Indicator Form */}
            {showIndicatorForm && perms.canVerifyMeal && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const code = String(fd.get('code') || '').trim();
                  const name = String(fd.get('name') || '').trim();
                  const level = String(fd.get('level') || 'output');
                  const unit = String(fd.get('unit') || 'count');
                  const baselineValue = Number(fd.get('baselineValue') || 0);
                  const targetValue = Number(fd.get('targetValue') || 100);
                  const currentValue = Number(fd.get('currentValue') || baselineValue);
                  const methodologyNote = String(fd.get('methodologyNote') || 'Observed program monitoring indicator.').trim();

                  handleAction(
                    {
                      action: 'createNgoIndicator',
                      programId,
                      code,
                      name,
                      level,
                      unit,
                      baselineValue,
                      targetValue,
                      currentValue,
                      methodologyNote,
                    },
                    isRw ? 'Igipimo gishya cya MEAL cyashyizweho!' : 'New MEAL indicator created successfully!'
                  );
                  setShowIndicatorForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Gushyiraho Igipimo Gishya cya MEAL' : 'Define New MEAL Indicator'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Kode y’Igipimo:' : 'Indicator Code:'}</label>
                    <input className={s.formInput} name="code" defaultValue={`IND-${Math.floor(100 + Math.random() * 900)}`} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina ry’Igipimo:' : 'Indicator Name:'}</label>
                    <input className={s.formInput} name="name" required placeholder="e.g. Percentage of active groups with dual-control" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Urwego (Level):' : 'Level:'}</label>
                    <select className={s.formSelect} name="level">
                      <option value="output">Output</option>
                      <option value="outcome">Outcome</option>
                      <option value="activity">Activity</option>
                      <option value="input">Input</option>
                      <option value="impact_context">Contextual Impact</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Igipimo (Unit):' : 'Unit:'}</label>
                    <select className={s.formSelect} name="unit">
                      <option value="count">Count (Count)</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="groups">Groups</option>
                      <option value="cooperatives">Cooperatives</option>
                      <option value="rwf">RWF</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Icyo wahereyeho (Baseline):' : 'Baseline Value:'}</label>
                    <input className={s.formInput} type="number" name="baselineValue" defaultValue={0} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Intego (Target):' : 'Target Value:'}</label>
                    <input className={s.formInput} type="number" name="targetValue" defaultValue={100} />
                  </div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Uburyo bwo Gupima (Methodology Note):' : 'Methodology Note:'}</label>
                  <input className={s.formInput} name="methodologyNote" defaultValue="Aggregated monitoring indicator; does not claim causal econometric impact without control comparison." />
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowIndicatorForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Igipimo' : 'Save Indicator'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Kode / Igipimo' : 'Indicator & Level'}</th>
                    <th>{isRw ? 'Ibyo wahereyeho' : 'Baseline'}</th>
                    <th>{isRw ? 'Intego' : 'Target'}</th>
                    <th>{isRw ? 'Icyagezweho' : 'Current Value'}</th>
                    <th>{isRw ? 'Intambwe' : 'Progress'}</th>
                    <th>{isRw ? 'Isuzuma rya MEAL' : 'Verification'}</th>
                    <th>{isRw ? 'Ibikorwa' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators
                    .filter((ind) => indicatorLevelFilter === 'all' || ind.level === indicatorLevelFilter)
                    .map((ind) => (
                      <tr key={ind.id}>
                        <td>
                          <b>{ind.code}</b> — {ind.name}
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                            <span className={`${s.statusBadge} ${s.statusSubmitted}`}>{ind.level}</span> ·{' '}
                            {ind.responsibleOfficer}
                          </div>
                          {ind.disaggregation && Object.keys(ind.disaggregation).length > 0 && (
                            <div className={s.chipContainer} style={{ marginTop: '0.3rem' }}>
                              {Object.entries(ind.disaggregation).map(([k, v]) => (
                                <span key={k} className={s.chip}>
                                  {k.replace(/_/g, ' ')}: {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{ind.baselineValue}</td>
                        <td><b>{ind.targetValue}</b></td>
                        <td>
                          <b style={{ fontSize: '1rem', color: '#14283f' }}>{ind.currentValue}</b> {ind.unit}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div className={s.progressBar} style={{ width: '70px' }}>
                              <div
                                className={`${s.progressFill} ${
                                  ind.progressPercent >= 100 ? s.progressFillSuccess : ''
                                }`}
                                style={{ width: `${Math.min(ind.progressPercent, 100)}%` }}
                              />
                            </div>
                            <span>{ind.progressPercent}%</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${s.statusBadge} ${
                              ind.verificationStatus === 'approved'
                                ? s.statusApproved
                                : ind.verificationStatus === 'meal_reviewed'
                                ? s.statusReviewed
                                : s.statusWarning
                            }`}
                          >
                            {ind.verificationStatus}
                          </span>
                        </td>
                        <td>
                          {perms.canVerifyMeal && (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                className={s.formInput}
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', width: '60px' }}
                                defaultValue={ind.currentValue}
                                onChange={(e) =>
                                  setIndicatorValueInput({ ...indicatorValueInput, [ind.id]: e.target.value })
                                }
                              />
                              <button
                                type="button"
                                className={`${s.button} ${s.buttonSuccess} ${s.buttonSmall}`}
                                onClick={() =>
                                  handleAction(
                                    {
                                      action: 'verifyNgoIndicator',
                                      indicatorId: ind.id,
                                      currentValue: Number(indicatorValueInput[ind.id] || ind.currentValue),
                                      verificationStatus: 'approved',
                                    },
                                    isRw ? 'Igipimo cyemejwe na MEAL!' : 'Indicator observation verified!'
                                  )
                                }
                                disabled={busy || isPending}
                              >
                                <Check size={12} />
                                {isRw ? 'Emeza' : 'Sign Off'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  {!indicators.length && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta bipimo birandikwa.' : 'No MEAL indicators recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data Quality & Verification Queue */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <AlertTriangle size={20} color="#C57B17" />
                  {isRw ? 'Ibibazo by’Ubuziranenge bw’Amakuru (Data Quality Queue)' : 'Data Quality & Verification Queue'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Isuzuma ry’ibimenyetso bibuze, amakuru asubiramo, cyangwa raporo zatinze.'
                    : 'Systematic exceptions flagged by Guardian: missing evidence, budget variance, or overdue group reports.'}
                </p>
              </div>
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Ubwoko bw’Ikibazo' : 'Issue Type & Severity'}</th>
                    <th>{isRw ? 'Ibyerekeyeho' : 'Record Reference'}</th>
                    <th>{isRw ? 'Ibisobanuro' : 'Description'}</th>
                    <th>{isRw ? 'Umuti / Inyandiko' : 'Resolution'}</th>
                    <th>{isRw ? 'Imimerere' : 'Status & Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {dataQualityIssues.map((dq) => (
                    <tr key={dq.id} className={dq.status === 'open' ? s.tableRowAlert : ''}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            className={`${s.statusBadge} ${
                              dq.severity === 'critical'
                                ? s.statusCritical
                                : dq.severity === 'warning'
                                ? s.statusWarning
                                : s.statusReviewed
                            }`}
                          >
                            {dq.severity.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {dq.issueType.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td><b>{dq.recordRef}</b></td>
                      <td>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', maxWidth: '300px' }}>
                          {dq.description}
                        </p>
                      </td>
                      <td>
                        {dq.status === 'resolved' ? (
                          <span style={{ fontSize: '0.8rem', color: '#1f8a5b' }}>
                            <Check size={12} /> {dq.resolutionNote}
                          </span>
                        ) : perms.canVerifyMeal ? (
                          <input
                            className={s.formInput}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: '180px' }}
                            placeholder="Resolution note..."
                            value={dqResolutionInput[dq.id] || ''}
                            onChange={(e) =>
                              setDqResolutionInput({ ...dqResolutionInput, [dq.id]: e.target.value })
                            }
                          />
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Pending review</span>
                        )}
                      </td>
                      <td>
                        {dq.status === 'resolved' ? (
                          <span className={`${s.statusBadge} ${s.statusApproved}`}>Resolved</span>
                        ) : perms.canVerifyMeal ? (
                          <button
                            type="button"
                            className={`${s.button} ${s.buttonSuccess} ${s.buttonSmall}`}
                            onClick={() =>
                              handleAction(
                                {
                                  action: 'resolveDataQualityIssue',
                                  issueId: dq.id,
                                  resolutionNote:
                                    dqResolutionInput[dq.id] ||
                                    'Verified against supporting field evidence and signed reconciliation note.',
                                },
                                isRw ? 'Ikibazo cy’ubuziranenge cyakemutse!' : 'Data quality issue resolved!'
                              )
                            }
                            disabled={busy || isPending}
                          >
                            <Check size={12} />
                            {isRw ? 'Kemura' : 'Resolve'}
                          </button>
                        ) : (
                          <span className={`${s.statusBadge} ${s.statusWarning}`}>{dq.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!dataQualityIssues.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#1f8a5b' }}>
                        <Check size={16} /> {isRw ? 'Nta bibazo by’ubuziranenge bihari!' : 'Zero data quality exceptions flagged.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 9: DONOR REPORTS & EXTERNAL DONOR PORTAL */}
      {activeTab === 'donor_reports' && (
        <section className={s.tabContent}>
          {/* Report Snapshots Viewer */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <FileText size={20} color="#2463A6" />
                  {isRw ? 'Raporo z’Abaterankunga na RGB (Institutional Report Snapshots)' : 'Institutional Donor & Compliance Report Snapshots'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Raporo zifunzwe zihuriwemo ibipimo byose, imikoreshereze y’imari, n’ibimenyetso bya MEAL.'
                    : 'Formal quarterly and annual audit packs with locked indicators and budget summaries.'}
                </p>
              </div>
              {perms.canGenerateReports && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowReportForm(!showReportForm)}
                >
                  <Plus size={14} />
                  {showReportForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Kora Raporo Nshya' : 'Generate Snapshot')}
                </button>
              )}
            </div>

            {/* Generate Report Form */}
            {showReportForm && perms.canGenerateReports && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const grantId = String(fd.get('grantId') || grants[0]?.id || 'grant-rift-2026');
                  const title = String(fd.get('title') || '').trim();
                  const reportType = String(fd.get('reportType') || 'donor_quarterly');
                  const reportingPeriod = String(fd.get('reportingPeriod') || '2026-Q2');
                  const executiveSummary = String(fd.get('executiveSummary') || '').trim();
                  const activitiesSummary = String(fd.get('activitiesSummary') || '').trim();

                  handleAction(
                    {
                      action: 'generateNgoReportSnapshot',
                      programId,
                      grantId,
                      title,
                      reportType,
                      reportingPeriod,
                      executiveSummary,
                      activitiesSummary,
                    },
                    isRw ? 'Raporo nshya yakozwe neza!' : 'Report snapshot generated successfully!'
                  );
                  setShowReportForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Gukora Raporo Nshya y’Umuterankunga' : 'Generate New Institutional Report Snapshot'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umutwe wa Raporo:' : 'Report Title:'}</label>
                    <input className={s.formInput} name="title" required defaultValue="2026 Q2 ImpactTrace Accountability Pack" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ubwoko bwa Raporo:' : 'Report Type:'}</label>
                    <select className={s.formSelect} name="reportType">
                      <option value="donor_quarterly">Quarterly Donor Progress Report</option>
                      <option value="rgb_compliance">RGB Annual Compliance Pack</option>
                      <option value="district_partner">District Strategic Partner Report</option>
                      <option value="annual_impact">Annual Institutional Impact Report</option>
                      <option value="audit_pack">Statutory Financial Audit Pack</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Igihe cya Raporo:' : 'Reporting Period:'}</label>
                    <input className={s.formInput} name="reportingPeriod" defaultValue="2026-Q2" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Inkunga:' : 'Target Grant:'}</label>
                    <select className={s.formSelect} name="grantId">
                      {grants.map((g) => (
                        <option key={g.id} value={g.id}>{g.grantCode} - {g.donorName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.formLabel}>{isRw ? 'Incamake y’Ubuyobozi:' : 'Executive Summary:'}</label>
                  <textarea className={s.formTextarea} name="executiveSummary" rows={2} defaultValue="Institutional progress pack generated via HURIZA ImpactTrace telemetry." />
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowReportForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Gukora Raporo' : 'Generate Snapshot'}
                  </button>
                </div>
              </form>
            )}

            {/* Reports List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reportSnapshots.map((rep) => (
                <div key={rep.id} className={s.card} style={{ gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span className={`${s.statusBadge} ${s.statusReviewed}`}>{rep.reportType.replace(/_/g, ' ')}</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#64748b' }}>
                        Period: {rep.reportingPeriod}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className={`${s.statusBadge} ${
                          rep.status === 'approved' ? s.statusApproved : s.statusWarning
                        }`}
                      >
                        {rep.status.toUpperCase()}
                      </span>
                      {perms.canManageOrganization && rep.status !== 'approved' && (
                        <button
                          type="button"
                          className={`${s.button} ${s.buttonSuccess} ${s.buttonSmall}`}
                          onClick={() =>
                            handleAction(
                              { action: 'approveNgoReportSnapshot', reportId: rep.id },
                              isRw ? 'Raporo yemejwe burundu n’ubuyobozi!' : 'Report snapshot approved by Executive Director!'
                            )
                          }
                          disabled={busy || isPending}
                        >
                          <Check size={12} />
                          {isRw ? 'Emeza Raporo' : 'Approve Report'}
                        </button>
                      )}
                      <a
                        href="/api/export?type=impact"
                        className={`${s.button} ${s.buttonSecondary} ${s.buttonSmall}`}
                      >
                        <Download size={12} /> CSV Pack
                      </a>
                    </div>
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{rep.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.45 }}>
                    {rep.executiveSummary}
                  </p>

                  {/* Budget Summary Pills */}
                  {rep.budgetSummary && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.8rem' }}>
                        <b>Allocated:</b> {money(rep.budgetSummary.allocatedRwf)}
                      </span>
                      <span style={{ fontSize: '0.8rem' }}>
                        <b>Spent:</b> {money(rep.budgetSummary.spentRwf)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#1f8a5b', fontWeight: 700 }}>
                        <b>Utilization:</b> {rep.budgetSummary.utilizationPercent}%
                      </span>
                    </div>
                  )}

                  {/* Causal Limitations Note */}
                  <div className={s.privacyBox} style={{ borderLeftColor: '#4A90E2', background: '#F0F7FF' }}>
                    <Info size={16} color="#2463A6" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.775rem', color: '#334155' }}>
                      <b>{isRw ? 'Icyitonderwa ku bushakashatsi bw’Umusaruro:' : 'Causal Limitations Notice:'}</b>{' '}
                      {rep.risksAndLimitations ||
                        'Observed program monitoring aggregates among participating cohorts do not claim causal econometric impact without randomized or quasi-experimental control comparisons.'}
                    </span>
                  </div>
                </div>
              ))}
              {!reportSnapshots.length && (
                <div className={s.emptyState}>
                  <p>{isRw ? 'Nta raporo zifunzwe zirakorwa.' : 'No report snapshots generated yet.'}</p>
                </div>
              )}
            </div>
          </div>

          {/* External Donor Portal Access Grants */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Lock size={20} color="#2463A6" />
                  {isRw ? 'Ihuriro ry’Abaterankunga bo Hanze (External Donor Portal Access)' : 'External Donor Portal Access Grants'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Guhereza abaterankunga kureba amakuru y’inkunga yabo mu buryo bwo gusoma gusa.'
                    : 'Grant scoped, time-bound read-only transparency portal access to external donor representatives.'}
                </p>
              </div>
              {perms.canManageDonorAccess && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowDonorAccessForm(!showDonorAccessForm)}
                >
                  <Plus size={14} />
                  {showDonorAccessForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Tanga Uburenganzira' : 'Grant Donor Access')}
                </button>
              )}
            </div>

            {/* Grant Donor Access Form */}
            {showDonorAccessForm && perms.canManageDonorAccess && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const programId = String(fd.get('programId') || programs[0]?.id || 'prog-frc-2026');
                  const grantId = String(fd.get('grantId') || grants[0]?.id || 'grant-rift-2026');
                  const donorName = String(fd.get('donorName') || '').trim();
                  const donorEmail = String(fd.get('donorEmail') || '').trim();
                  const permissionsScope = String(fd.get('permissionsScope') || 'aggregates_and_reports');
                  const expiresAt = String(fd.get('expiresAt') || '2026-12-31');

                  handleAction(
                    {
                      action: 'grantNgoDonorAccess',
                      programId,
                      grantId,
                      donorName,
                      donorEmail,
                      permissionsScope,
                      expiresAt,
                    },
                    isRw ? 'Uburenganzira bw’umuterankunga bwatanzwe neza!' : 'External donor portal access granted!'
                  );
                  setShowDonorAccessForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Guhereza Umuterankunga Uburenganzira bwo Kureba' : 'Grant Scoped Donor Access Token'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Umuryango w’Umuterankunga:' : 'Donor Organization:'}</label>
                    <input className={s.formInput} name="donorName" required placeholder="e.g. East Africa Resilience Fund" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Imeri y’Umuterankunga:' : 'Donor Contact Email:'}</label>
                    <input className={s.formInput} type="email" name="donorEmail" required placeholder="rep@donor.org" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Urwego rw’Ububasha:' : 'Permissions Scope:'}</label>
                    <select className={s.formSelect} name="permissionsScope">
                      <option value="aggregates_and_reports">Aggregates & Report Snapshots</option>
                      <option value="aggregates_only">Aggregates Only (No Financials)</option>
                      <option value="full_grant_financials">Full Grant Financials & Invoices</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Itariki Yo Kurangiraho:' : 'Expiration Date:'}</label>
                    <input className={s.formInput} type="date" name="expiresAt" defaultValue="2026-12-31" />
                  </div>
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowDonorAccessForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Tanga Uburenganzira' : 'Create Access Token'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Umuterankunga' : 'Donor & Email'}</th>
                    <th>{isRw ? 'Kode y’Ihuriro' : 'Access Code'}</th>
                    <th>{isRw ? 'Urwego rw’Ububasha' : 'Scope'}</th>
                    <th>{isRw ? 'Kurangira' : 'Expires'}</th>
                    <th>{isRw ? 'Uwatse' : 'Granted By'}</th>
                    <th>{isRw ? 'Imimerere & Igikorwa' : 'Status & Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {donorAccessGrants.map((dag) => (
                    <tr key={dag.id}>
                      <td>
                        <b>{dag.donorName}</b>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{dag.donorEmail}</div>
                      </td>
                      <td>
                        <code style={{ background: '#eaf3fe', color: '#2463a6', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                          {dag.accessCode}
                        </code>
                      </td>
                      <td>
                        <span className={`${s.statusBadge} ${s.statusReviewed}`}>
                          {dag.permissionsScope.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{dag.expiresAt}</td>
                      <td>{dag.grantedBy}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            className={`${s.statusBadge} ${
                              dag.status === 'active' ? s.statusApproved : s.statusCritical
                            }`}
                          >
                            {dag.status}
                          </span>
                          {perms.canManageDonorAccess && dag.status === 'active' && (
                            <button
                              type="button"
                              className={`${s.button} ${s.buttonDanger} ${s.buttonSmall}`}
                              onClick={() =>
                                handleAction(
                                  { action: 'revokeNgoDonorAccess', accessGrantId: dag.id },
                                  isRw ? 'Uburenganzira bwasheshwe!' : 'Donor access token revoked!'
                                )
                              }
                              disabled={busy || isPending}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!donorAccessGrants.length && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta burenganzira bw’abaterankunga buratangwa.' : 'No external donor tokens issued.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 10: STAFF, 14 NGO ROLES & 6-STEP ONBOARDING WIZARD */}
      {activeTab === 'team_onboarding' && (
        <section className={s.tabContent}>
          {/* Admin Staff Roster & 14 NGO Roles */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <UserCheck size={20} color="#2463A6" />
                  {isRw ? 'Abakozi n’Inshingano 14 za NGO (Staff Roster & 14 Institutional Roles)' : 'Staff Roster & 14 NGO Roles'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Gushyiraho abakozi, kubaha imyanya muri gahunda no gukurikirana inshingano zabo.'
                    : 'Role-based access control encompassing Directors, MEAL, Finance, Field Officers, and Auditors.'}
                </p>
              </div>
              {perms.canManageStaff && (
                <button
                  type="button"
                  className={`${s.button} ${s.buttonPrimary} ${s.buttonSmall}`}
                  onClick={() => setShowStaffForm(!showStaffForm)}
                >
                  <Plus size={14} />
                  {showStaffForm ? (isRw ? 'Funga' : 'Close Form') : (isRw ? 'Tumira Umukozi' : 'Add Staff Member')}
                </button>
              )}
            </div>

            {/* Add Staff Form */}
            {showStaffForm && perms.canManageStaff && (
              <form
                className={s.collapsibleForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const fullName = String(fd.get('fullName') || '').trim();
                  const email = String(fd.get('email') || '').trim();
                  const phone = String(fd.get('phone') || '').trim();
                  const ngoRole = String(fd.get('ngoRole') || 'field_officer') as NGORole;
                  const department = String(fd.get('department') || 'Programs & Field Operations').trim();
                  const locationDistrict = String(fd.get('locationDistrict') || 'Gasabo').trim();
                  const assignedProgramId = String(fd.get('assignedProgramId') || 'all');

                  handleAction(
                    {
                      action: 'addNgoStaffMember',
                      fullName,
                      email,
                      phone,
                      ngoRole,
                      department,
                      locationDistrict,
                      assignedProgramId,
                    },
                    isRw ? 'Umukozi mushya yongewemo neza!' : 'Staff member invited and role assigned successfully!'
                  );
                  setShowStaffForm(false);
                }}
              >
                <h4 style={{ margin: 0, fontWeight: 700 }}>
                  {isRw ? 'Kwandika cyangwa Gutumira Umukozi Mushya' : 'Add / Invite Institutional Staff Member'}
                </h4>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Amazina Yose:' : 'Full Name:'}</label>
                    <input className={s.formInput} name="fullName" required placeholder="e.g. Jeannette Mukarubega" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Imeri:' : 'Email Address:'}</label>
                    <input className={s.formInput} type="email" name="email" required placeholder="staff@cgi-rwanda.org" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Telefoni (MoMo):' : 'Phone Number:'}</label>
                    <input className={s.formInput} name="phone" defaultValue="+250 788 " />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Inshingano (NGO Role):' : 'Institutional Role:'}</label>
                    <select className={s.formSelect} name="ngoRole" defaultValue="field_officer">
                      {ALL_NGO_ROLES.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.en} — {r.rw}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ishami (Department):' : 'Department:'}</label>
                    <input className={s.formInput} name="department" defaultValue="Programs & Field Operations" />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Akarere akoreramo:' : 'Location District:'}</label>
                    <input className={s.formInput} name="locationDistrict" defaultValue="Gasabo" />
                  </div>
                </div>
                <div className={s.formActions}>
                  <button type="button" className={`${s.button} ${s.buttonOutline}`} onClick={() => setShowStaffForm(false)}>
                    {isRw ? 'Kureka' : 'Cancel'}
                  </button>
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Emeza Umukozi' : 'Add Staff Member'}
                  </button>
                </div>
              </form>
            )}

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{isRw ? 'Amazina' : 'Staff Member & Email'}</th>
                    <th>{isRw ? 'Inshingano (Role)' : 'Assigned Role'}</th>
                    <th>{isRw ? 'Ishami / Akarere' : 'Department / District'}</th>
                    <th>{isRw ? 'Imimerere' : 'Status'}</th>
                    <th>{isRw ? 'Guhindura Inshingano' : 'Role Management'}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <b>{st.fullName}</b>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {st.email} {st.phone && `· ${st.phone}`}
                        </div>
                      </td>
                      <td>
                        <span className={`${s.statusBadge} ${s.statusReviewed}`}>
                          {ALL_NGO_ROLES.find((r) => r.role === st.ngoRole)?.en || st.ngoRole}
                        </span>
                      </td>
                      <td>
                        {st.department}
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{st.locationDistrict}</div>
                      </td>
                      <td>
                        <span
                          className={`${s.statusBadge} ${
                            st.status === 'active' ? s.statusApproved : s.statusWarning
                          }`}
                        >
                          {st.status}
                        </span>
                      </td>
                      <td>
                        {perms.canManageStaff && (
                          <select
                            className={s.formSelect}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            defaultValue={st.ngoRole}
                            onChange={(e) =>
                              handleAction(
                                {
                                  action: 'updateNgoStaffRole',
                                  staffId: st.id,
                                  ngoRole: e.target.value as NGORole,
                                  status: st.status,
                                },
                                isRw ? 'Inshingano z’umukozi zahinduwe!' : 'Staff role updated successfully!'
                              )
                            }
                            disabled={busy || isPending}
                          >
                            {ALL_NGO_ROLES.map((r) => (
                              <option key={r.role} value={r.role}>
                                {r.en}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!staff.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>
                        {isRw ? 'Nta bakozi barandikwa muri iyi sisitemu.' : 'No staff members assigned.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6-Step NGO Workspace Setup & Governance Wizard */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderTitle}>
                <h2 className={s.cardTitle}>
                  <Landmark size={20} color="#2463A6" />
                  {isRw ? 'Igenzura ry’Imiyoborere (6-Step Institutional Setup & Governance Wizard)' : '6-Step NGO Workspace Setup & Governance Wizard'}
                </h2>
                <p className={s.cardSubtitle}>
                  {isRw
                    ? 'Kunoza amategeko ngenderwaho y’umuryango, ibipimo fatizo by’imari, n’ubuziranenge bwa RGB.'
                    : 'Configure institutional profile, RGB registration, approval thresholds, and data retention policies.'}
                </p>
              </div>
            </div>

            {/* Wizard Steps Navigation */}
            <div className={s.wizardSteps}>
              {[
                { step: 1, label: isRw ? '1. Umwirondoro' : '1. Identity' },
                { step: 2, label: isRw ? '2. Intego' : '2. Mission' },
                { step: 3, label: isRw ? '3. Amategeko / RGB' : '3. Registration' },
                { step: 4, label: isRw ? '4. Uturere / Inzego' : '4. Scope' },
                { step: 5, label: isRw ? '5. Itumanaho' : '5. Contacts' },
                { step: 6, label: isRw ? '6. Imari n’Igenzura' : '6. Governance' },
              ].map((sObj) => (
                <button
                  key={sObj.step}
                  type="button"
                  className={`${s.wizardStepBtn} ${
                    wizardStep === sObj.step
                      ? s.wizardStepBtnActive
                      : wizardStep > sObj.step
                      ? s.wizardStepBtnCompleted
                      : ''
                  }`}
                  onClick={() => setWizardStep(sObj.step)}
                >
                  {sObj.label}
                </button>
              ))}
            </div>

            {/* Wizard Form Container */}
            <form
              className={s.formGrid}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = String(fd.get('name') || profile.name).trim();
                const ngoType = String(fd.get('ngoType') || profile.ngoType);
                const designation = String(fd.get('designation') || profile.designation).trim();
                const mission = String(fd.get('mission') || profile.mission).trim();
                const registrationRef = String(fd.get('registrationRef') || profile.registrationRef).trim();
                const contactEmail = String(fd.get('contactEmail') || profile.contactEmail).trim();
                const contactPhone = String(fd.get('contactPhone') || profile.contactPhone).trim();
                const reportingPeriod = String(fd.get('reportingPeriod') || profile.reportingPeriod);
                const approvalThresholdRwf = Number(fd.get('approvalThresholdRwf') || profile.approvalThresholdRwf);
                const districtsRaw = String(fd.get('operatingDistricts') || profile.operatingDistricts.join(', '));
                const operatingDistricts = districtsRaw.split(',').map((d) => d.trim()).filter(Boolean);
                const sectorsRaw = String(fd.get('focusSectors') || profile.focusSectors.join(', '));
                const focusSectors = sectorsRaw.split(',').map((sec) => sec.trim()).filter(Boolean);

                handleAction(
                  {
                    action: 'updateNgoProfile',
                    name,
                    ngoType,
                    designation,
                    mission,
                    registrationRef,
                    contactEmail,
                    contactPhone,
                    reportingPeriod,
                    approvalThresholdRwf,
                    operatingDistricts,
                    focusSectors,
                  },
                  isRw ? 'Amakuru y’umuryango yavuguruwe neza!' : 'NGO governance profile updated successfully!'
                );
              }}
            >
              {wizardStep === 1 && (
                <>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Izina ry’Umuryango:' : 'Organization Full Name:'}</label>
                    <input className={s.formInput} name="name" defaultValue={profile.name} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Ubwoko bwa NGO:' : 'NGO Type:'}</label>
                    <select className={s.formSelect} name="ngoType" defaultValue={profile.ngoType}>
                      <option value="national_ngo">National Non-Governmental Organization (RGB)</option>
                      <option value="international_ngo">International NGO (INGO)</option>
                      <option value="community_based_org">Community-Based Organization (CBO)</option>
                      <option value="faith_based_org">Faith-Based Development Organization</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Icyiciro cy’Ububasha:' : 'Strategic Designation:'}</label>
                    <input className={s.formInput} name="designation" defaultValue={profile.designation} />
                  </div>
                </>
              )}

              {wizardStep === 2 && (
                <div className={s.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label className={s.formLabel}>{isRw ? 'Intego Nyakuri y’Umuryango (Mission):' : 'Mission & Strategic Mandate:'}</label>
                  <textarea className={s.formTextarea} name="mission" rows={3} defaultValue={profile.mission} />
                </div>
              )}

              {wizardStep === 3 && (
                <>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Nimero y’Icyemezo cya RGB:' : 'RGB Registration Number:'}</label>
                    <input className={s.formInput} name="registrationRef" defaultValue={profile.registrationRef} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Urubuga rwa Interineti:' : 'Website:'}</label>
                    <input className={s.formInput} name="website" defaultValue={profile.website} />
                  </div>
                </>
              )}

              {wizardStep === 4 && (
                <>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Uturere dukoreramo (byandikishe ikoma):' : 'Operating Districts:'}</label>
                    <input className={s.formInput} name="operatingDistricts" defaultValue={profile.operatingDistricts.join(', ')} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Inzego z’Ibikorwa (byandikishe ikoma):' : 'Focus Sectors:'}</label>
                    <input className={s.formInput} name="focusSectors" defaultValue={profile.focusSectors.join(', ')} />
                  </div>
                </>
              )}

              {wizardStep === 5 && (
                <>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Imeri y’Umuryango:' : 'Institutional Contact Email:'}</label>
                    <input className={s.formInput} type="email" name="contactEmail" defaultValue={profile.contactEmail} required />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Telefoni y’Umuryango:' : 'Institutional Phone:'}</label>
                    <input className={s.formInput} name="contactPhone" defaultValue={profile.contactPhone} required />
                  </div>
                </>
              )}

              {wizardStep === 6 && (
                <>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Igihe cyo Gukora Raporo:' : 'Statutory Reporting Period:'}</label>
                    <select className={s.formSelect} name="reportingPeriod" defaultValue={profile.reportingPeriod}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="semi_annual">Semi-Annual</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>{isRw ? 'Icyemezo Cy’Imari cyo Kwemererwa (Threshold RWF):' : 'Approval Threshold Cap (RWF):'}</label>
                    <input className={s.formInput} type="number" name="approvalThresholdRwf" defaultValue={profile.approvalThresholdRwf} />
                  </div>
                </>
              )}

              <div className={s.formActions} style={{ gridColumn: '1 / -1' }}>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    className={`${s.button} ${s.buttonOutline}`}
                    onClick={() => setWizardStep(wizardStep - 1)}
                  >
                    {isRw ? 'Subira Inyuma' : 'Previous Step'}
                  </button>
                )}
                {wizardStep < 6 && (
                  <button
                    type="button"
                    className={`${s.button} ${s.buttonSecondary}`}
                    onClick={() => setWizardStep(wizardStep + 1)}
                  >
                    {isRw ? 'Komeza Imbere' : 'Next Step'}
                  </button>
                )}
                {perms.canManageOrganization && (
                  <button type="submit" className={`${s.button} ${s.buttonPrimary}`} disabled={busy || isPending}>
                    {isRw ? 'Bika Ibyahinduwe' : 'Save Governance Settings'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
