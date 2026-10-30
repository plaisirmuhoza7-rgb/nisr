import { calculateScenario, integer } from '../guardian';
import type { Fact, GuardianResult, NextStepAction } from './types';

export interface CycleHealthInput {
  groupName: string;
  cash: number;
  reserveBps: number;
  confirmedContributions: number;
  confirmedRepayments: number;
  outstandingLoans: number;
  repaymentDelayBps?: number;
  plannedLoanRequests?: number;
  plannedLoanAmount?: number;
  plannedExpenditure?: number;
}

export function evaluateCycleHealth(input: CycleHealthInput): GuardianResult {
  const cash = integer(input.cash, 'Cash');
  const reserveBps = integer(input.reserveBps, 'Reserve Bps', 0, 10000);
  const contributions = integer(input.confirmedContributions, 'Contributions');
  const repayments = integer(input.confirmedRepayments, 'Repayments');
  const outstandingLoans = integer(input.outstandingLoans, 'Outstanding Loans');
  const delayBps = input.repaymentDelayBps !== undefined ? integer(input.repaymentDelayBps, 'Delay Bps', 0, 10000) : 0;
  const requests = input.plannedLoanRequests !== undefined ? integer(input.plannedLoanRequests, 'Requests', 0, 1000) : 0;
  const loanAmount = input.plannedLoanAmount !== undefined ? integer(input.plannedLoanAmount, 'Loan Amount') : 0;
  const investment = input.plannedExpenditure !== undefined ? integer(input.plannedExpenditure, 'Planned Expenditure') : 0;

  const scenario = calculateScenario({
    cash,
    reserveBps,
    requests,
    loanAmount,
    contributions,
    expectedRepayments: repayments,
    delayBps,
    investment,
    outstandingLoans
  });

  const facts: Fact[] = [
    {
      key: 'starting_cash',
      label: 'Starting Group Treasury Cash',
      labelRw: 'Amafaranga yari asanzwe mu kigega',
      value: cash,
      formattedValue: `${cash.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: `Group: ${input.groupName}`
    },
    {
      key: 'protected_reserve',
      label: 'Mandatory Reserve Target',
      labelRw: 'Ikigega kigomba kurindwa',
      value: scenario.reserve,
      formattedValue: `${scenario.reserve.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: `${(reserveBps / 100).toFixed(1)}% of starting cash`
    },
    {
      key: 'confirmed_inflows',
      label: 'Projected Inflows (Contributions & Net Repayments)',
      labelRw: 'Amafaranga yinjira yemejwe',
      value: scenario.inflows,
      formattedValue: `${scenario.inflows.toLocaleString('en-RW')} RWF`,
      source: delayBps > 0 ? 'estimate' : 'confirmed',
      notes: delayBps > 0 ? `${(delayBps / 100).toFixed(0)}% repayment delay assumed` : 'Confirmed schedule'
    },
    {
      key: 'projected_outflows',
      label: 'Planned Outflows (New Loans & Expenses)',
      labelRw: 'Amafaranga azasohoka ateganyijwe',
      value: scenario.outflows,
      formattedValue: `${scenario.outflows.toLocaleString('en-RW')} RWF`,
      source: 'assumption',
      notes: `${requests} loans at ${loanAmount.toLocaleString('en-RW')} RWF + ${investment.toLocaleString('en-RW')} RWF expense`
    },
    {
      key: 'ending_cash',
      label: 'Projected Ending Treasury Cash',
      labelRw: 'Amafaranga azaba asigaye mu kigega',
      value: scenario.cashAfter,
      formattedValue: `${scenario.cashAfter.toLocaleString('en-RW')} RWF`,
      source: 'estimate'
    },
    {
      key: 'lending_capacity',
      label: 'Remaining Lending Capacity',
      labelRw: 'Ubushobozi bwo kongera kuguriza',
      value: scenario.lendingCapacity,
      formattedValue: `${scenario.lendingCapacity.toLocaleString('en-RW')} RWF`,
      source: 'estimate'
    },
    {
      key: 'total_loan_exposure',
      label: 'Total Loan Portfolio Exposure',
      labelRw: 'Amafaranga yose ari mu nguzanyo',
      value: scenario.loanExposure,
      formattedValue: `${scenario.loanExposure.toLocaleString('en-RW')} RWF`,
      source: 'estimate',
      notes: 'Existing outstanding loans plus new disbursements'
    }
  ];

  let verdict: GuardianResult['verdict'] = 'ok';
  let headline = `Group health is robust: ${scenario.lendingCapacity.toLocaleString('en-RW')} RWF lending capacity remains above reserve.`;
  let headlineRw = `Itsinda rihagaze neza cyane: Hasigaye ${scenario.lendingCapacity.toLocaleString('en-RW')} RWF hejuru y'ikigega kirinzwe.`;

  if (scenario.status === 'critical') {
    verdict = 'not_advised';
    headline = `Critical liquidity deficit: Plan breaches reserve by ${scenario.shortfall.toLocaleString('en-RW')} RWF.`;
    headlineRw = `Ikibazo gikomeye cy'imari: Iki gishushanyo giteza igihombo cya ${scenario.shortfall.toLocaleString('en-RW')} RWF munsi y'ikigega.`;
  } else if (scenario.status === 'warning') {
    verdict = 'caution';
    headline = `Caution: Lending capacity (${scenario.lendingCapacity.toLocaleString('en-RW')} RWF) is thin relative to reserve.`;
    headlineRw = `Icyitonderwa: Ubushobozi bwo kuguriza (${scenario.lendingCapacity.toLocaleString('en-RW')} RWF) bwegereye cyane ikigega kirinzwe.`;
  }

  const tradeoffs = [
    `Ending cash projected at ${scenario.cashAfter.toLocaleString('en-RW')} RWF versus ${scenario.reserve.toLocaleString('en-RW')} RWF reserve.`,
    `Group loan portfolio exposure totals ${scenario.loanExposure.toLocaleString('en-RW')} RWF.`
  ];

  const tradeoffsRw = [
    `Amafaranga ateganyijwe gusigara ni ${scenario.cashAfter.toLocaleString('en-RW')} RWF ugereranyije na ${scenario.reserve.toLocaleString('en-RW')} RWF y'ikigega kirinzwe.`,
    `Inguzanyo zose ziri mu banyamuryango zizagera kuri ${scenario.loanExposure.toLocaleString('en-RW')} RWF.`
  ];

  const nextSteps: NextStepAction[] = [
    {
      label: 'Review Group Loan Portfolio',
      labelRw: 'Reba urutonde rw\'inguzanyo z\'itsinda',
      href: '/app/groups',
      kind: 'review'
    },
    {
      label: 'Simulate Alternate Stress Scenarios',
      labelRw: 'Gerageza ibindi bipimo mu igerageza',
      href: '/app/simulator',
      kind: 'compare'
    }
  ];

  return {
    mode: 'officer',
    question: 'cycle_health',
    verdict,
    headline,
    headlineRw,
    explanation: scenario.explanation,
    explanationRw: scenario.status === 'critical'
      ? `Iki gishushanyo giteza igihombo cya ${scenario.shortfall.toLocaleString('en-RW')} RWF munsi y'ikigega kirinzwe. Gabanya inguzanyo uteganya gutanga cyangwa utegereze andi mafaranga yemejwe yinjira.`
      : `Nyuma y'izi ngamba, hasigaye ${scenario.lendingCapacity.toLocaleString('en-RW')} RWF hejuru y'ikigega cya ${scenario.reserve.toLocaleString('en-RW')} RWF. Ibiteganyijwe kwinjira ni ibyitezwe, si amafaranga yemejwe.`,
    facts,
    formulas: scenario.formulas,
    assumptions: scenario.assumptions,
    tradeoffs,
    tradeoffsRw,
    missing: [],
    nextSteps,
    synthetic: true,
    confidence: 'high'
  };
}
