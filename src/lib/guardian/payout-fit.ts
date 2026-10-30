import { integer } from '../guardian';
import type { Fact, GuardianResult, NextStepAction } from './types';

export interface PayoutFitInput {
  groupModel: 'ACCUMULATING' | 'ROTATING';
  groupName: string;
  currentCash: number;
  reserveBps: number;
  proposedPayoutAmount: number;
  recipientName: string;
  confirmedObligationsPool: number;
  hasOutstandingLoans: boolean;
  pendingPaymentHolds?: number;
}

export function evaluatePayoutFit(input: PayoutFitInput): GuardianResult {
  const currentCash = integer(input.currentCash, 'Current Cash');
  const reserveBps = integer(input.reserveBps, 'Reserve Bps', 0, 10000);
  const payout = integer(input.proposedPayoutAmount, 'Proposed Payout', 1);
  const pool = integer(input.confirmedObligationsPool, 'Confirmed Obligations Pool');
  const holds = input.pendingPaymentHolds ? integer(input.pendingPaymentHolds, 'Payment Holds') : 0;

  const requiredReserve = Number((BigInt(currentCash) * BigInt(reserveBps) + 9999n) / 10000n);
  const cashAfterPayout = Number(BigInt(currentCash) - BigInt(payout) - BigInt(holds));
  const reserveShortfall = Math.max(0, requiredReserve - cashAfterPayout);
  const remainingLendingCapacity = Math.max(0, cashAfterPayout - requiredReserve);

  const facts: Fact[] = [
    {
      key: 'group_cash',
      label: 'Treasury Cash Balance',
      labelRw: 'Amafaranga ari mu kigega cy\'itsinda',
      value: currentCash,
      formattedValue: `${currentCash.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: `Group: ${input.groupName} (${input.groupModel})`
    },
    {
      key: 'required_reserve',
      label: 'Protected Reserve Requirement',
      labelRw: 'Ikigega kigomba kurindwa (Reserve)',
      value: requiredReserve,
      formattedValue: `${requiredReserve.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: `${(reserveBps / 100).toFixed(1)}% statutory / bylaw buffer`
    },
    {
      key: 'proposed_payout',
      label: 'Proposed Payout Amount',
      labelRw: 'Amafaranga ateganyijwe guhembwa',
      value: payout,
      formattedValue: `${payout.toLocaleString('en-RW')} RWF`,
      source: 'assumption',
      notes: `Recipient: ${input.recipientName}`
    },
    {
      key: 'confirmed_pool',
      label: 'Confirmed Round Collections',
      labelRw: 'Amafaranga yamaze gukusanywa mu cyiciro',
      value: pool,
      formattedValue: `${pool.toLocaleString('en-RW')} RWF`,
      source: 'confirmed',
      notes: 'Total confirmed member payments for this round'
    },
    {
      key: 'cash_after_payout',
      label: 'Ending Cash After Payout',
      labelRw: 'Amafaranga azasigara mu kigega',
      value: cashAfterPayout,
      formattedValue: `${cashAfterPayout.toLocaleString('en-RW')} RWF`,
      source: 'estimate'
    }
  ];

  let verdict: GuardianResult['verdict'] = 'ok';
  let headline = `Payout of ${payout.toLocaleString('en-RW')} RWF to ${input.recipientName} is compliant with group bylaws.`;
  let headlineRw = `Ihemba rya ${payout.toLocaleString('en-RW')} RWF kuri ${input.recipientName} ryubahirije amategeko y'itsinda.`;
  let explanation = `The payout leaves ${cashAfterPayout.toLocaleString('en-RW')} RWF in the treasury, safely above the required ${requiredReserve.toLocaleString('en-RW')} RWF reserve.`;
  let explanationRw = `Nyuma yo guhemba, mu kigega hazasigara ${cashAfterPayout.toLocaleString('en-RW')} RWF, hejuru y'ikigega kirinzwe cya ${requiredReserve.toLocaleString('en-RW')} RWF.`;

  const tradeoffs: string[] = [];
  const tradeoffsRw: string[] = [];

  // Check 1: Rotating group cannot pay out more than confirmed collected obligations
  if (input.groupModel === 'ROTATING' && payout > pool) {
    verdict = 'not_advised';
    headline = 'Unfunded Payout: Payout exceeds confirmed member round collections.';
    headlineRw = 'Ihemba ridafite amafaranga: Ihemba riruta amafaranga amaze gukusanywa.';
    explanation = `In rotating group "${input.groupName}", a round payout cannot exceed confirmed member contributions. The proposed payout of ${payout.toLocaleString('en-RW')} RWF exceeds confirmed round collections (${pool.toLocaleString('en-RW')} RWF) by ${(payout - pool).toLocaleString('en-RW')} RWF.`;
    explanationRw = `Muri kimina cyo guhererekanya cya "${input.groupName}", ihemba ntirishobora kurenga ayakoranyijwe. ${payout.toLocaleString('en-RW')} RWF irarenga ${pool.toLocaleString('en-RW')} RWF ku kinyuranyo cya ${(payout - pool).toLocaleString('en-RW')} RWF.`;
    tradeoffs.push('Wait for outstanding member round obligations to confirm before issuing payout.');
    tradeoffsRw.push('Tegereza ko abanyamuryango bose bishyura umusanzu wabo mbere yo guhemba.');
  } else if (cashAfterPayout < 0 || reserveShortfall > 0) {
    // Check 2: Reserve breach
    verdict = 'not_advised';
    headline = 'Reserve Breach: Payout violates the group\'s protected liquidity reserve.';
    headlineRw = 'Kurenga ku kigega: Ihemba rirakungabanya ikigega kigomba gusigaramo.';
    explanation = `Executing this ${payout.toLocaleString('en-RW')} RWF disbursement would leave ${cashAfterPayout.toLocaleString('en-RW')} RWF in treasury, creating a ${reserveShortfall.toLocaleString('en-RW')} RWF shortfall below the ${requiredReserve.toLocaleString('en-RW')} RWF mandatory reserve.`;
    explanationRw = `Guhemba ${payout.toLocaleString('en-RW')} RWF birasiga ${cashAfterPayout.toLocaleString('en-RW')} RWF mu kigega, biteze igihombo cya ${reserveShortfall.toLocaleString('en-RW')} RWF munsi y'ikigega kirinzwe (${requiredReserve.toLocaleString('en-RW')} RWF).`;
    tradeoffs.push(`Cap the maximum safe payout at ${Math.max(0, currentCash - requiredReserve - holds).toLocaleString('en-RW')} RWF to protect the group reserve.`);
    tradeoffsRw.push(`Ihemba ridasagarira ikigega ntirigomba kurenga ${Math.max(0, currentCash - requiredReserve - holds).toLocaleString('en-RW')} RWF.`);
  } else if (input.groupModel === 'ACCUMULATING' && input.hasOutstandingLoans) {
    // Check 3: Accumulating group cycle settlement with outstanding loans
    verdict = 'caution';
    headline = 'Caution: Group has outstanding loans that must be recovered or written off.';
    headlineRw = 'Icyitonderwa: Itsinda rifite inguzanyo zitarishyurwa zibangamiye igabana ry\'imigabane.';
    explanation = `While treasury liquidity covers this payout, the group currently has active outstanding loans. In accumulating groups, cycle share-outs require all loans to be recovered or formally resolved.`;
    explanationRw = `Nubwo amafaranga ahari, hari inguzanyo zitarishyurwa. Mu matsinda yo kugurizanya, igabana risoza umwaka risaba ko inguzanyo zose zibanza gukemurwa.`;
    tradeoffs.push('Verify whether this is an ordinary emergency loan or an end-of-cycle share-out.');
    tradeoffsRw.push('Reba niba ari inguzanyo y\'ingoboka isanzwe cyangwa niba ari igabana ry\'imigabane ryo gusoza.');
  } else if (remainingLendingCapacity < Math.floor(requiredReserve / 4)) {
    // Check 4: Tight headroom warning
    verdict = 'caution';
    headline = 'Tight Liquidity: Group operates with narrow headroom after disbursement.';
    headlineRw = 'Amafaranga yegereye ku munsi: Hasigaye umwanya muto cyane wo kuguriza abandi.';
    explanation = `The payout is compliant, but leaves only ${remainingLendingCapacity.toLocaleString('en-RW')} RWF in excess of the mandatory reserve. Emergency loan requests may be constrained.`;
    explanationRw = `Ihemba ryemewe n'amategeko, ariko risize ${remainingLendingCapacity.toLocaleString('en-RW')} RWF yonyine hejuru y'ikigega kirinzwe. Ubushobozi bwo kuguriza buragabanuka.`;
    tradeoffs.push('Reserve remains protected, but emergency loan capacity is restricted.');
    tradeoffsRw.push('Ikigega kirinzwe ariko ubushobozi bwo guha abandi inguzanyo bwabaye buto.');
  }

  const nextSteps: NextStepAction[] = [
    {
      label: 'Review Group Treasury Ledger',
      labelRw: 'Reba igitabo cy\'imari cy\'itsinda',
      href: '/app/groups',
      kind: 'review'
    },
    {
      label: 'Examine Pending Obligations',
      labelRw: 'Genzura imisanzu itarishyurwa',
      href: '/app/groups',
      kind: 'review'
    }
  ];

  return {
    mode: 'officer',
    question: 'payout_fit',
    verdict,
    headline,
    headlineRw,
    explanation,
    explanationRw,
    facts,
    formulas: [
      'Required reserve = ceiling(Treasury cash × Reserve bps ÷ 10,000)',
      'Cash after payout = Treasury cash − Proposed payout − Payment holds',
      'Reserve shortfall = max(0, Required reserve − Cash after payout)',
      'Rotating payout cap = min(Confirmed round collections, Treasury cash − Required reserve)'
    ],
    assumptions: [
      'Treasury cash is verified from posted immutable journal balances.',
      'Confirmed collections reflect verified provider callbacks, not pledged amounts.',
      'Guardian does not disburse or approve funds; execution requires officer authorization.'
    ],
    tradeoffs,
    tradeoffsRw,
    missing: [],
    nextSteps,
    synthetic: true,
    confidence: 'high'
  };
}
