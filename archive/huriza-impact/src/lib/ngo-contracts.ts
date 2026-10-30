// Archived HURIZA Impact (NGO) Contracts & Types
// Extracted from src/lib/contracts.ts for future project phases.

export type NGORole =
  | 'country_director'
  | 'program_director'
  | 'program_manager'
  | 'project_officer'
  | 'field_officer'
  | 'meal_officer'
  | 'finance_manager'
  | 'accountant'
  | 'grants_officer'
  | 'safeguarding_officer'
  | 'donor_viewer'
  | 'partner_user'
  | 'auditor'
  | 'super_admin';

export interface NGOProfile {
  tenantId: string;
  orgId: string;
  name: string;
  ngoType: string;
  designation: string;
  mission: string;
  focusSectors: string[];
  operatingDistricts: string[];
  contactEmail: string;
  contactPhone: string;
  website: string;
  registrationRef: string;
  reportingPeriod: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  approvalThresholdRwf: number;
  dataRetentionMonths: number;
  createdAt: string;
}

export interface NGOStaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  ngoRole: NGORole;
  assignedProgramId: string;
  department: string;
  locationDistrict: string;
  status: 'active' | 'invited' | 'suspended' | 'inactive';
  assignedBy: string;
  createdAt: string;
}

export interface NGOProgram {
  id: string;
  code: string;
  name: string;
  description: string;
  objective: string;
  targetPopulation: string;
  districts: string[];
  startDate: string;
  endDate: string;
  fundingSource: string;
  totalBudget: number;
  leadOfficer: string;
  partnerOrgs: string[];
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'closed';
  createdAt: string;
}

export interface NGOProject {
  id: string;
  programId: string;
  code: string;
  name: string;
  district: string;
  sector: string;
  siteName: string;
  budgetAllocated: number;
  budgetSpent: number;
  leadOfficer: string;
  status: 'planning' | 'active' | 'completed' | 'paused';
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface NGOGrant {
  id: string;
  programId: string;
  donorName: string;
  grantCode: string;
  title: string;
  currency: 'RWF' | 'USD' | 'EUR' | 'GBP';
  originalAmount: number;
  exchangeRateRwf: number;
  awardAmountRwf: number;
  receivedAmountRwf: number;
  approvedBudgetRwf: number;
  expensesIncurredRwf: number;
  confirmedPaidRwf: number;
  remainingBudgetRwf: number;
  uncommittedRwf: number;
  restrictedCategories: string[];
  startDate: string;
  endDate: string;
  nextReportDue: string;
  reportingSchedule: string;
  conditionsNote: string;
  status: 'pipeline' | 'active' | 'reporting_due' | 'closing' | 'closed';
  createdAt: string;
}

export interface NGOBudgetLine {
  id: string;
  programId: string;
  grantId: string;
  category: string;
  lineCode: string;
  description: string;
  allocatedAmount: number;
  committedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
  createdAt: string;
}

export interface NGOActivity {
  id: string;
  programId: string;
  projectId: string | null;
  grantId: string | null;
  budgetLineId: string | null;
  title: string;
  activityType: string;
  district: string;
  sector: string;
  scheduledDate: string;
  completedDate: string;
  leadOfficer: string;
  targetParticipants: number;
  actualParticipants: number;
  linkedEntityType: 'savings_group' | 'cooperative' | 'fund_campaign' | 'household_cohort' | 'community_org';
  linkedEntityId: string;
  evidenceUrl: string;
  evidenceNote: string;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  verificationStatus: 'submitted' | 'meal_reviewed' | 'approved' | 'flagged';
  createdAt: string;
}

export interface NGOExpense {
  id: string;
  programId: string;
  projectId: string | null;
  grantId: string;
  budgetLineId: string;
  activityId: string | null;
  title: string;
  category: string;
  vendorName: string;
  amount: number;
  currency: string;
  receiptUrl: string;
  description: string;
  status: 'proposed' | 'program_reviewed' | 'finance_approved' | 'paid' | 'rejected' | 'reversed';
  requestedBy: string;
  reviewedBy: string;
  approvedBy: string;
  paymentReference: string;
  createdAt: string;
}

export interface NGOBeneficiaryCohort {
  id: string;
  programId: string;
  cohortCode: string;
  name: string;
  cohortType: 'savings_group_itsinda' | 'savings_group_ikimina' | 'cooperative' | 'household_cluster' | 'youth_enterprise' | 'women_collective';
  district: string;
  sector: string;
  linkedOrgId: string;
  householdsCount: number;
  participantsCount: number;
  femaleCount: number;
  youthCount: number;
  enrollmentStage: 'registered' | 'enrolled' | 'active' | 'graduated' | 'inactive';
  safeguardingLevel: 'standard' | 'protected_youth' | 'high_confidentiality';
  consentBasis: string;
  assignedOfficer: string;
  notes: string;
  createdAt: string;
}

export interface NGOFieldVisit {
  id: string;
  programId: string;
  activityId: string | null;
  officerId: string;
  officerName: string;
  visitDate: string;
  district: string;
  sector: string;
  communityName: string;
  purpose: string;
  formType: 'group_registration' | 'training_attendance' | 'savings_group_monitoring' | 'cooperative_support_visit' | 'beneficiary_enrollment' | 'follow_up_assessment';
  attendeesCount: number;
  observations: string;
  outcomesRecorded: string;
  followUpNeeded: string;
  evidenceAttachment: string;
  syncStatus: 'queued_offline' | 'synced' | 'verified';
  verificationStatus: 'submitted' | 'meal_reviewed' | 'approved' | 'flagged';
  createdAt: string;
}

export interface NGOIndicator {
  id: string;
  programId: string;
  code: string;
  name: string;
  level: 'input' | 'activity' | 'output' | 'outcome' | 'impact_context';
  unit: 'count' | 'percentage' | 'rwf' | 'groups' | 'cooperatives' | 'households';
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  numeratorLabel: string;
  denominatorLabel: string;
  dataSource: string;
  disaggregation: Record<string, number>;
  reportingPeriod: string;
  responsibleOfficer: string;
  verificationStatus: 'submitted' | 'meal_reviewed' | 'approved' | 'flagged';
  methodologyNote: string;
  createdAt: string;
}

export interface NGODataQualityIssue {
  id: string;
  programId: string;
  issueType: 'missing_evidence' | 'duplicate_beneficiary' | 'unverified_indicator' | 'overdue_group_report' | 'budget_variance' | 'missing_consent';
  severity: 'info' | 'warning' | 'critical';
  recordRef: string;
  description: string;
  resolutionNote: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  detectedBy: string;
  resolvedBy: string;
  createdAt: string;
}

export interface NGOReportSnapshot {
  id: string;
  programId: string;
  grantId: string | null;
  title: string;
  reportType: 'donor_quarterly' | 'rgb_compliance' | 'district_partner' | 'annual_impact' | 'audit_pack';
  reportingPeriod: string;
  executiveSummary: string;
  activitiesSummary: string;
  indicatorsSnapshot: { code: string; name: string; baseline: number; target: number; actual: number; unit: string; verified: boolean }[];
  budgetSummary: { allocatedRwf: number; committedRwf: number; spentRwf: number; utilizationPercent: number };
  risksAndLimitations: string;
  status: 'draft' | 'reviewed' | 'approved';
  preparedBy: string;
  approvedBy: string;
  createdAt: string;
}

export interface NGODonorAccessGrant {
  id: string;
  programId: string;
  grantId: string | null;
  donorName: string;
  donorEmail: string;
  accessCode: string;
  permissionsScope: 'aggregates_only' | 'aggregates_and_reports' | 'full_grant_financials';
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
  grantedBy: string;
  createdAt: string;
}

export interface NGOLinkedEntityAggregate {
  orgId: string;
  name: string;
  entityType: 'itsinda_savings_group' | 'ikimina_rotating_group' | 'cooperative' | 'fund_campaign';
  district: string;
  memberCount: number;
  aggregateSavingsOrCapitalRwf: number;
  aggregateActiveLoansOrSalesRwf: number;
  reserveHealthPercent: number;
  reportingCompletenessPercent: number;
  governanceStatus: 'verified_healthy' | 'attention_needed' | 'overdue_report';
  privacyNotice: string;
}

export interface NGOImpactTraceChain {
  traceId: string;
  grantId: string;
  donorName: string;
  grantTitle: string;
  grantAwardRwf: number;
  budgetLineCode: string;
  budgetCategory: string;
  budgetAllocatedRwf: number;
  activityId: string;
  activityTitle: string;
  activityDistrict: string;
  activityStatus: string;
  confirmedExpenseRwf: number;
  beneficiaryCohortName: string;
  linkedEntityId: string;
  participantsReached: number;
  fieldEvidenceSummary: string;
  evidenceVerified: boolean;
  indicatorCode: string;
  indicatorName: string;
  indicatorObservedValue: number;
  indicatorTargetValue: number;
  indicatorVerificationStatus: string;
  reportTitle: string;
  reportStatus: string;
}

export interface NGODistrictContext {
  district: string;
  province: string;
  programGroupsSupported: number;
  programCooperativesSupported: number;
  programParticipantsEnrolled: number;
  programConfirmedDisbursementsRwf: number;
  nisrFinScopeFormalInclusionPct: number;
  nisrFinScopeInformalSavingsUsagePct: number;
  nisrEicvPovertyHeadcountPct: number;
  contextPriorityLevel: 'high_priority_rural' | 'peri_urban_growth' | 'urban_enterprise';
  contextSourceLabel: string;
}

export interface NGOGuardianInsight {
  id: string;
  lens: 'grant_guardian' | 'program_guardian' | 'data_quality_guardian' | 'financial_inclusion_guardian' | 'donor_reporting_assistant';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  explanation: string;
  recommendedAction: string;
  metricLabel: string;
}

export interface NGOState {
  profile: NGOProfile;
  viewerRole: NGORole;
  viewerPermissions: {
    canManageOrganization: boolean;
    canManageStaff: boolean;
    canManagePrograms: boolean;
    canManageGrantsAndBudget: boolean;
    canApproveExpenses: boolean;
    canConfirmPayments: boolean;
    canSubmitFieldData: boolean;
    canVerifyMeal: boolean;
    canGenerateReports: boolean;
    canManageDonorAccess: boolean;
    isReadOnlyDonorOrAuditor: boolean;
  };
  kpis: {
    activeProgramsCount: number;
    activeGrantsCount: number;
    totalGrantAwardedRwf: number;
    totalGrantReceivedRwf: number;
    totalApprovedBudgetRwf: number;
    totalCommittedExpensesRwf: number;
    totalConfirmedPaidRwf: number;
    remainingRestrictedBalanceRwf: number;
    supportedSavingsGroupsCount: number;
    supportedCooperativesCount: number;
    enrolledBeneficiariesCount: number;
    femaleBeneficiariesPct: number;
    verifiedIndicatorsPct: number;
    openDataQualityIssuesCount: number;
  };
  staff: NGOStaffMember[];
  programs: NGOProgram[];
  projects: NGOProject[];
  grants: NGOGrant[];
  budgetLines: NGOBudgetLine[];
  activities: NGOActivity[];
  expenses: NGOExpense[];
  beneficiaryCohorts: NGOBeneficiaryCohort[];
  fieldVisits: NGOFieldVisit[];
  indicators: NGOIndicator[];
  dataQualityIssues: NGODataQualityIssue[];
  reportSnapshots: NGOReportSnapshot[];
  donorAccessGrants: NGODonorAccessGrant[];
  linkedEntities: NGOLinkedEntityAggregate[];
  impactTraceChains: NGOImpactTraceChain[];
  districtContexts: NGODistrictContext[];
  guardianInsights: NGOGuardianInsight[];
}
