export type Source = 'confirmed' | 'estimate' | 'assumption' | 'missing';

export interface Fact {
  key: string;
  label: string;
  labelRw?: string;
  value: number | null;
  formattedValue?: string;
  source: Source;
  unit?: string;
  notes?: string;
}

export type GuardianQuestion =
  | 'contribution_affordability'
  | 'missed_payment'
  | 'plan_compare'
  | 'payout_fit'
  | 'cycle_health';

export type GuardianMode = 'member' | 'officer';

export type GuardianVerdict =
  | 'ok'
  | 'caution'
  | 'not_advised'
  | 'insufficient_information';

export interface NextStepAction {
  label: string;
  labelRw: string;
  href: string;
  kind: 'review' | 'compare' | 'ask_officer' | 'action';
}

export interface GuardianResult {
  mode: GuardianMode;
  question: GuardianQuestion;
  verdict: GuardianVerdict;
  headline: string;
  headlineRw: string;
  explanation: string;
  explanationRw: string;
  facts: Fact[];
  formulas: string[];
  assumptions: string[];
  tradeoffs: string[];
  tradeoffsRw?: string[];
  missing: string[];
  nextSteps: NextStepAction[];
  synthetic: true;
  confidence: 'high' | 'medium' | 'low';
}

export interface MemberGuardianContext {
  userId: string;
  wallets: Array<{
    id: string;
    institution: string;
    accountName: string;
    accountType: string;
    balance: number;
    currency: string;
  }>;
  totalWalletBalance: number;
  obligations: Array<{
    id: string;
    orgId: string;
    groupName: string;
    amountDue: number;
    amountConfirmed: number;
    dueDate: string;
    status: string;
    latePenalty: number;
    missedPolicy: string;
  }>;
  totalUpcomingObligations: number;
  goals: Array<{
    id: string;
    name: string;
    target: number;
    saved: number;
    deadline: string;
  }>;
  personalLoans: Array<{
    id: string;
    counterpartyName: string;
    direction: 'i_owe' | 'they_owe';
    remainingAmount: number;
    dueDate?: string;
    status: string;
  }>;
  totalDebtOwed: number;
}

export interface OfficerGuardianContext {
  orgId: string;
  groupName: string;
  model: 'ACCUMULATING' | 'ROTATING';
  cash: number;
  reserve: number;
  reserveBps: number;
  lendingCapacity: number;
  outstandingLoans: number;
  confirmedInflows: number;
  pendingObligationsTotal: number;
  policy: {
    contributionAmount: number;
    contributionFrequency: string;
    latePenalty: number;
    missedPolicy: string;
    minimumReserveBps: number;
    loanLimitBps: number;
    dueDay: number;
    hasExplicitLatePenalty: boolean;
  };
  memberCount: number;
}
