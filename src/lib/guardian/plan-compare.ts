import { integer, savingsPlan } from '../guardian';
import type { Fact, GuardianResult, NextStepAction } from './types';

export interface PlanOption {
  periods: number;
  label: string;
  perPeriod: number;
  remaining: number;
  isAffordable?: boolean;
}

export interface PlanCompareInput {
  target: number;
  saved: number;
  goalName?: string;
  periodsList?: number[]; // default [3, 6, 12]
  discretionaryPerPeriod?: number; // member's estimated available surplus per period
}

export function compareSavingsPlans(input: PlanCompareInput): GuardianResult & { plans: PlanOption[] } {
  const target = integer(input.target, 'Target', 1);
  const saved = integer(input.saved, 'Saved', 0);
  const discretionary = input.discretionaryPerPeriod !== undefined ? integer(input.discretionaryPerPeriod, 'Discretionary Surplus') : undefined;
  const periodsList = (input.periodsList && input.periodsList.length > 0 ? input.periodsList : [3, 6, 12])
    .map(p => integer(p, 'Period duration', 1, 120))
    .sort((a, b) => a - b);

  const remaining = Math.max(0, target - saved);
  const plans: PlanOption[] = periodsList.map(periods => {
    const plan = savingsPlan(target, saved, periods);
    const isAffordable = discretionary !== undefined ? plan.perPeriod <= discretionary : undefined;
    return {
      periods,
      label: `${periods} Months`,
      perPeriod: plan.perPeriod,
      remaining: plan.remaining,
      isAffordable
    };
  });

  const facts: Fact[] = [
    {
      key: 'target_amount',
      label: 'Goal Target',
      labelRw: 'Amafaranga yose akenewe',
      value: target,
      formattedValue: `${target.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: input.goalName ? `Goal: ${input.goalName}` : undefined
    },
    {
      key: 'current_saved',
      label: 'Current Amount Saved',
      labelRw: 'Amaze kuzigamwa',
      value: saved,
      formattedValue: `${saved.toLocaleString('en-RW')} RWF`,
      source: 'confirmed'
    },
    {
      key: 'remaining_target',
      label: 'Remaining Target to Complete',
      labelRw: 'Ahasigaye ngo ugere ku ntego',
      value: remaining,
      formattedValue: `${remaining.toLocaleString('en-RW')} RWF`,
      source: 'confirmed'
    }
  ];

  if (discretionary !== undefined) {
    facts.push({
      key: 'discretionary_surplus',
      label: 'Monthly Discretionary Surplus',
      labelRw: 'Amafaranga asaguka buri kwezi',
      value: discretionary,
      formattedValue: `${discretionary.toLocaleString('en-RW')} RWF`,
      source: 'estimate',
      notes: 'Available after wallet living expenses'
    });
  }

  // Evaluate recommended plan
  let recommended = plans[plans.length - 1]; // default longest
  if (discretionary !== undefined) {
    const affordablePlans = plans.filter(p => p.perPeriod <= discretionary);
    if (affordablePlans.length > 0) {
      // Pick the fastest affordable plan
      recommended = affordablePlans[0];
    }
  }

  const verdict: GuardianResult['verdict'] = remaining === 0
    ? 'ok'
    : (discretionary !== undefined && plans.every(p => p.perPeriod > discretionary))
      ? 'caution'
      : 'ok';

  let headline = `Plan comparison: Saving over ${recommended.periods} months requires ${recommended.perPeriod.toLocaleString('en-RW')} RWF/month.`;
  let headlineRw = `Igereranya: Kuzigama mu mezi ${recommended.periods} bisaba ${recommended.perPeriod.toLocaleString('en-RW')} RWF buri kwezi.`;

  if (remaining === 0) {
    headline = 'Goal target has already been fully reached!';
    headlineRw = 'Intego yawe warayigezeho 100%! Nta yandi mafaranga asigaye.';
  } else if (verdict === 'caution') {
    headline = `Goal target may be stretched: Even the longest ${plans[plans.length - 1].periods}-month plan exceeds current discretionary surplus.`;
    headlineRw = `Intego irasaba imbaraga: No mu mezi ${plans[plans.length - 1].periods} birasaba amafaranga arenze ayasaguka.`;
  }

  const explanation = remaining === 0
    ? `You have saved the entire ${target.toLocaleString('en-RW')} RWF for this goal.`
    : `To accumulate ${remaining.toLocaleString('en-RW')} RWF remaining: ${plans.map(p => `${p.periods} months at ${p.perPeriod.toLocaleString('en-RW')} RWF/mo`).join(', ')}. Choosing a shorter timeframe reaches your goal faster but requires higher monthly commitment.`;

  const explanationRw = remaining === 0
    ? `Warangije kuzigama ${target.toLocaleString('en-RW')} RWF yose y'iyi ntego.`
    : `Kugira ngo ugerweho ${remaining.toLocaleString('en-RW')} RWF asigaye: ${plans.map(p => `amezi ${p.periods} ku ${p.perPeriod.toLocaleString('en-RW')} RWF/kwezi`).join(', ')}. Guhitamo igihe kigufi bituma ugera ku ntego vuba ariko bisaba umusanzu munini.`;

  const tradeoffs = plans.map(p =>
    `${p.periods} Months: ${p.perPeriod.toLocaleString('en-RW')} RWF/mo ${p.isAffordable === false ? '(exceeds estimated monthly surplus)' : '(achievable within current cashflow)'}`
  );

  const tradeoffsRw = plans.map(p =>
    `Amezi ${p.periods}: ${p.perPeriod.toLocaleString('en-RW')} RWF/kwezi ${p.isAffordable === false ? '(birenze ayasaguka ku kwezi)' : '(birashoboka mu bushobozi bwawe)'}`
  );

  const nextSteps: NextStepAction[] = [
    {
      label: 'Update Goal Savings',
      labelRw: 'Ongeraho ubwizigame kuri iyi ntego',
      href: '/app/personal',
      kind: 'action'
    },
    {
      label: 'Adjust Personal Budget',
      labelRw: 'Hindura ingengo y\'imari yawe',
      href: '/app/personal',
      kind: 'compare'
    }
  ];

  return {
    mode: 'member',
    question: 'plan_compare',
    verdict,
    headline,
    headlineRw,
    explanation,
    explanationRw,
    facts,
    formulas: [
      'Remaining target = max(0, Goal target − Already saved)',
      'Per-period contribution = ceiling(Remaining target ÷ Number of periods)'
    ],
    assumptions: [
      'Contributions are deposited consistently at each period boundary.',
      'No interest, inflationary drag, or early withdrawal penalties are assumed.',
      'Ceiling rounding prevents fractional RWF underfunding.'
    ],
    tradeoffs,
    tradeoffsRw,
    missing: discretionary === undefined ? ['Monthly discretionary surplus not provided.'] : [],
    nextSteps,
    synthetic: true,
    confidence: 'high',
    plans
  };
}
