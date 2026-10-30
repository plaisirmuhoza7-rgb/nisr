import { integer } from '../guardian';
import type { Fact, GuardianResult, NextStepAction } from './types';

export interface MissedPaymentInput {
  obligationAmount: number;
  dueDate: string;
  groupName: string;
  groupModel: 'ACCUMULATING' | 'ROTATING';
  latePenalty: number;
  missedPolicy: string; // 'flag' | 'delay_round' | string
  hasExplicitLatePenalty: boolean;
  memberCurrentSavings?: number;
}

export function evaluateMissedPayment(input: MissedPaymentInput): GuardianResult {
  const amount = integer(input.obligationAmount, 'Obligation Amount', 1);
  const penalty = integer(input.latePenalty, 'Late Penalty', 0);
  const currentSavings = input.memberCurrentSavings !== undefined ? integer(input.memberCurrentSavings, 'Current Savings') : 0;

  const facts: Fact[] = [
    {
      key: 'obligation_amount',
      label: 'Scheduled Contribution Amount',
      labelRw: 'Amafaranga y\'umusanzu wagombaga gutangwa',
      value: amount,
      formattedValue: `${amount.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: `Due date: ${input.dueDate}`
    },
    {
      key: 'late_penalty',
      label: 'Bylaw Late Penalty',
      labelRw: 'Ibihano byo gutinda kwishyura (amategeko)',
      value: penalty,
      formattedValue: `${penalty.toLocaleString('en-RW')} RWF`,
      source: input.hasExplicitLatePenalty ? 'confirmed' : 'missing',
      notes: input.hasExplicitLatePenalty ? 'Configured in group policy' : 'No explicit penalty set in group policy'
    },
    {
      key: 'total_due_with_penalty',
      label: 'Total Required to Settle',
      labelRw: 'Amafaranga yose hamwe n\'ihazabu',
      value: amount + penalty,
      formattedValue: `${(amount + penalty).toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: 'Scheduled amount plus applicable penalty'
    }
  ];

  if (input.memberCurrentSavings !== undefined) {
    facts.push({
      key: 'member_savings',
      label: 'Your Current Group Equity / Savings',
      labelRw: 'Ubwizigame bwawe buri mu itsinda kugeza ubu',
      value: currentSavings,
      formattedValue: `${currentSavings.toLocaleString('en-RW')} RWF`,
      source: 'confirmed'
    });
  }

  // Handle missing policy definition case honestly
  if (!input.hasExplicitLatePenalty && penalty === 0 && !input.missedPolicy) {
    return {
      mode: 'member',
      question: 'missed_payment',
      verdict: 'insufficient_information',
      headline: 'Insufficient Information: Group policy has not recorded a late penalty rule.',
      headlineRw: 'Amakuru adahagije: Amategeko y\'itsinda ntarashyiraho amande yo gutinda.',
      explanation: `While your scheduled payment of ${amount.toLocaleString('en-RW')} RWF was due on ${input.dueDate}, ${input.groupName} has not registered an explicit monetary fine or grace period in its digital policy.`,
      explanationRw: `Nubwo wagombaga kwishyura ${amount.toLocaleString('en-RW')} RWF ku wa ${input.dueDate}, itsinda ${input.groupName} ntirirashyiraho amande afatika mu mategeko yaryo yanditse.`,
      facts,
      formulas: ['Total due = Scheduled amount + Bylaw penalty (unspecified)'],
      assumptions: ['Group governance decisions take precedence when bylaws do not specify a penalty.'],
      tradeoffs: ['Inform the group treasurer early to prevent rotation halts or relationship friction.'],
      tradeoffsRw: ['Menyesha umubitsi w\'itsinda hakiri kare kugira ngo gahunda y\'itsinda idahagarara.'],
      missing: ['Group late penalty amount or grace period not recorded in group policy.'],
      nextSteps: [
        {
          label: 'Contact Group Leadership',
          labelRw: 'Vugana n\'abayobozi b\'itsinda',
          href: '/app/groups',
          kind: 'ask_officer'
        },
        {
          label: 'View Group Policy Rules',
          labelRw: 'Reba amategeko y\'itsinda',
          href: '/app/groups',
          kind: 'review'
        }
      ],
      synthetic: true,
      confidence: 'low'
    };
  }

  const isRotating = input.groupModel === 'ROTATING';
  let verdict: GuardianResult['verdict'] = penalty > 0 ? 'caution' : 'ok';
  let headline = isRotating
    ? 'Missed round payment impacts rotation timing and triggers late fee.'
    : 'Missed contribution records an overdue flag and incurs policy penalty.';
  let headlineRw = isRotating
    ? 'Kutishyura umusanzu bitinza umuryango wose kandi bikazana amande.'
    : 'Kutishyura byanditsweko watinze kandi bizana amande y\'amategeko.';

  const explanation = isRotating
    ? `In rotating group "${input.groupName}", failing to contribute ${amount.toLocaleString('en-RW')} RWF on ${input.dueDate} triggers a ${penalty.toLocaleString('en-RW')} RWF late penalty (totaling ${(amount + penalty).toLocaleString('en-RW')} RWF) and ${input.missedPolicy === 'delay_round' ? 'delays payout disbursement to this round\'s scheduled recipient' : 'flags your account for the cycle administrator'}.`
    : `In accumulating group "${input.groupName}", missed contribution of ${amount.toLocaleString('en-RW')} RWF incurs a ${penalty.toLocaleString('en-RW')} RWF penalty (totaling ${(amount + penalty).toLocaleString('en-RW')} RWF). It reduces your proportional share at annual settlement.`;

  const explanationRw = isRotating
    ? `Muri kimina cya "${input.groupName}", kutishyura ${amount.toLocaleString('en-RW')} RWF ku wa ${input.dueDate} bituma ucibwa amande ya ${penalty.toLocaleString('en-RW')} RWF (yose hamwe: ${(amount + penalty).toLocaleString('en-RW')} RWF) kandi ${input.missedPolicy === 'delay_round' ? 'bitinza ihererekanya ry\'uwagombaga guhembwa' : 'bikagushyira ku rutonde rw\'abatinze'}.`
    : `Mu itsinda ryo kuzigama rya "${input.groupName}", kutishyura ${amount.toLocaleString('en-RW')} RWF byongeraho amande ya ${penalty.toLocaleString('en-RW')} RWF (yose hamwe: ${(amount + penalty).toLocaleString('en-RW')} RWF). Binagabanya umugabane wawe ku iherezo ry\'umwaka.`;

  const tradeoffs = [
    `Total obligation to settle increases by ${penalty.toLocaleString('en-RW')} RWF.`,
    isRotating
      ? 'Peer impact: Other members waiting for their rotation pool may experience delays.'
      : 'Settlement impact: Lower total contribution reduces your share of group interest at cycle close.'
  ];

  const tradeoffsRw = [
    `Amafaranga usabwa kwishyura yiyongereyeho ${penalty.toLocaleString('en-RW')} RWF y'amande.`,
    isRotating
      ? 'Ingaruka ku bandi: Abanyamuryango bategereje guhembwa bishobora kubatinda.'
      : 'Ingaruka ku mugabane: Kugabanya umusanzu bigabanya inyungu uzahabwa umwaka urangiye.'
  ];

  const nextSteps: NextStepAction[] = [
    {
      label: 'Pay Obligation Now',
      labelRw: 'Ishyura uyu musanzu nonaha',
      href: '/app/groups',
      kind: 'action'
    },
    {
      label: 'Consult Group Treasurer',
      labelRw: 'Vugana n\'umubitsi w\'itsinda',
      href: '/app/groups',
      kind: 'ask_officer'
    }
  ];

  return {
    mode: 'member',
    question: 'missed_payment',
    verdict,
    headline,
    headlineRw,
    explanation,
    explanationRw,
    facts,
    formulas: [
      'Total due with penalty = Obligation amount + Group policy late penalty',
      'Ikimina round status = Delayed if required pool is unmet on scheduled due date'
    ],
    assumptions: [
      'Group policy rules recorded in the database are currently active.',
      'Waiving penalties requires formal officer reconciliation through group governance.'
    ],
    tradeoffs,
    tradeoffsRw,
    missing: [],
    nextSteps,
    synthetic: true,
    confidence: 'high'
  };
}
