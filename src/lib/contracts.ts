export type Role = 'member'|'president'|'treasurer'|'accountant'|'secretary'|'cooperative'|'ngo';
export interface Actor {tenantId:string;userId:string;role:Role}
export interface ActionInput {action:string;orgId?:string;[key:string]:unknown}
export interface ScheduleItem {dueDate:string;amount:number;paid:number}

export interface GroupExpense {
  id: string;
  category: string;
  title: string;
  description: string;
  amount: number;
  receiptAttachment?: string;
  status: 'recorded' | 'approved' | 'declined' | 'paid' | 'failed';
  recordedBy: string;
  recordedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  paymentReference?: string;
  journalId?: string;
  createdAt: string;
}

export interface GroupExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

export interface GroupRoleHistoryItem {
  id: string;
  userId: string;
  userName?: string;
  oldRole: Role;
  newRole: Role;
  assignedBy: string;
  assignedByName?: string;
  createdAt: string;
}

export interface GroupMonthlyReport {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  confirmedContributions: number;
  disbursedLoans: number;
  repaidLoans: number;
  expensesByCategory: { category: string; amount: number }[];
  closingCash: number;
  closingReserve: number;
}

export interface SavingsGroupInfo {
  id:string;
  name:string;
  district:string;
  model:'ACCUMULATING'|'ROTATING';
  memberCount:number;
  memberRole:Role;
  members:{id:string;name:string;role:Role;phone?:string;savings?:number;debt?:number}[];
  expectedMembers:number;
  contributionAmount:number;
  frequency:'daily'|'weekly'|'monthly';
  inviteCode?:string;
  cycleStart:string;
  cycleEnd:string;
  cycleStatus:string;
  reserveBps:number;
  emergencyLending:boolean;
  rotationRounds:{id:string;roundNumber:number;recipientId:string;recipientName:string;dueDate:string;expectedPool:number;confirmed:number;shortfall:number;status:string}[];
  obligations:{id:string;userId:string;amountDue:number;amountConfirmed:number;dueDate:string;status:string;roundId:string|null}[];
  shareOut:{contributions:number;cash:number;reserve:number;outstandingLoans:number;pending:number;distributable:number;ready:boolean};
  expenses?: GroupExpense[];
  expenseCategories?: GroupExpenseCategory[];
  roleHistory?: GroupRoleHistoryItem[];
  monthlyReports?: GroupMonthlyReport[];
}
export interface CooperativeProfile {
  orgId: string;
  name: string;
  category: 'agriculture'|'processing'|'service'|'commercial'|'multipurpose';
  sector: string;
  district: string;
  registrationNumber?: string;
  nominalShareValue: number;
  minSharesPerMember: number;
  maxSharesPerMember: number;
  statutoryReserveBps: number;
  socialFundBps: number;
  dividendPoolBps: number;
  bonusPoolBps: number;
  memberCount: number;
  shareCapital: number;
  unpaidSubscriptions: number;
  availableCash: number;
  reserveCash: number;
}

export interface CooperativeStaffAppointment {
  id: string;
  userId: string;
  userName?: string;
  title: string;
  department: string;
  appointedAt: string;
  status: 'active'|'suspended'|'resigned';
}

export interface CooperativeShareAccount {
  id: string;
  userId: string;
  userName?: string;
  sharesSubscribed: number;
  sharesPaid: number;
  amountSubscribed: number;
  amountPaid: number;
  amountOutstanding: number;
  status: 'active'|'pending'|'suspended'|'transferred';
}

export interface CooperativeDelivery {
  id: string;
  userId: string;
  memberName?: string;
  productName: string;
  category: 'grain'|'horticulture'|'coffee'|'dairy'|'tea'|'other';
  quantity: number;
  unit: string;
  grade: string;
  unitPrice: number;
  totalValue: number;
  paymentStatus: 'pending'|'approved'|'paid'|'cancelled';
  paymentReference?: string;
  deliveryDate: string;
  notes?: string;
}

export interface CooperativeSale {
  id: string;
  buyerName: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  paymentStatus: 'invoiced'|'paid'|'overdue'|'cancelled';
  paymentReference?: string;
  saleDate: string;
}

export interface CooperativeSurplusAllocation {
  id: string;
  periodLabel: string;
  grossRevenue: number;
  totalExpenses: number;
  netSurplus: number;
  statutoryReserveAmount: number;
  socialFundAmount: number;
  distributableSurplus: number;
  dividendPool: number;
  bonusPool: number;
  status: 'calculated'|'approved_by_assembly'|'distributed';
  resolutionRef?: string;
  approvedBy?: string;
  approvedAt?: string;
  distributions?: CooperativeMemberDistribution[];
}

export interface CooperativeMemberDistribution {
  id: string;
  allocationId: string;
  userId: string;
  userName?: string;
  sharesHeld: number;
  shareRatioBps: number;
  dividendAmount: number;
  participationUnits: number;
  participationRatioBps: number;
  bonusAmount: number;
  totalEntitlement: number;
  payoutStatus: 'entitled'|'pending'|'paid';
  payoutReference?: string;
  paidAt?: string;
}

export interface CooperativeInvestment {
  id: string;
  title: string;
  category: 'processing'|'logistics'|'storage'|'equipment'|'energy'|'infrastructure';
  capitalCost: number;
  monthlyOperatingCost: number;
  expectedMonthlyBenefit: number;
  usefulLifeMonths: number;
  financingSource: 'cash_reserve'|'member_levy'|'commercial_loan';
  status: 'draft'|'simulated'|'board_approved'|'assembly_approved'|'purchased'|'rejected';
  guardianVerdict: 'sustainable'|'caution'|'critical_liquidity';
  paybackMonths: number;
  remainingCashAfterPurchase: number;
  liquidityBuffer: number;
  netMonthlyGain: number;
  createdBy: string;
  createdAt: string;
}

export interface CooperativeGovernanceEvent {
  id: string;
  eventType: 'board_meeting'|'general_assembly'|'supervisory_audit';
  title: string;
  meetingDate: string;
  agenda: string;
  resolutions: string;
  recordedBy: string;
  createdAt: string;
}

export interface CooperativeState {
  profile: CooperativeProfile;
  staff: CooperativeStaffAppointment[];
  shares: CooperativeShareAccount[];
  myShareAccount?: CooperativeShareAccount;
  deliveries: CooperativeDelivery[];
  myDeliveries?: CooperativeDelivery[];
  sales: CooperativeSale[];
  surplusAllocations: CooperativeSurplusAllocation[];
  myDistributions?: CooperativeMemberDistribution[];
  investments: CooperativeInvestment[];
  governance: CooperativeGovernanceEvent[];
  financialStatements: {
    revenue: number;
    expenses: number;
    netSurplus: number;
    cash: number;
    reserve: number;
    shareCapital: number;
    sharesReceivable: number;
    equipmentAssets: number;
    totalAssets: number;
    liabilities: number;
  };
}

export type CampaignFamily = 'moments' | 'causes' | 'community';
export type CampaignVisibility = 'public' | 'unlisted' | 'private';
export type StatsVisibility = 'everyone' | 'contributors_only' | 'selected_contributors' | 'team_only';
export type CampaignTheme = 'wedding_elegant' | 'birthday_celebration' | 'medical_trust' | 'charity_warm' | 'community_impact' | 'classic_blue';
export type CampaignVerificationStatus = 'unverified' | 'pending_review' | 'verified_demo' | 'requires_review' | 'suspended';
export type CampaignRole = 'owner' | 'co_organizer' | 'accountant' | 'treasurer' | 'approver' | 'moderator' | 'content_manager' | 'team_captain';

export interface FundraisingMedia {
  id: string;
  campaignId: string;
  mediaType: 'cover' | 'gallery' | 'video' | 'document';
  url: string;
  caption: string;
  sortOrder: number;
  uploadedBy: string;
  createdAt: string;
}

export interface FundraisingUpdate {
  id: string;
  campaignId: string;
  updateType: 'progress' | 'milestone' | 'thank_you' | 'announcement' | 'spending' | 'photo';
  title: string;
  body: string;
  mediaUrl: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface FundraisingComment {
  id: string;
  campaignId: string;
  updateId?: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  commentType: 'comment' | 'guestbook' | 'congratulation' | 'dedication';
  message: string;
  reaction: string;
  status: 'visible' | 'hidden';
  createdAt: string;
}

export interface FundraisingContribution {
  id: string;
  campaignId: string;
  paymentId?: string;
  userId: string;
  contributorName: string;
  displayPreference: 'public_name' | 'display_name' | 'anonymous';
  amount: number | null;
  contributionType: 'one_time' | 'recurring_simulated' | 'pledge' | 'gift_item';
  channel: 'mtn_momo' | 'airtel_money' | 'card_simulated';
  status: 'success' | 'pending' | 'failed' | 'unknown' | 'pledged' | 'refunded';
  reference: string;
  message: string;
  dedication: string;
  giftItemId?: string;
  teamId?: string;
  createdAt: string;
}

export interface FundraisingMilestone {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  targetAmount: number;
  allocatedAmount: number;
  spentAmount: number;
  outcomeStatus: 'planned' | 'in_progress' | 'funded_pending_execution' | 'completed_verified';
  outcomeEvidence: string;
  sortOrder: number;
  createdAt: string;
}

export interface FundraisingExpense {
  id: string;
  campaignId: string;
  title: string;
  category: string;
  description: string;
  vendorName: string;
  receiptUrl: string;
  milestoneId?: string;
  amount: number;
  requestedBy: string;
  requestedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  status: 'requested' | 'pending' | 'paid' | 'declined';
  paymentReference: string;
  createdAt: string;
}

export interface FundraisingGiftItem {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  targetAmount: number;
  contributedAmount: number;
  imageUrl: string;
  status: 'available' | 'partially_funded' | 'fulfilled';
}

export interface FundraisingRsvp {
  id: string;
  campaignId: string;
  userId: string;
  guestName: string;
  attendanceStatus: 'attending' | 'maybe' | 'declined';
  guestsCount: number;
  dietaryOrNote: string;
  createdAt: string;
}

export interface FundraisingMatchingPledge {
  id: string;
  campaignId: string;
  sponsorName: string;
  pledgedAmount: number;
  confirmedAmount: number;
  remainingPledge: number;
  matchRatioBps: number;
  status: 'active' | 'fulfilled' | 'expired';
}

export interface FundraisingAccessGrant {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  grantType: 'campaign_view' | 'selected_stats' | 'full_transparency';
  status: 'active' | 'revoked';
  grantedBy: string;
  expiresAt?: string;
  createdAt: string;
}

export interface FundraisingTeamMember {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  campaignRole: CampaignRole;
  teamName: string;
  assignedBy: string;
  createdAt: string;
}

export interface FundraisingGuardianInsight {
  fundingGap: number | null;
  progressPercent: number | null;
  requiredDailyRate: number | null;
  daysRemaining: number | null;
  uncommittedCash: number | null;
  transparencyScore: 'verified_clean' | 'needs_attention' | 'restricted';
  alerts: {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    category: 'funding' | 'transparency' | 'privacy';
    message: string;
  }[];
}

export interface FundraisingCampaignDetail {
  id: string;
  tenantId: string;
  orgId: string;
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  family: CampaignFamily;
  theme: CampaignTheme;
  description: string;
  story: string;
  organizerUserId: string;
  organizerName: string;
  beneficiaryName: string;
  beneficiaryType: 'self' | 'individual' | 'family' | 'child_protected' | 'community' | 'organization';
  location: string;
  eventDate?: string;
  startDate: string;
  coverImageUrl: string;
  videoUrl: string;
  status: string;
  verificationStatus: CampaignVerificationStatus;
  verificationNotes: string;
  visibility: CampaignVisibility;
  privacyPolicy: {
    statsVisibility: StatsVisibility;
    goalVisibility: StatsVisibility;
    raisedVisibility: StatsVisibility;
    contributorsVisibility: StatsVisibility;
    spendingVisibility: StatsVisibility;
    allowComments: boolean;
    allowAnonymous: boolean;
    allowRsvp: boolean;
  };
  suggestedAmounts: number[];
  viewerAccess: {
    canViewCampaign: boolean;
    canViewGoal: boolean;
    canViewRaised: boolean;
    canViewContributors: boolean;
    canViewSpending: boolean;
    isOrganizerOrTeam: boolean;
    isConfirmedContributor: boolean;
    hasSelectedGrant: boolean;
    campaignRole?: CampaignRole;
  };
  target: number | null;
  raised: number | null;
  spent: number | null;
  held: number | null;
  availableBalance: number | null;
  pledgedTotal: number | null;
  progressPercent: number | null;
  contributorCount: number | null;
  followerCount: number;
  isFollowing: boolean;
  reactionCounts: Record<string, number>;
  myReaction: string | null;
  media: FundraisingMedia[];
  updates: FundraisingUpdate[];
  comments: FundraisingComment[];
  contributions: FundraisingContribution[];
  milestones: FundraisingMilestone[];
  expenses: FundraisingExpense[];
  giftItems: FundraisingGiftItem[];
  rsvps: FundraisingRsvp[];
  matchingPledges: FundraisingMatchingPledge[];
  team: FundraisingTeamMember[];
  accessGrants: FundraisingAccessGrant[];
  guardian: FundraisingGuardianInsight;
}

export interface FundraisingState {
  campaigns: FundraisingCampaignDetail[];
  myCampaigns: FundraisingCampaignDetail[];
  myContributions: FundraisingContribution[];
  cloudinaryConfigured: boolean;
}

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

export interface FinanceState {
 savingsGroup?:SavingsGroupInfo;
 cooperativeState?:CooperativeState;
 fundraisingState?:FundraisingState;
 ngoState?:NGOState;
 treasury:{cash:number;reserve:number;pending:number;lendingCapacity:number;outstandingLoans:number;contributions:number};
 member:{eligibleSavings:number;loanLimit:number;outstanding:number};
 contributions:{id:string;member:string;amount:number;status:string;date:string}[];
 loans:{id:string;member:string;userId:string;amount:number;months:number;status:string;reasons:string[];schedule:ScheduleItem[]}[];
 ledger:{id:string;date:string;description:string;debit:number;credit:number;reference:string}[];
 payments:{id:string;kind:string;amount:number;status:string;reference:string;loanId?:string}[];
 campaigns:{id:string;title:string;category:string;description:string;target:number;raised:number;spent:number;status:string}[];
 cooperative:{cash:number;reserve:number;shareCapital:number;revenue:number;expenses:number;assets:{name:string;value:number}[];proposals:{id:string;title:string;amount:number;status:string;votes:number}[]};
 impact:{groups:number;members:number;savings:number;loans:number;reportingCompleteness:number;organizations:{id:string;name:string;district:string;members:number;savings:number;outstanding:number;reportingStatus:string}[]};
 alerts:{id:string;kind:string;message:string}[];
 groupExpenses?: GroupExpense[];
 groupExpenseCategories?: GroupExpenseCategory[];
 roleHistory?: GroupRoleHistoryItem[];
 personalAccounts?: PersonalWalletAccount[];
 personalLoans?: PersonalLoanRecord[];
 personalInvestmentPlans?: PersonalInvestmentPlan[];
}

export type PersonalAccountType = 'mobile_money' | 'bank' | 'sacco' | 'cash' | 'investment' | 'other';

export interface PersonalWalletAccount {
  id: string;
  tenantId?: string;
  userId?: string;
  institution: string;
  accountName: string;
  accountType: PersonalAccountType;
  accountIdentifier: string;
  balance: number;
  currency: string;
  notes?: string;
  updatedAt?: string;
}

export type PersonalLoanDirection = 'i_owe' | 'they_owe';
export type PersonalLoanStatus = 'active' | 'partially_paid' | 'settled' | 'defaulted';

export interface PersonalLoanRecord {
  id: string;
  tenantId?: string;
  userId?: string;
  counterpartyName: string;
  counterpartyPhone?: string;
  direction: PersonalLoanDirection;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  notes?: string;
  status: PersonalLoanStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type PersonalInvestmentCategory = 'agriculture' | 'retail' | 'transport' | 'real_estate' | 'technology' | 'services' | 'other';
export type PersonalInvestmentPlanStatus = 'draft' | 'planned' | 'active' | 'completed' | 'abandoned';

export interface PersonalInvestmentPlan {
  id: string;
  tenantId?: string;
  userId?: string;
  title: string;
  category: PersonalInvestmentCategory;
  capitalRequired: number;
  projectedRevenue: number;
  projectedExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  paybackMonths: number;
  timeHorizonMonths: number;
  notes?: string;
  status: PersonalInvestmentPlanStatus;
  createdAt?: string;
  updatedAt?: string;
}

