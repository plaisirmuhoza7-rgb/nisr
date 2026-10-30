import { integer } from '../guardian';
import type { Fact, GuardianResult, NextStepAction } from './types';

export interface AffordabilityInput {
  walletCash: number;
  upcomingObligations: number;
  activeDebtDue: number;
  householdBuffer: number;
  proposedContribution: number;
  goalImpact?: {
    name: string;
    target: number;
    saved: number;
    deadlineMonths: number;
  };
}

export function evaluateAffordability(input: AffordabilityInput): GuardianResult {
  const walletCash = integer(input.walletCash, 'Wallet Cash');
  const obligations = integer(input.upcomingObligations, 'Upcoming Obligations');
  const debt = integer(input.activeDebtDue, 'Active Debt');
  const buffer = integer(input.householdBuffer, 'Household Buffer');
  const proposed = integer(input.proposedContribution, 'Proposed Contribution');

  const priorObligationsTotal = Number(BigInt(obligations) + BigInt(debt));
  const liquidAfterObligations = Number(BigInt(walletCash) - BigInt(priorObligationsTotal));
  const discretionaryBeforeContribution = Number(BigInt(liquidAfterObligations) - BigInt(buffer));
  const remainingDiscretionary = Number(BigInt(discretionaryBeforeContribution) - BigInt(proposed));
  const totalCashAfterAll = Number(BigInt(walletCash) - BigInt(priorObligationsTotal) - BigInt(proposed));

  const facts: Fact[] = [
    {
      key: 'wallet_cash',
      label: 'Available Liquid Balances',
      labelRw: 'Amafaranga ari kuri konti zose',
      value: walletCash,
      formattedValue: `${walletCash.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: 'Sum of confirmed balances in personal wallets'
    },
    {
      key: 'upcoming_obligations',
      label: 'Upcoming Group Obligations',
      labelRw: 'Imisanzu yegereje y\'amatsinda',
      value: obligations,
      formattedValue: `${obligations.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: 'Scheduled round or cycle dues'
    },
    {
      key: 'active_debt',
      label: 'Active Debt Repayments',
      labelRw: 'Imyenda igomba kwishyurwa',
      value: debt,
      formattedValue: `${debt.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: 'Active personal loan obligations'
    },
    {
      key: 'household_buffer',
      label: 'Estimated Household Buffer',
      labelRw: 'Amafaranga y\'ingoboka y\'urugo',
      value: buffer,
      formattedValue: `${buffer.toLocaleString('en-RW')} RWF`,
      source: 'estimate',
      notes: 'User-provided monthly living expense cushion'
    },
    {
      key: 'proposed_contribution',
      label: 'Proposed Contribution',
      labelRw: 'Umusanzu uteganywa gutangwa',
      value: proposed,
      formattedValue: `${proposed.toLocaleString('en-RW')} RWF`,
      source: 'assumption',
      notes: 'Amount being evaluated'
    },
    {
      key: 'remaining_cushion',
      label: 'Remaining Discretionary Cushion',
      labelRw: 'Ayasaguka nyuma y\'ibikenewe byose',
      value: remainingDiscretionary,
      formattedValue: `${remainingDiscretionary.toLocaleString('en-RW')} RWF`,
      source: 'estimate',
      notes: 'Cash remaining after all obligations, buffer, and contribution'
    }
  ];

  let verdict: GuardianResult['verdict'] = 'ok';
  let headline = 'Contribution is fully affordable within your current finances.';
  let headlineRw = 'Uyu musanzu urawishoboreye neza udakungabanyije gahunda zindi.';
  let explanation = `Paying ${proposed.toLocaleString('en-RW')} RWF leaves ${remainingDiscretionary.toLocaleString('en-RW')} RWF of discretionary cushion above your ${buffer.toLocaleString('en-RW')} RWF living buffer and ${priorObligationsTotal.toLocaleString('en-RW')} RWF committed obligations.`;
  let explanationRw = `Kwishyura ${proposed.toLocaleString('en-RW')} RWF birasiga ${remainingDiscretionary.toLocaleString('en-RW')} RWF yisumbuye ku mafaranga y'urugo ${buffer.toLocaleString('en-RW')} RWF n'indi myenda ya ${priorObligationsTotal.toLocaleString('en-RW')} RWF.`;

  const tradeoffs: string[] = [];
  const tradeoffsRw: string[] = [];

  if (proposed > walletCash) {
    verdict = 'not_advised';
    headline = 'Insufficient funds: Contribution exceeds total wallet balance.';
    headlineRw = 'Amafaranga ntahagije: Umusanzu uruta ayo ufite kuri konti zose.';
    explanation = `The proposed contribution of ${proposed.toLocaleString('en-RW')} RWF exceeds your total liquid balance of ${walletCash.toLocaleString('en-RW')} RWF by ${(proposed - walletCash).toLocaleString('en-RW')} RWF.`;
    explanationRw = `Umusanzu uteganyijwe wa ${proposed.toLocaleString('en-RW')} RWF uruta amafaranga yose ufite (${walletCash.toLocaleString('en-RW')} RWF) ku kinyuranyo cya ${(proposed - walletCash).toLocaleString('en-RW')} RWF.`;
    tradeoffs.push('Proceeding requires depositing new funds into your wallet before attempting payment.');
    tradeoffsRw.push('Kugira ngo bishoboke bisaba kubanza gushyira andi mafaranga kuri konti yawe.');
  } else if (totalCashAfterAll < 0) {
    verdict = 'not_advised';
    headline = 'High risk: Contribution leaves you unable to cover existing confirmed debts.';
    headlineRw = 'Ibyago biri hejuru: Uyu musanzu uzatuma udashobora kwishyura imyenda ufite.';
    explanation = `While you have ${walletCash.toLocaleString('en-RW')} RWF in cash, committed group obligations (${obligations.toLocaleString('en-RW')} RWF) and debt (${debt.toLocaleString('en-RW')} RWF) require ${priorObligationsTotal.toLocaleString('en-RW')} RWF. Paying ${proposed.toLocaleString('en-RW')} RWF causes a ${Math.abs(totalCashAfterAll).toLocaleString('en-RW')} RWF deficit.`;
    explanationRw = `Nubwo ufite ${walletCash.toLocaleString('en-RW')} RWF, imisanzu n'imyenda bya ${priorObligationsTotal.toLocaleString('en-RW')} RWF birakenewe. Kwishyura ${proposed.toLocaleString('en-RW')} RWF bizatera igihombo cy'ingoboka cya ${Math.abs(totalCashAfterAll).toLocaleString('en-RW')} RWF.`;
    tradeoffs.push('Prioritize confirmed group obligations and loans to avoid late penalties or credit flags.');
    tradeoffsRw.push('Banza wishyure imisanzu n\'imyenda y\'amatsinda kugira ngo wirinde ibihano.');
  } else if (remainingDiscretionary < 0) {
    verdict = 'caution';
    headline = 'Caution: Contribution dips into your estimated household buffer.';
    headlineRw = 'Icyitonderwa: Uyu musanzu uragabanya amafaranga yagenewe ibitunga urugo.';
    const bufferDeficit = Math.abs(remainingDiscretionary);
    explanation = `You have enough cash to pay, but it will reduce your estimated household emergency buffer by ${bufferDeficit.toLocaleString('en-RW')} RWF (leaving ${Math.max(0, buffer - bufferDeficit).toLocaleString('en-RW')} RWF for living expenses).`;
    explanationRw = `Amafaranga arahari ariko araza kugabanya ayo wateganyirije urugo ku kigero cya ${bufferDeficit.toLocaleString('en-RW')} RWF (hasigare ${Math.max(0, buffer - bufferDeficit).toLocaleString('en-RW')} RWF yo kwifashisha).`;
    tradeoffs.push(`Short-term sacrifice: Household expense buffer drops by ${bufferDeficit.toLocaleString('en-RW')} RWF.`);
    tradeoffsRw.push(`Ubwitange bw'igihe gito: Ay'urugo agabanutseho ${bufferDeficit.toLocaleString('en-RW')} RWF.`);
  } else {
    tradeoffs.push(`Preserves your ${buffer.toLocaleString('en-RW')} RWF emergency safety net intact.`);
    tradeoffsRw.push(`Bikomeje kurinda amafaranga y'ingoboka y'urugo ${buffer.toLocaleString('en-RW')} RWF.`);
  }

  if (input.goalImpact) {
    const remainingToGoal = Math.max(0, input.goalImpact.target - input.goalImpact.saved);
    tradeoffs.push(`Remaining goal target for "${input.goalImpact.name}": ${remainingToGoal.toLocaleString('en-RW')} RWF.`);
    tradeoffsRw.push(`Ahasigaye ku ntego "${input.goalImpact.name}": ${remainingToGoal.toLocaleString('en-RW')} RWF.`);
  }

  const nextSteps: NextStepAction[] = [
    {
      label: 'Review Group Obligations',
      labelRw: 'Reba imisanzu yose y\'amatsinda',
      href: '/app/groups',
      kind: 'review'
    },
    {
      label: 'Compare Savings Plans',
      labelRw: 'Gereranya gahunda z\'ubwizigame',
      href: '/app/guardian',
      kind: 'compare'
    },
    {
      label: 'Manage Personal Wallets',
      labelRw: 'Genzura konti zawe z\'imari',
      href: '/app/personal',
      kind: 'action'
    }
  ];

  return {
    mode: 'member',
    question: 'contribution_affordability',
    verdict,
    headline,
    headlineRw,
    explanation,
    explanationRw,
    facts,
    formulas: [
      'Liquid after obligations = Wallet Cash − (Group Obligations + Active Debts)',
      'Discretionary cushion = Liquid after obligations − Household living buffer',
      'Remaining cushion = Discretionary cushion − Proposed contribution'
    ],
    assumptions: [
      'Wallet balances are verified from recorded personal accounts.',
      'Upcoming obligations and debts are scheduled for this cycle.',
      'Household living buffer is self-reported and unverified.',
      'No unrecorded cash or speculative income is counted.'
    ],
    tradeoffs,
    tradeoffsRw,
    missing: buffer === 0 ? ['Household living expense estimate was entered as 0 RWF.'] : [],
    nextSteps,
    synthetic: true,
    confidence: buffer > 0 ? 'high' : 'medium'
  };
}
