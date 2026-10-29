import test from 'node:test';
import assert from 'node:assert/strict';
import type { FinanceState } from '../src/lib/contracts';
import { projectWorkspaceForSheets } from '../src/server/sheets/workspace-projection';

function state(): FinanceState {
  return {
    treasury: { cash: 0, reserve: 0, pending: 0, lendingCapacity: 0, outstandingLoans: 0, contributions: 0 },
    member: { eligibleSavings: 0, loanLimit: 0, outstanding: 0 },
    contributions: [{ id: 'private-contribution-id', member: 'Private member', amount: 999, status: 'success', date: 'date' }],
    loans: [], ledger: [], payments: [{ id: 'payment-id', kind: 'donation', amount: 5, status: 'success', reference: 'PRIVATE-REF' }],
    campaigns: [{ id: 'campaign-id', title: '=Campaign title', category: 'Education', description: 'A user supplied campaign description.', target: 1000, raised: 250, spent: 20, status: 'active' }],
    cooperative: {
      cash: 1200, reserve: 200, shareCapital: 300, revenue: 400, expenses: 50,
      assets: [{ name: 'Equipment', value: 600 }],
      proposals: [{ id: 'proposal-id', title: 'Storage proposal', amount: 700, status: 'proposed', votes: 2 }],
    },
    impact: { groups: 0, members: 0, savings: 0, loans: 0, reportingCompleteness: 0, organizations: [] },
    alerts: [],
  };
}

test('cooperative projection includes safe aggregates, assets and proposal fields only', () => {
  const result = projectWorkspaceForSheets(state(), { kind: 'cooperative' });
  assert.equal(result.title, 'SIMULATED cooperative summary');
  assert.deepEqual(result.values.slice(0, 7), [
    ['SIMULATED cooperative summary'], ['Aggregate', 'Value'], ['Cash (RWF)', 1200],
    ['Reserve (RWF)', 200], ['Share capital (RWF)', 300], ['Revenue (RWF)', 400], ['Expenses (RWF)', 50],
  ]);
  assert.ok(result.values.some(row => row[0] === 'Storage proposal' && row[1] === 700 && row[2] === 'proposed' && row[3] === 2));
  const output = JSON.stringify(result);
  for (const privateValue of ['proposal-id', 'campaign-id', 'payment-id', 'PRIVATE-REF', 'private-contribution-id', 'Private member']) {
    assert.equal(output.includes(privateValue), false);
  }
});

test('fundraising projection preserves user text in RAW-compatible cells and omits other workspace data', () => {
  const result = projectWorkspaceForSheets(state(), { kind: 'fundraising' });
  assert.equal(result.workspace, 'fundraising');
  assert.deepEqual(result.values[2], ['=Campaign title', 'Education', 'A user supplied campaign description.', 1000, 250, 20, 'active']);
  const output = JSON.stringify(result);
  assert.equal(output.includes('Storage proposal'), false);
  assert.equal(output.includes('PRIVATE-REF'), false);
});

test('rejects unsafe money, invalid counts, overlong text, and over-cap lists', () => {
  const invalidMoney = state();
  invalidMoney.cooperative.cash = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => projectWorkspaceForSheets(invalidMoney, { kind: 'cooperative' }), /safe integer RWF/);

  const invalidVotes = state();
  invalidVotes.cooperative.proposals[0].votes = -1;
  assert.throws(() => projectWorkspaceForSheets(invalidVotes, { kind: 'cooperative' }), /votes/);

  const overlong = state();
  overlong.campaigns[0].description = 'x'.repeat(2001);
  assert.throws(() => projectWorkspaceForSheets(overlong, { kind: 'fundraising' }), /at most 2000/);

  const overCap = state();
  overCap.campaigns = Array.from({ length: 101 }, (_, i) => ({ ...overCap.campaigns[0], id: String(i) }));
  assert.throws(() => projectWorkspaceForSheets(overCap, { kind: 'fundraising' }), /row limit/);
});
