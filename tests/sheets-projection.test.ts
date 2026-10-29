import test from 'node:test';
import assert from 'node:assert/strict';
import type { FinanceState } from '../src/lib/contracts';
import { projectSavingsGroupForSheets } from '../src/server/sheets/projection';

const state = (): FinanceState => ({
  savingsGroup: {
    id: 'group-a', name: 'Secret group name', district: 'District', model: 'ACCUMULATING',
    memberCount: 3, memberRole: 'president', members: [{ id: 'user-private', name: 'Private', role: 'member' }],
    expectedMembers: 4, contributionAmount: 1000, frequency: 'weekly', cycleStart: 'date', cycleEnd: 'date',
    cycleStatus: 'open', reserveBps: 500, emergencyLending: false, rotationRounds: [], obligations: [],
    shareOut: { contributions: 3000, cash: 2000, reserve: 500, outstandingLoans: 100, pending: 400, distributable: 1000, ready: true },
  },
  treasury: { cash: 0, reserve: 0, pending: 0, lendingCapacity: 0, outstandingLoans: 0, contributions: 0 },
  member: { eligibleSavings: 0, loanLimit: 0, outstanding: 0 }, contributions: [], loans: [], ledger: [], payments: [],
  campaigns: [], cooperative: { cash: 0, reserve: 0, shareCapital: 0, revenue: 0, expenses: 0, assets: [], proposals: [] },
  impact: { groups: 0, members: 0, savings: 0, loans: 0, reportingCompleteness: 0, organizations: [] }, alerts: [],
});

test('projects a scoped, simulated aggregate without identifying or financial detail rows', () => {
  const result = projectSavingsGroupForSheets(state(), 'group-a');
  assert.equal(result.title, 'SIMULATED savings group summary');
  assert.match(String(result.values[0][0]), /SIMULATED/);
  assert.deepEqual(result.values.slice(2), [
    ['Members', 3], ['Contribution amount (RWF)', 1000], ['Contributions (RWF)', 3000],
    ['Cash (RWF)', 2000], ['Reserve (RWF)', 500], ['Outstanding loans (RWF)', 100],
    ['Pending (RWF)', 400], ['Distributable (RWF)', 1000],
  ]);
  const serialized = JSON.stringify(result);
  for (const secret of ['group-a', 'Secret group name', 'user-private', 'Private', 'District']) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('refuses missing savings group and mismatched organization scope', () => {
  const missing = state();
  delete missing.savingsGroup;
  assert.throws(() => projectSavingsGroupForSheets(missing, 'group-a'), /scope mismatch/);
  assert.throws(() => projectSavingsGroupForSheets(state(), 'group-b'), /scope mismatch/);
});

test('rejects negative, fractional, and unsafe monetary amounts', () => {
  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const invalidState = state();
    invalidState.savingsGroup!.shareOut.cash = invalid;
    assert.throws(() => projectSavingsGroupForSheets(invalidState, 'group-a'), /safe integer RWF/);
  }
});
