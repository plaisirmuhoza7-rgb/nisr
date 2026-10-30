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

export interface FinanceState {
 savingsGroup?:SavingsGroupInfo;
 cooperativeState?:CooperativeState;
 fundraisingState?:FundraisingState;
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

