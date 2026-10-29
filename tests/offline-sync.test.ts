import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describeAction } from '../src/lib/offline/sync-engine';
import {
  enqueueAction,
  getPendingActions,
  getAllActions,
  updateAction,
  removeAction,
  clearSyncedActions,
  setCachedState,
  getCachedState
} from '../src/lib/offline/storage';

test('describeAction formats actions in English and Kinyarwanda', () => {
  const contributePayload = { action: 'contribute', amount: 5000 };
  assert.equal(describeAction(contributePayload, false), 'Group contribution (5,000 Frw)');
  assert.equal(describeAction(contributePayload, true), 'Umusanzu w’itsinda (5,000 Frw)');

  const goalPayload = { action: 'createGoal', name: 'Inzu y’ubucuruzi' };
  assert.equal(describeAction(goalPayload, false), 'Savings goal: Inzu y’ubucuruzi');
  assert.equal(describeAction(goalPayload, true), 'Intego yo kuzigama: Inzu y’ubucuruzi');

  const addSavingsPayload = { action: 'addGoalSavings', amount: 15000 };
  assert.equal(describeAction(addSavingsPayload, false), 'Added savings to goal (15,000 Frw)');
  assert.equal(describeAction(addSavingsPayload, true), 'Kuzigama ku ntego (15,000 Frw)');

  const expensePayload = { action: 'recordPersonalExpense', amount: 3500, note: 'Transport' };
  assert.equal(describeAction(expensePayload, false), 'Personal expense (3,500 Frw): Transport');
  assert.equal(describeAction(expensePayload, true), 'Amafaranga yasohotse (3,500 Frw): Transport');

  const incomePayload = { action: 'recordPersonalIncome', amount: 120000, source: 'Salire y’ukwezi' };
  assert.equal(describeAction(incomePayload, false), 'Personal income (120,000 Frw): Salire y’ukwezi');
  assert.equal(describeAction(incomePayload, true), 'Amafaranga yinjiye (120,000 Frw): Salire y’ukwezi');

  const repayPayload = { action: 'repay', amount: 20000 };
  assert.equal(describeAction(repayPayload, false), 'Loan repayment (20,000 Frw)');
  assert.equal(describeAction(repayPayload, true), 'Kwishyura inguzanyo (20,000 Frw)');

  const loanPayload = { action: 'requestLoan', amount: 50000 };
  assert.equal(describeAction(loanPayload, false), 'Loan request (50,000 Frw)');
  assert.equal(describeAction(loanPayload, true), 'Gusaba inguzanyo (50,000 Frw)');
});

test('offline outbox lifecycle: enqueue, query, update, clear', async () => {
  // In Node test environment, mock localStorage is simulated if window is absent
  const mockStorage = new Map<string, string>();
  (global as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, val: string) => mockStorage.set(key, val),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear()
    }
  };
  (global as any).localStorage = (global as any).window.localStorage;

  // 1. Enqueue an action
  const item1 = await enqueueAction({
    action: 'contribute',
    endpoint: '/api/actions',
    payload: { action: 'contribute', amount: 5000, orgId: 'group-ubumwe' },
    summary: 'Group contribution (5,000 Frw)',
    workspace: 'groups'
  });

  assert.ok(item1.id, 'item should receive unique ID');
  assert.equal(item1.status, 'pending');
  assert.equal(item1.attempts, 0);

  // 2. Enqueue a second action
  const item2 = await enqueueAction({
    action: 'recordPersonalExpense',
    endpoint: '/api/actions',
    payload: { action: 'recordPersonalExpense', amount: 2500, note: 'Seedlings' },
    summary: 'Personal expense (2,500 Frw): Seedlings',
    workspace: 'personal'
  });

  // 3. Query pending actions
  let pending = await getPendingActions();
  assert.equal(pending.length, 2);
  assert.equal(pending[0].id, item1.id);
  assert.equal(pending[1].id, item2.id);

  // 4. Update status to syncing then synced
  await updateAction(item1.id, { status: 'syncing', attempts: 1 });
  let all = await getAllActions();
  assert.equal(all.find((a) => a.id === item1.id)?.status, 'syncing');

  await updateAction(item1.id, { status: 'synced' });
  pending = await getPendingActions();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, item2.id);

  // 5. Update second item to failed with error
  await updateAction(item2.id, { status: 'failed', lastError: 'Amount exceeds limit' });
  pending = await getPendingActions();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].lastError, 'Amount exceeds limit');

  // 6. Clear synced items
  await clearSyncedActions();
  all = await getAllActions();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, item2.id);

  // 7. Remove item
  await removeAction(item2.id);
  all = await getAllActions();
  assert.equal(all.length, 0);

  // Clean up globals
  delete (global as any).window;
  delete (global as any).localStorage;
});

test('state caching stores and retrieves workspace snapshots', async () => {
  const mockStorage = new Map<string, string>();
  (global as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, val: string) => mockStorage.set(key, val),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear()
    }
  };
  (global as any).localStorage = (global as any).window.localStorage;

  const testState = {
    treasury: { cash: 100000, reserve: 20000 },
    member: { outstanding: 0, loanLimit: 300000 },
    user: { id: 'usr-1', name: 'Aimable' }
  };

  await setCachedState('state:personal:', testState);
  const cached = await getCachedState<typeof testState>('state:personal:');

  assert.ok(cached);
  assert.equal(cached.key, 'state:personal:');
  assert.equal(cached.data.user.name, 'Aimable');
  assert.ok(cached.savedAt);

  delete (global as any).window;
  delete (global as any).localStorage;
});

test('PWA manifest and Service Worker verification', () => {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'HURIZA — Financial Intelligence');
  assert.equal(manifest.short_name, 'HURIZA');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/app/personal');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

  // Verify icons exist on disk
  for (const icon of manifest.icons) {
    const iconDiskPath = path.join(process.cwd(), 'public', icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(iconDiskPath), `Icon ${icon.src} must exist at ${iconDiskPath}`);
  }

  // Verify service worker exists and has fetch listener
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js must exist in public directory');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert.ok(swContent.includes("addEventListener('fetch'"), 'sw.js must handle fetch events');
  assert.ok(swContent.includes("addEventListener('install'"), 'sw.js must handle install events');
  assert.ok(swContent.includes("addEventListener('sync'"), 'sw.js must handle background sync events');
});
