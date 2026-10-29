import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database, Sql } from '../src/server/db';
import { randomUUID } from 'node:crypto';

let pg: PGlite;
let db: Database;

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
    '017-personal-finance-extensions.sql'
  ]) {
    await db.exec(await readFile(`migrations/${file}`, 'utf8'));
  }
});

after(async () => {
  await pg?.close();
});

async function createTestUser(userId: string, tenantId: string) {
  await db.query('INSERT INTO demo_tenants(id) VALUES($1) ON CONFLICT DO NOTHING', [tenantId]);
  await db.query(
    'INSERT INTO app_users(id, name, email, password_hash, role) VALUES($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
    [userId, `Test User ${userId}`, `${userId}@huriza.test`, 'dummy-hash', 'member']
  );
}

test('personal financial accounts: can add accounts and adjust balances with integer RWF safety', async () => {
  const tenantId = `tenant-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  await createTestUser(userId, tenantId);

  // 1. Create MTN MoMo Account
  const momoId = randomUUID();
  await db.query(
    'INSERT INTO personal_wallets(id, tenant_id, user_id, institution, account_name, account_type, account_identifier, balance, notes) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [momoId, tenantId, userId, 'MTN MoMo', 'Daily Spending Wallet', 'mobile_money', '*182# · 0788 123 456', 150000, 'Primary MoMo account']
  );

  // 2. Create BK Account
  const bkId = randomUUID();
  await db.query(
    'INSERT INTO personal_wallets(id, tenant_id, user_id, institution, account_name, account_type, account_identifier, balance, notes) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [bkId, tenantId, userId, 'Bank of Kigali', 'Fixed Savings', 'bank', '4002-8899-1234', 500000, 'Emergency fund in bank']
  );

  // 3. Query all user accounts
  const { rows } = await db.query(
    'SELECT id, institution, account_name, balance FROM personal_wallets WHERE tenant_id=$1 AND user_id=$2 ORDER BY institution',
    [tenantId, userId]
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].institution, 'Bank of Kigali');
  assert.equal(Number(rows[0].balance), 500000);
  assert.equal(rows[1].institution, 'MTN MoMo');
  assert.equal(Number(rows[1].balance), 150000);

  // 4. Update balance
  await db.query(
    'UPDATE personal_wallets SET balance=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4',
    [185000, momoId, tenantId, userId]
  );

  const updated = (await db.query('SELECT balance FROM personal_wallets WHERE id=$1', [momoId])).rows[0];
  assert.equal(Number(updated.balance), 185000);

  // 5. Total balance calculation
  const total = rows.reduce((acc, r) => acc + BigInt(r.balance as string | number), 0n);
  assert.equal(total, 650000n);
});

test('personal income & expense with wallet linking updates balances automatically', async () => {
  const tenantId = `tenant-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  await createTestUser(userId, tenantId);

  const walletId = randomUUID();
  await db.query(
    'INSERT INTO personal_wallets(id, tenant_id, user_id, institution, account_name, account_type, account_identifier, balance) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
    [walletId, tenantId, userId, 'MTN MoMo', 'Personal MoMo', 'mobile_money', '0788 111 222', 100000]
  );

  // Simulate recordPersonalIncome depositing 250,000 into wallet
  const incomeAmount = 250000;
  const noteId = randomUUID();
  const incomeMessage = `[INCOME:salary:${incomeAmount}] Monthly consulting payout`;
  await db.transaction(async tx => {
    await tx.query('INSERT INTO notifications(id, tenant_id, user_id, message) VALUES($1, $2, $3, $4)', [noteId, tenantId, userId, incomeMessage]);
    await tx.query('UPDATE personal_wallets SET balance=balance+$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4', [incomeAmount, walletId, tenantId, userId]);
  });

  const afterIncome = (await db.query('SELECT balance FROM personal_wallets WHERE id=$1', [walletId])).rows[0];
  assert.equal(Number(afterIncome.balance), 350000);

  // Simulate recordPersonalExpense deducting 45,000 from wallet
  const expenseAmount = 45000;
  const expNoteId = randomUUID();
  const expenseMessage = `[EXPENSE:groceries:${expenseAmount}] Supermarket groceries`;
  await db.transaction(async tx => {
    await tx.query('INSERT INTO notifications(id, tenant_id, user_id, message) VALUES($1, $2, $3, $4)', [expNoteId, tenantId, userId, expenseMessage]);
    await tx.query('UPDATE personal_wallets SET balance=balance-$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4 AND balance>=$1', [expenseAmount, walletId, tenantId, userId]);
  });

  const afterExpense = (await db.query('SELECT balance FROM personal_wallets WHERE id=$1', [walletId])).rows[0];
  assert.equal(Number(afterExpense.balance), 305000);
});

test('personal loans & debts: records debts owed to others and loans owed to user with settlement workflow', async () => {
  const tenantId = `tenant-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  await createTestUser(userId, tenantId);

  // 1. Record debt user owes to Jean-Pierre ('i_owe')
  const iOweId = randomUUID();
  await db.query(
    'INSERT INTO personal_loans(id, tenant_id, user_id, counterparty_name, counterparty_phone, direction, amount, paid_amount, due_date, notes, status) VALUES($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)',
    [iOweId, tenantId, userId, 'Jean-Pierre Bizimana', '0788 555 123', 'i_owe', 50000, '2026-11-30', 'Borrowed for urgent fertilizer inputs', 'active']
  );

  // 2. Record loan Claire owes to user ('they_owe')
  const theyOweId = randomUUID();
  await db.query(
    'INSERT INTO personal_loans(id, tenant_id, user_id, counterparty_name, counterparty_phone, direction, amount, paid_amount, due_date, notes, status) VALUES($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)',
    [theyOweId, tenantId, userId, 'Claire Mukamana', '0788 777 888', 'they_owe', 80000, '2026-12-15', 'Lent for retail kiosk inventory restock', 'active']
  );

  // 3. Partial repayment on the debt
  await db.query(
    'UPDATE personal_loans SET paid_amount=paid_amount+$1, status=$2, updated_at=now() WHERE id=$3 AND tenant_id=$4 AND user_id=$5',
    [20000, 'partially_paid', iOweId, tenantId, userId]
  );

  const loanAfterPartial = (await db.query('SELECT amount, paid_amount, status FROM personal_loans WHERE id=$1', [iOweId])).rows[0];
  assert.equal(Number(loanAfterPartial.paid_amount), 20000);
  assert.equal(Number(loanAfterPartial.amount) - Number(loanAfterPartial.paid_amount), 30000);
  assert.equal(loanAfterPartial.status, 'partially_paid');

  // 4. Full final settlement
  await db.query(
    'UPDATE personal_loans SET paid_amount=amount, status=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3 AND user_id=$4',
    ['settled', iOweId, tenantId, userId]
  );

  const settledLoan = (await db.query('SELECT paid_amount, status FROM personal_loans WHERE id=$1', [iOweId])).rows[0];
  assert.equal(Number(settledLoan.paid_amount), 50000);
  assert.equal(settledLoan.status, 'settled');
});

test('personal investment planning: models venture capital, revenue, expense and profit margins', async () => {
  const tenantId = `tenant-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  await createTestUser(userId, tenantId);

  // Create Poultry Venture Plan
  const planId = randomUUID();
  const capital = 850000;
  const revenue = 1200000;
  const expenses = 680000;
  const horizon = 6;

  await db.query(
    'INSERT INTO personal_investment_plans(id, tenant_id, user_id, title, category, capital_required, projected_revenue, projected_expenses, time_horizon_months, notes, status) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [planId, tenantId, userId, '500-Broiler Poultry Cycle', 'agriculture', capital, revenue, expenses, horizon, 'Cycle with local feed supplier coop', 'planned']
  );

  const plan = (await db.query('SELECT * FROM personal_investment_plans WHERE id=$1', [planId])).rows[0];
  assert.equal(plan.title, '500-Broiler Poultry Cycle');
  assert.equal(Number(plan.capital_required), capital);
  assert.equal(Number(plan.projected_revenue), revenue);
  assert.equal(Number(plan.projected_expenses), expenses);

  const netProfit = Number(plan.projected_revenue) - Number(plan.projected_expenses);
  assert.equal(netProfit, 520000);

  const profitMargin = Math.round((netProfit / Number(plan.projected_revenue)) * 100);
  assert.equal(profitMargin, 43);

  // Payback period in months: capital / (net profit / horizon)
  const monthlyProfit = netProfit / horizon;
  const paybackMonths = Math.ceil(capital / monthlyProfit);
  assert.ok(paybackMonths <= 10);
});

test('tenant & user boundary isolation: users cannot mutate or read other users accounts, loans, or plans', async () => {
  const tenantA = `tenant-a-${randomUUID()}`;
  const userA = `user-a-${randomUUID()}`;
  const tenantB = `tenant-b-${randomUUID()}`;
  const userB = `user-b-${randomUUID()}`;

  await createTestUser(userA, tenantA);
  await createTestUser(userB, tenantB);

  const accountA = randomUUID();
  await db.query(
    'INSERT INTO personal_wallets(id, tenant_id, user_id, institution, account_name, account_type, balance) VALUES($1, $2, $3, $4, $5, $6, $7)',
    [accountA, tenantA, userA, 'MTN MoMo', 'User A MoMo', 'mobile_money', 90000]
  );

  // User B tries to update User A's account balance
  const updateResult = await db.query(
    'UPDATE personal_wallets SET balance=0 WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id',
    [accountA, tenantB, userB]
  );
  assert.equal(updateResult.rows.length, 0);

  // Balance remains untouched
  const check = (await db.query('SELECT balance FROM personal_wallets WHERE id=$1', [accountA])).rows[0];
  assert.equal(Number(check.balance), 90000);

  // User B query returns 0 accounts
  const userBAccounts = await db.query(
    'SELECT * FROM personal_wallets WHERE tenant_id=$1 AND user_id=$2',
    [tenantB, userB]
  );
  assert.equal(userBAccounts.rows.length, 0);
});
