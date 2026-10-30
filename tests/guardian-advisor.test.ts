import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAffordability,
  evaluateMissedPayment,
  compareSavingsPlans,
  evaluatePayoutFit,
  evaluateCycleHealth
} from '../src/lib/guardian';
import {
  extractNumbers,
  validateExplanationIntegrity,
  explainGuardianResult,
  clearGuardianAuditLogs,
  getGuardianAuditLogs
} from '../src/server/guardian/explain';
import { buildMemberGuardianContext, buildOfficerGuardianContext } from '../src/server/guardian/context';
import type { Database } from '../src/server/db';
import type { Actor } from '../src/lib/contracts';

test('Guardian Affordability: comfortably affordable scenario preserves buffer and returns ok', () => {
  const result = evaluateAffordability({
    walletCash: 100000,
    upcomingObligations: 10000,
    activeDebtDue: 15000,
    householdBuffer: 30000,
    proposedContribution: 20000
  });

  assert.equal(result.verdict, 'ok');
  assert.equal(result.synthetic, true);
  // Liquid: 100k - 25k = 75k. Discretionary before: 75k - 30k = 45k. Remaining after 20k: 25k.
  const cushionFact = result.facts.find(f => f.key === 'remaining_cushion');
  assert.equal(cushionFact?.value, 25000);
  assert.equal(cushionFact?.source, 'estimate');
  assert.match(result.explanation, /leaves 25,000 RWF/);
});

test('Guardian Affordability: contribution dipping into household living buffer flags caution', () => {
  const result = evaluateAffordability({
    walletCash: 50000,
    upcomingObligations: 10000,
    activeDebtDue: 0,
    householdBuffer: 30000,
    proposedContribution: 25000
  });

  // Liquid: 40k. Buffer: 30k. Remaining discretionary: 40k - 30k - 25k = -15k.
  assert.equal(result.verdict, 'caution');
  assert.match(result.headline, /dips into your estimated household buffer/i);
});

test('Guardian Affordability: contribution exceeding available wallet cash is not advised', () => {
  const result = evaluateAffordability({
    walletCash: 20000,
    upcomingObligations: 5000,
    activeDebtDue: 0,
    householdBuffer: 10000,
    proposedContribution: 50000
  });

  assert.equal(result.verdict, 'not_advised');
  assert.match(result.headline, /exceeds total wallet balance/i);
});

test('Guardian Affordability: rejects fractional or negative amounts with integer safety', () => {
  assert.throws(() => evaluateAffordability({
    walletCash: 100.5,
    upcomingObligations: 1000,
    activeDebtDue: 0,
    householdBuffer: 1000,
    proposedContribution: 1000
  }));

  assert.throws(() => evaluateAffordability({
    walletCash: 10000,
    upcomingObligations: -500,
    activeDebtDue: 0,
    householdBuffer: 1000,
    proposedContribution: 1000
  }));
});

test('Guardian Missed Payment: policy with explicit penalty calculates exact total and explains impact', () => {
  const result = evaluateMissedPayment({
    obligationAmount: 10000,
    dueDate: '2026-11-01',
    groupName: 'Itsinda Ubumwe',
    groupModel: 'ACCUMULATING',
    latePenalty: 1500,
    missedPolicy: 'flag',
    hasExplicitLatePenalty: true
  });

  assert.equal(result.verdict, 'caution');
  const totalFact = result.facts.find(f => f.key === 'total_due_with_penalty');
  assert.equal(totalFact?.value, 11500);
  assert.equal(totalFact?.source, 'confirmed');
  assert.match(result.explanation, /1,500 RWF penalty/);
});

test('Guardian Missed Payment: group without recorded penalty rule returns insufficient_information honestly', () => {
  const result = evaluateMissedPayment({
    obligationAmount: 10000,
    dueDate: '2026-11-01',
    groupName: 'Ikimina Cyacu',
    groupModel: 'ROTATING',
    latePenalty: 0,
    missedPolicy: '',
    hasExplicitLatePenalty: false
  });

  assert.equal(result.verdict, 'insufficient_information');
  assert.equal(result.confidence, 'low');
  assert.ok(result.missing.length > 0);
  assert.match(result.missing[0], /not recorded in group policy/i);
});

test('Guardian Plan Compare: rounds up per-period contribution and compares durations', () => {
  const result = compareSavingsPlans({
    target: 100000,
    saved: 25000,
    periodsList: [3, 6, 12],
    discretionaryPerPeriod: 15000
  });

  // Remaining target = 75,000 RWF
  // 3 months: 75,000 / 3 = 25,000 RWF (exceeds 15k -> isAffordable false)
  // 6 months: 75,000 / 6 = 12,500 RWF (affordable)
  // 12 months: 75,000 / 12 = 6,250 RWF (affordable)
  assert.equal(result.plans.length, 3);
  assert.equal(result.plans[0].perPeriod, 25000);
  assert.equal(result.plans[0].isAffordable, false);
  assert.equal(result.plans[1].perPeriod, 12500);
  assert.equal(result.plans[1].isAffordable, true);
  assert.equal(result.plans[2].perPeriod, 6250);
  assert.equal(result.plans[2].isAffordable, true);
  assert.equal(result.verdict, 'ok');
});

test('Guardian Plan Compare: fully saved goal reports completed status', () => {
  const result = compareSavingsPlans({
    target: 50000,
    saved: 50000
  });

  assert.equal(result.verdict, 'ok');
  assert.match(result.headline, /fully reached/i);
});

test('Guardian Payout Fit: rotating group payout exceeding confirmed collections is rejected', () => {
  const result = evaluatePayoutFit({
    groupModel: 'ROTATING',
    groupName: 'Ikimina Duterimbere',
    currentCash: 500000,
    reserveBps: 2000,
    proposedPayoutAmount: 100000,
    recipientName: 'Mukamana Diane',
    confirmedObligationsPool: 80000, // Only 80k confirmed, but proposing 100k
    hasOutstandingLoans: false
  });

  assert.equal(result.verdict, 'not_advised');
  assert.match(result.headline, /Unfunded Payout/i);
});

test('Guardian Payout Fit: payout breaching required liquidity reserve is rejected', () => {
  const result = evaluatePayoutFit({
    groupModel: 'ACCUMULATING',
    groupName: 'Itsinda Ishema',
    currentCash: 1000000,
    reserveBps: 2000, // Reserve = 200,000 RWF
    proposedPayoutAmount: 900000, // Leaving 100k, below 200k reserve
    recipientName: 'Kagabo Eric',
    confirmedObligationsPool: 1000000,
    hasOutstandingLoans: false
  });

  assert.equal(result.verdict, 'not_advised');
  assert.match(result.headline, /Reserve Breach/i);
});

test('Guardian Payout Fit: compliant payout preserves reserve and returns ok', () => {
  const result = evaluatePayoutFit({
    groupModel: 'ROTATING',
    groupName: 'Ikimina Duterimbere',
    currentCash: 500000,
    reserveBps: 2000, // Reserve = 100,000 RWF
    proposedPayoutAmount: 100000,
    recipientName: 'Mukamana Diane',
    confirmedObligationsPool: 100000,
    hasOutstandingLoans: false
  });

  assert.equal(result.verdict, 'ok');
  assert.match(result.headline, /is compliant/i);
});

test('Guardian Cycle Health: evaluates stress scenario with delayed inflows', () => {
  const result = evaluateCycleHealth({
    groupName: 'Itsinda Ubumwe',
    cash: 5000000,
    reserveBps: 2000,
    confirmedContributions: 100000,
    confirmedRepayments: 200000,
    outstandingLoans: 600000,
    repaymentDelayBps: 5000, // 50% delay
    plannedLoanRequests: 3,
    plannedLoanAmount: 150000
  });

  assert.equal(result.mode, 'officer');
  assert.ok(['ok', 'caution', 'not_advised'].includes(result.verdict));
  assert.ok(result.facts.some(f => f.key === 'ending_cash'));
});

test('Safety Explainer: extracts numbers accurately', () => {
  const nums = extractNumbers('Paying 25,000 RWF leaves 45,000 RWF in reserve with 10% buffer.');
  assert.deepEqual(nums, [25000, 45000, 10]);
});

test('Safety Explainer: validates explanation where all figures are grounded in facts', () => {
  const dummyResult = evaluateAffordability({
    walletCash: 100000,
    upcomingObligations: 10000,
    activeDebtDue: 0,
    householdBuffer: 20000,
    proposedContribution: 15000
  });

  const validText = `Paying 15,000 RWF leaves 55,000 RWF discretionary cushion above your 20,000 RWF living buffer.`;
  const check = validateExplanationIntegrity(validText, dummyResult);
  assert.equal(check.valid, true);
});

test('Safety Explainer: rejects explanation containing ungrounded invented financial numbers', () => {
  const dummyResult = evaluateAffordability({
    walletCash: 100000,
    upcomingObligations: 10000,
    activeDebtDue: 0,
    householdBuffer: 20000,
    proposedContribution: 15000
  });

  // 999,999 RWF is invented
  const invalidText = `Paying 15,000 RWF gives you an unexpected bonus of 999,999 RWF.`;
  const check = validateExplanationIntegrity(invalidText, dummyResult);
  assert.equal(check.valid, false);
  assert.match(check.reason || '', /Unverified number 999999/);
});

test('Safety Explainer: rejects forbidden transaction execution or guarantee claims', () => {
  const dummyResult = evaluateAffordability({
    walletCash: 100000,
    upcomingObligations: 0,
    activeDebtDue: 0,
    householdBuffer: 0,
    proposedContribution: 10000
  });

  const forbiddenText = `Guardian has approved your loan and funds have been transferred.`;
  const check = validateExplanationIntegrity(forbiddenText, dummyResult);
  assert.equal(check.valid, false);
  assert.match(check.reason || '', /Forbidden claim/);
});

test('Safety Explainer: records audit log for every execution', async () => {
  clearGuardianAuditLogs();
  const dummyResult = evaluateAffordability({
    walletCash: 50000,
    upcomingObligations: 0,
    activeDebtDue: 0,
    householdBuffer: 0,
    proposedContribution: 5000
  });

  await explainGuardianResult(dummyResult, 'en');
  const logs = getGuardianAuditLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].question, 'contribution_affordability');
  assert.equal(logs[0].validated, true);
});

test('Context Builder: member cannot access another user or organization records', async () => {
  // Test mock db simulating isolation
  const queryLog: { sql: string; params: any[] }[] = [];
  const mockDb = {
    async query(sql: string, params: any[]) {
      queryLog.push({ sql, params });
      return { rows: [] };
    }
  } as unknown as Database;

  const actor: Actor = { tenantId: 'tenant-alpha', userId: 'user-alice', role: 'member' };
  const ctx = await buildMemberGuardianContext(mockDb, actor);

  assert.equal(ctx.userId, 'user-alice');
  assert.equal(ctx.totalWalletBalance, 0);
  // Verify that all executed queries contain tenant_id and user_id scoping parameters
  for (const q of queryLog) {
    assert.deepEqual(q.params, ['tenant-alpha', 'user-alice']);
  }
});

test('Context Builder: officer access fails closed for plain member role', async () => {
  const mockDb = {
    async query() { return { rows: [] }; }
  } as unknown as Database;

  const plainMember: Actor = { tenantId: 'tenant-demo', userId: 'user-bob', role: 'member' };
  // Plain member attempting to build officer context for group-ubumwe must fail with 403
  await assert.rejects(
    () => buildOfficerGuardianContext(mockDb, plainMember, 'group-ubumwe'),
    (err: any) => err.status === 403
  );
});

test('Context Builder: anonymous request without credentials rejects with 401', async () => {
  const mockDb = {} as Database;
  const anon: Actor = { tenantId: '', userId: '', role: 'member' };
  await assert.rejects(
    () => buildMemberGuardianContext(mockDb, anon),
    (err: any) => err.status === 401
  );
});
