import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Actor, ActionInput } from '../src/lib/contracts';
import type { Database, Sql } from '../src/server/db';
import {
  createSavingsGroup,
  financeAction,
  financeState,
  type NewSavingsGroup
} from '../src/server/finance/service';

let pg: PGlite;
let db: Database;
let tenantNumber = 0;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = {
    query: (q, p) => pg.query(q, p),
    exec: q => pg.exec(q),
    transaction: fn => pg.transaction(tx => fn({ query: (q, p) => tx.query(q, p), exec: q => tx.exec(q) } as Sql))
  };

  for (const file of [
    '001-identity.sql',
    '002-finance.sql',
    '003-firebase-accounts.sql',
    '004-dual-savings-groups.sql',
    '005-workspace-onboarding.sql',
    '010-savings-group-administrator-label.sql',
    '012-dedicated-workspace.sql',
    '013-savings-group-roles-and-expenses.sql'
  ]) {
    await db.exec(await readFile(`migrations/${file}`, 'utf8'));
  }
});

after(async () => {
  await pg?.close();
});

async function fixture() {
  const tenantId = `sg-accounting-test-${++tenantNumber}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)', [tenantId]);

  // Create initial test users with tenant-scoped IDs
  const creatorId = `user-creator-${tenantId}`;
  const users = [
    { id: creatorId, name: 'Alice Creator', email: `creator-${tenantId}@test.invalid`, role: 'member' },
    { id: `user-member-1-${tenantId}`, name: 'Bob Member', email: `bob-${tenantId}@test.invalid`, role: 'member' },
    { id: `user-member-2-${tenantId}`, name: 'Carol Member', email: `carol-${tenantId}@test.invalid`, role: 'member' },
    { id: `user-member-3-${tenantId}`, name: 'David Member', email: `david-${tenantId}@test.invalid`, role: 'member' }
  ];

  for (const u of users) {
    await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [u.id, u.name, u.email, 'hash', u.role]);
    await db.query('INSERT INTO account_profiles(user_id,tenant_id,status,workspace) VALUES($1,$2,$3,$4)', [u.id, tenantId, 'active', 'personal']);
  }

  const creatorActor: Actor = { tenantId, userId: creatorId, role: 'member' };
  return { tenantId, creatorActor, users };
}

test('group creator is automatically assigned President role, workspace is set to groups, and default expense categories are seeded', async () => {
  const f = await fixture();
  const input: NewSavingsGroup = {
    model: 'ACCUMULATING',
    name: 'Duterimbere Savings Group',
    description: 'Community savings in Gasabo',
    location: 'Gasabo',
    contact: '0788111222',
    expectedMembers: 4,
    contributionAmount: 20000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    shareOutDate: '2026-12-31',
    rotationOrder: [],
    reserveBps: 1000,
    accepted: true
  };

  const created = await createSavingsGroup(db, f.creatorActor, input);
  assert.ok(created.orgId.startsWith('group-'));

  // 1. Verify membership role is president
  const membership = (await db.query('SELECT role FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, created.orgId, f.creatorActor.userId])).rows[0];
  assert.equal(membership.role, 'president');

  // 2. Verify app_users role is president
  const appUser = (await db.query('SELECT role FROM app_users WHERE id=$1', [f.creatorActor.userId])).rows[0];
  assert.equal(appUser.role, 'president');

  // 3. Verify account_profiles workspace is set to 'groups'
  const profile = (await db.query('SELECT workspace FROM account_profiles WHERE user_id=$1 AND tenant_id=$2', [f.creatorActor.userId, f.tenantId])).rows[0];
  assert.equal(profile.workspace, 'groups');

  // 4. Verify savings_group_role_history logged the creator role
  const history = (await db.query('SELECT * FROM savings_group_role_history WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, created.orgId, f.creatorActor.userId])).rows;
  assert.equal(history.length, 1);
  assert.equal(history[0].new_role, 'president');
  assert.equal(history[0].old_role, 'member');

  // 5. Verify default expense categories seeded
  const categories = (await db.query('SELECT name FROM savings_group_expense_categories WHERE tenant_id=$1 AND org_id=$2 ORDER BY name', [f.tenantId, created.orgId])).rows;
  assert.ok(categories.length >= 5);
  const catNames = categories.map(c => String(c.name));
  assert.ok(catNames.includes('Office & Administration'));
  assert.ok(catNames.includes('Bank & MoMo Fees'));
  assert.ok(catNames.includes('Meeting Refreshments'));
});

test('President can invite members and assign roles (Treasurer, Accountant, Secretary, Member) with audit history', async () => {
  const f = await fixture();
  const input: NewSavingsGroup = {
    model: 'ACCUMULATING',
    name: 'Urumuri Group',
    description: 'Test leadership roles',
    location: 'Kicukiro',
    contact: '0788333444',
    expectedMembers: 4,
    contributionAmount: 15000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    shareOutDate: '2026-12-31',
    rotationOrder: [],
    reserveBps: 1000,
    accepted: true
  };

  const created = await createSavingsGroup(db, f.creatorActor, input);
  const presidentActor: Actor = { tenantId: f.tenantId, userId: f.creatorActor.userId, role: 'president' };

  // Add members Bob and Carol
  await financeAction(db, presidentActor, {
    action: 'addGroupMember',
    orgId: created.orgId,
    name: 'Bob Member',
    phone: '0788111001',
    pin: '1234',
    role: 'member'
  });

  await financeAction(db, presidentActor, {
    action: 'addGroupMember',
    orgId: created.orgId,
    name: 'Carol Member',
    phone: '0788111002',
    pin: '1234',
    role: 'member'
  });

  const bobId = 'user-0788111001';
  const carolId = 'user-0788111002';

  // 1. President assigns Bob as 'accountant'
  const assignRes = await financeAction(db, presidentActor, {
    action: 'setGroupMemberRole',
    orgId: created.orgId,
    userId: bobId,
    memberRole: 'accountant'
  }) as Record<string, unknown>;
  assert.equal(assignRes.memberRole, 'accountant');

  // Verify Bob's membership and app_users role
  const bobMem = (await db.query('SELECT role FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, created.orgId, bobId])).rows[0];
  assert.equal(bobMem.role, 'accountant');
  const bobUser = (await db.query('SELECT role FROM app_users WHERE id=$1', [bobId])).rows[0];
  assert.equal(bobUser.role, 'accountant');

  // 2. President assigns Carol as 'secretary'
  await financeAction(db, presidentActor, {
    action: 'setGroupMemberRole',
    orgId: created.orgId,
    userId: carolId,
    memberRole: 'secretary'
  });
  const carolMem = (await db.query('SELECT role FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, created.orgId, carolId])).rows[0];
  assert.equal(carolMem.role, 'secretary');

  // 3. Verify role assignment history
  const roleHistory = (await db.query('SELECT * FROM savings_group_role_history WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at ASC', [f.tenantId, created.orgId])).rows;
  assert.ok(roleHistory.length >= 3);
  const bobHistory = roleHistory.find(h => h.user_id === bobId && h.new_role === 'accountant');
  assert.ok(bobHistory);
  assert.equal(bobHistory.old_role, 'member');
  assert.equal(bobHistory.assigned_by, presidentActor.userId);

  // 4. Accountant cannot assign roles (must be president)
  const accountantActor: Actor = { tenantId: f.tenantId, userId: bobId, role: 'accountant' };
  await assert.rejects(
    financeAction(db, accountantActor, {
      action: 'setGroupMemberRole',
      orgId: created.orgId,
      userId: carolId,
      memberRole: 'treasurer'
    }),
    /Your role cannot perform this action in this organization|Only the group president/
  );
});

test('3-step expense approval workflow: recording and approval do not alter cash balance; only confirmed payment updates cash through the ledger', async () => {
  const f = await fixture();
  const input: NewSavingsGroup = {
    model: 'ACCUMULATING',
    name: 'Terimbere Group',
    description: 'Expense lifecycle test',
    location: 'Nyarugenge',
    contact: '0788555666',
    expectedMembers: 3,
    contributionAmount: 50000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    shareOutDate: '2026-12-31',
    rotationOrder: [],
    reserveBps: 1000,
    accepted: true
  };

  const created = await createSavingsGroup(db, f.creatorActor, input);
  const orgId = created.orgId;
  const presidentActor: Actor = { tenantId: f.tenantId, userId: f.creatorActor.userId, role: 'president' };

  // Add Accountant Patrick and Treasurer Diane
  await financeAction(db, presidentActor, {
    action: 'addGroupMember',
    orgId,
    name: 'Patrick Accountant',
    phone: '0788222001',
    pin: '1234',
    role: 'accountant'
  });
  const patrickId = 'user-0788222001';
  const accountantActor: Actor = { tenantId: f.tenantId, userId: patrickId, role: 'accountant' };

  await financeAction(db, presidentActor, {
    action: 'addGroupMember',
    orgId,
    name: 'Diane Treasurer',
    phone: '0788222002',
    pin: '1234',
    role: 'treasurer'
  });
  const dianeId = 'user-0788222002';
  const treasurerActor: Actor = { tenantId: f.tenantId, userId: dianeId, role: 'treasurer' };

  // Fund the group treasury with initial contributions:
  // President contributes 100,000, Accountant contributes 100,000
  await financeAction(db, presidentActor, {
    action: 'contribute',
    orgId,
    amount: 100000,
    reference: `contrib-${Date.now()}-1`,
    outcome: 'success'
  });
  await financeAction(db, accountantActor, {
    action: 'contribute',
    orgId,
    amount: 100000,
    reference: `contrib-${Date.now()}-2`,
    outcome: 'success'
  });

  const stateBefore = await financeState(db, presidentActor, { orgId });
  const initialCash = stateBefore.treasury.cash;
  assert.equal(initialCash, 200000);

  // STEP 1: Accountant records an expense
  const recordRes = (await financeAction(db, accountantActor, {
    action: 'recordExpense',
    orgId,
    category: 'Office & Administration',
    title: 'Printed passbooks for all members',
    amount: 25000,
    description: '25 custom passbooks printed by local stationery shop',
    receiptAttachment: 'receipt-passbooks-001.pdf'
  })) as Record<string, unknown>;

  assert.equal(recordRes.status, 'recorded');
  const expenseId = String(recordRes.id);

  // Verify group cash balance is UNCHANGED after recording!
  const stateAfterRecord = await financeState(db, presidentActor, { orgId });
  assert.equal(stateAfterRecord.treasury.cash, initialCash);

  // Verify expense is in 'recorded' status in DB
  const expRow = (await db.query('SELECT * FROM savings_group_expenses WHERE id=$1', [expenseId])).rows[0];
  assert.equal(expRow.status, 'recorded');
  assert.equal(expRow.recorded_by, patrickId);
  assert.equal(expRow.receipt_attachment, 'receipt-passbooks-001.pdf');

  // Verify Accountant CANNOT approve expense (only President can approve)
  await assert.rejects(
    financeAction(db, accountantActor, {
      action: 'approveExpense',
      orgId,
      expenseId,
      decision: 'approve'
    }),
    /Your role cannot perform this action in this organization/
  );

  // STEP 2: President approves the expense
  const approveRes = (await financeAction(db, presidentActor, {
    action: 'approveExpense',
    orgId,
    expenseId,
    decision: 'approve'
  })) as Record<string, unknown>;

  assert.equal(approveRes.status, 'approved');

  // Verify group cash balance is STILL UNCHANGED after approval!
  const stateAfterApprove = await financeState(db, presidentActor, { orgId });
  assert.equal(stateAfterApprove.treasury.cash, initialCash);

  // Verify Accountant CANNOT confirm payment (only President/Treasurer can confirm)
  await assert.rejects(
    financeAction(db, accountantActor, {
      action: 'confirmExpensePayment',
      orgId,
      expenseId,
      outcome: 'success'
    }),
    /Your role cannot perform this action in this organization/
  );

  // STEP 3: Treasurer confirms the MoMo payment
  const confirmRes = (await financeAction(db, treasurerActor, {
    action: 'confirmExpensePayment',
    orgId,
    expenseId,
    outcome: 'success'
  })) as Record<string, unknown>;

  assert.equal(confirmRes.status, 'paid');

  // Verify group cash balance is NOW updated through the shared ledger!
  const stateAfterPayment = await financeState(db, presidentActor, { orgId });
  assert.equal(stateAfterPayment.treasury.cash, initialCash - 25000);
  assert.equal(stateAfterPayment.treasury.cash, 175000);

  // Verify expense row is updated with paid status, reference, and journal id
  const paidExpRow = (await db.query('SELECT * FROM savings_group_expenses WHERE id=$1', [expenseId])).rows[0];
  assert.equal(paidExpRow.status, 'paid');
  assert.ok(paidExpRow.payment_reference);
  assert.ok(paidExpRow.journal_id);

  // Verify the ledger contains the expense entry
  const journalEntry = (await db.query('SELECT * FROM finance_entries WHERE id=$1', [paidExpRow.journal_id])).rows[0];
  assert.ok(journalEntry);
  const lines = (await db.query('SELECT * FROM finance_lines WHERE entry_id=$1', [paidExpRow.journal_id])).rows;
  assert.equal(lines.length, 2);
  const expLine = lines.find(l => l.account === 'expenses');
  const cashLine = lines.find(l => l.account === 'cash');
  assert.equal(Number(expLine?.debit), 25000);
  assert.equal(Number(cashLine?.credit), 25000);
});

test('Accountant can record group income and create new expense categories', async () => {
  const f = await fixture();
  const input: NewSavingsGroup = {
    model: 'ACCUMULATING',
    name: 'Twitezimbere Group',
    description: 'Income and categories test',
    location: 'Gasabo',
    contact: '0788777888',
    expectedMembers: 3,
    contributionAmount: 10000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    shareOutDate: '2026-12-31',
    rotationOrder: [],
    reserveBps: 1000,
    accepted: true
  };

  const created = await createSavingsGroup(db, f.creatorActor, input);
  const orgId = created.orgId;
  const presidentActor: Actor = { tenantId: f.tenantId, userId: f.creatorActor.userId, role: 'president' };

  await financeAction(db, presidentActor, {
    action: 'addGroupMember',
    orgId,
    name: 'Paul Accountant',
    phone: '0788333001',
    pin: '1234',
    role: 'accountant'
  });
  const accountantActor: Actor = { tenantId: f.tenantId, userId: 'user-0788333001', role: 'accountant' };

  // Initial cash is 0
  const state0 = await financeState(db, accountantActor, { orgId });
  assert.equal(state0.treasury.cash, 0);

  // 1. Accountant creates a new expense category
  const catRes = (await financeAction(db, accountantActor, {
    action: 'createExpenseCategory',
    orgId,
    name: 'Assembly Refreshments & Tea',
    description: 'Refreshments provided during monthly meetings'
  })) as Record<string, unknown>;
  assert.equal(catRes.name, 'Assembly Refreshments & Tea');

  // Verify category exists
  const catRow = (await db.query('SELECT * FROM savings_group_expense_categories WHERE tenant_id=$1 AND org_id=$2 AND name=$3', [f.tenantId, orgId, 'Assembly Refreshments & Tea'])).rows[0];
  assert.ok(catRow);

  // 2. Accountant records group income (e.g. late penalty fees of 10,000 RWF)
  const incomeRes = (await financeAction(db, accountantActor, {
    action: 'recordIncome',
    orgId,
    amount: 10000,
    source: 'Late penalty fee',
    description: 'Meeting late fines collected from 5 members'
  })) as Record<string, unknown>;

  assert.equal(incomeRes.status, 'success');
  assert.equal(incomeRes.amount, 10000);

  // Cash increases by 10,000 through the ledger
  const state1 = await financeState(db, accountantActor, { orgId });
  assert.equal(state1.treasury.cash, 10000);

  // 3. Verify monthly report reflects the income
  assert.ok(state1.savingsGroup?.monthlyReports);
  assert.ok(state1.savingsGroup.monthlyReports.length > 0);
  const report = state1.savingsGroup.monthlyReports[0];
  assert.equal(report.totalIncome, 10000);
});

test('financeState exposes expenses, categories, role history, and computed monthly reports to both Ikimina and Amatsinda', async () => {
  const f = await fixture();

  // Test with Ikimina (ROTATING) group
  const input: NewSavingsGroup = {
    model: 'ROTATING',
    name: 'Ikimina Cyacu',
    description: 'Rotating group with accounting',
    location: 'Rwamagana',
    contact: '0788999000',
    expectedMembers: 2,
    contributionAmount: 20000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-03-01',
    shareOutDate: '2026-01-01',
    rotationOrder: ['Alice Creator', 'Eric Partner'],
    reserveBps: 0,
    accepted: true
  };

  const created = await createSavingsGroup(db, f.creatorActor, input);
  const orgId = created.orgId;
  const presidentActor: Actor = { tenantId: f.tenantId, userId: f.creatorActor.userId, role: 'president' };

  await financeAction(db, presidentActor, {
    action: 'addGroupMember',
    orgId,
    name: 'Eric Partner',
    phone: '0788444001',
    pin: '1234',
    role: 'accountant'
  });

  const state = await financeState(db, presidentActor, { orgId });
  assert.ok(state.savingsGroup);
  assert.equal(state.savingsGroup.model, 'ROTATING');
  assert.ok(Array.isArray(state.savingsGroup.expenses));
  assert.ok(Array.isArray(state.savingsGroup.expenseCategories));
  assert.ok(Array.isArray(state.savingsGroup.roleHistory));
  assert.ok(Array.isArray(state.savingsGroup.monthlyReports));
  assert.ok(state.savingsGroup.expenseCategories.length > 0);
});
