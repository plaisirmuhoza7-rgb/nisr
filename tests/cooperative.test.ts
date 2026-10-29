import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Actor, ActionInput } from '../src/lib/contracts';
import type { Database, Sql } from '../src/server/db';
import {
  createCooperative,
  joinCooperative,
  financeAction,
  financeState,
  type NewCooperative
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
    '013-savings-group-roles-and-expenses.sql',
    '014-cooperative-management.sql'
  ]) {
    await db.exec(await readFile(`migrations/${file}`, 'utf8'));
  }
});

after(async () => {
  await pg?.close();
});

async function fixture() {
  const tenantId = `coop-test-${++tenantNumber}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)', [tenantId]);

  const creatorId = `user-chair-${tenantId}`;
  const member1Id = `user-member-1-${tenantId}`;
  const member2Id = `user-member-2-${tenantId}`;
  const accountantId = `user-acct-${tenantId}`;
  const treasurerId = `user-tres-${tenantId}`;

  const users = [
    { id: creatorId, name: 'Jean Chairperson', email: `chair-${tenantId}@test.invalid`, role: 'cooperative' },
    { id: member1Id, name: 'Alice Mukamana', email: `alice-${tenantId}@test.invalid`, role: 'member' },
    { id: member2Id, name: 'Bosco Niyonzima', email: `bosco-${tenantId}@test.invalid`, role: 'member' },
    { id: accountantId, name: 'Claudine Accountant', email: `acct-${tenantId}@test.invalid`, role: 'accountant' },
    { id: treasurerId, name: 'David Treasurer', email: `tres-${tenantId}@test.invalid`, role: 'treasurer' }
  ];

  for (const u of users) {
    await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [u.id, u.name, u.email, 'hash', u.role]);
    await db.query('INSERT INTO account_profiles(user_id,tenant_id,status,workspace) VALUES($1,$2,$3,$4)', [u.id, tenantId, 'active', 'cooperative']);
  }

  const chairActor: Actor = { tenantId, userId: creatorId, role: 'cooperative' };
  const member1Actor: Actor = { tenantId, userId: member1Id, role: 'member' };
  const member2Actor: Actor = { tenantId, userId: member2Id, role: 'member' };
  const acctActor: Actor = { tenantId, userId: accountantId, role: 'accountant' };
  const tresActor: Actor = { tenantId, userId: treasurerId, role: 'treasurer' };

  return { tenantId, chairActor, member1Actor, member2Actor, acctActor, tresActor, users };
}

test('cooperative creation initializes profile, bylaw policies, creator membership, chairperson appointment and minimum shares', async () => {
  const f = await fixture();
  const input: NewCooperative = {
    name: 'Koperative Dufatanye Muhinzi',
    category: 'agriculture',
    district: 'Rulindo',
    sector: 'Buyoga',
    description: 'Agricultural cooperative producing maize and potatoes',
    contact: '0788123456',
    registrationNumber: 'RCA/0428/2021',
    nominalShareValue: 10000,
    minSharesPerMember: 5,
    statutoryReserveBps: 2000, // 20%
    socialFundBps: 1000,       // 10%
    dividendPoolBps: 4000,     // 40%
    bonusPoolBps: 6000         // 60%
  };

  const created = await createCooperative(db, f.chairActor, input);
  assert.ok(created.orgId.startsWith('coop-'));

  // 1. Verify profile
  const profile = (await db.query('SELECT * FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [f.tenantId, created.orgId])).rows[0];
  assert.equal(profile.category, 'agriculture');
  assert.equal(profile.sector, 'Buyoga');
  assert.equal(Number(profile.nominal_share_value), 10000);
  assert.equal(profile.min_shares_per_member, 5);

  // 2. Verify chairperson appointment
  const staff = (await db.query('SELECT * FROM cooperative_staff_appointments WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, created.orgId, f.chairActor.userId])).rows[0];
  assert.ok(staff);
  assert.equal(staff.title, 'Chairperson / President');

  // 3. Verify share account initialized
  const shareAcc = (await db.query('SELECT * FROM cooperative_share_accounts WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, created.orgId, f.chairActor.userId])).rows[0];
  assert.ok(shareAcc);
  assert.equal(shareAcc.shares_subscribed, 5);
  assert.equal(Number(shareAcc.amount_subscribed), 50000);
  assert.equal(Number(shareAcc.amount_outstanding), 50000);
  assert.equal(Number(shareAcc.amount_paid), 0);
});

test('member share capital workflow: subscription records obligation without cash change; payment updates cash via ledger', async () => {
  const f = await fixture();
  const created = await createCooperative(db, f.chairActor, {
    name: 'Twitezimbere Muhinzi',
    category: 'agriculture',
    district: 'Musanze',
    sector: 'Muhoza',
    description: 'Grain and potato farming',
    contact: '0788999888',
    nominalShareValue: 10000,
    minSharesPerMember: 5,
    statutoryReserveBps: 2000,
    socialFundBps: 1000,
    dividendPoolBps: 4000,
    bonusPoolBps: 6000
  });

  const orgId = created.orgId;
  await joinCooperative(db, f.member1Actor, orgId);

  // 1. Member Alice subscribes to 20 shares (200,000 RWF)
  const subRes = await financeAction(db, f.member1Actor, {
    action: 'subscribeCoopShares',
    orgId,
    shares: 20
  }) as Record<string, unknown>;
  assert.equal(subRes.status, 'subscribed');
  assert.equal(subRes.shares, 20);

  // Verify group cash is still 0
  const state0 = await financeState(db, f.chairActor, { orgId });
  assert.equal(state0.cooperative.cash, 0);

  // Verify share account has 20 + 5 (initial) = 25 shares subscribed
  const shareAcc1 = (await db.query('SELECT * FROM cooperative_share_accounts WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, orgId, f.member1Actor.userId])).rows[0];
  assert.equal(shareAcc1.shares_subscribed, 25);
  assert.equal(Number(shareAcc1.amount_outstanding), 250000);

  // 2. Alice pays for 20 shares (200,000 RWF)
  const payRes = await financeAction(db, f.member1Actor, {
    action: 'payCoopShares',
    orgId,
    shares: 20
  }) as Record<string, unknown>;
  assert.equal(payRes.status, 'paid');

  // Verify cooperative cash is now 200,000 RWF
  const state1 = await financeState(db, f.chairActor, { orgId });
  assert.equal(state1.cooperative.cash, 200000);
  assert.equal(state1.cooperative.shareCapital, 200000);

  // Verify share account updated
  const shareAcc2 = (await db.query('SELECT * FROM cooperative_share_accounts WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3', [f.tenantId, orgId, f.member1Actor.userId])).rows[0];
  assert.equal(shareAcc2.shares_paid, 20);
  assert.equal(Number(shareAcc2.amount_paid), 200000);
  assert.equal(Number(shareAcc2.amount_outstanding), 50000);
});

test('production deliveries and commercial sales: delivery records inventory obligation; confirmation pays member; sale records revenue', async () => {
  const f = await fixture();
  const created = await createCooperative(db, f.chairActor, {
    name: 'Abadahemuka Maize Coop',
    category: 'agriculture',
    district: 'Nyagatare',
    sector: 'Karangazi',
    description: 'Commercial maize farming',
    contact: '0788666555',
    nominalShareValue: 10000,
    minSharesPerMember: 5,
    statutoryReserveBps: 2000,
    socialFundBps: 1000,
    dividendPoolBps: 4000,
    bonusPoolBps: 6000
  });
  const orgId = created.orgId;

  // Add memberships for member1 and treasurer
  await joinCooperative(db, f.member1Actor, orgId);
  await db.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'treasurer') ON CONFLICT DO NOTHING", [f.tenantId, f.tresActor.userId, orgId]);

  // Fund cooperative treasury with initial share payment (subscribe then pay)
  await financeAction(db, f.chairActor, { action: 'subscribeCoopShares', orgId, shares: 50 });
  await financeAction(db, f.chairActor, { action: 'payCoopShares', orgId, shares: 50 }); // 500,000 RWF

  // 1. Member Alice delivers 1,000 kg of Maize @ 400 RWF/kg (400,000 RWF)
  const delivRes = await financeAction(db, f.chairActor, {
    action: 'recordCoopDelivery',
    orgId,
    userId: f.member1Actor.userId,
    productName: 'Maize (Ibigori)',
    category: 'grain',
    quantity: 1000,
    unit: 'kg',
    grade: 'Grade A',
    unitPrice: 400
  }) as Record<string, unknown>;
  assert.equal(delivRes.paymentStatus, 'pending');
  assert.equal(delivRes.totalValue, 400000);
  const deliveryId = String(delivRes.id);

  // Cash unchanged after delivery recording
  const stateAfterDeliv = await financeState(db, f.chairActor, { orgId });
  assert.equal(stateAfterDeliv.cooperative.cash, 500000);

  // 2. Treasurer confirms delivery payout of 400,000 RWF to Alice via MoMo
  const confirmDeliv = await financeAction(db, f.tresActor, {
    action: 'confirmDeliveryPayment',
    orgId,
    deliveryId
  }) as Record<string, unknown>;
  assert.equal(confirmDeliv.status, 'paid');

  // Cash reduces by 400,000 through the ledger
  const stateAfterDelivPay = await financeState(db, f.chairActor, { orgId });
  assert.equal(stateAfterDelivPay.cooperative.cash, 100000);

  // 3. Cooperative sells 2,000 kg of Maize to Rwanda Grains Processing Ltd @ 550 RWF/kg (1,100,000 RWF)
  const saleRes = await financeAction(db, f.chairActor, {
    action: 'recordCoopSale',
    orgId,
    buyerName: 'Rwanda Grains Processing Ltd',
    productName: 'Maize Grade A',
    quantity: 2000,
    unit: 'kg',
    unitPrice: 550
  }) as Record<string, unknown>;
  assert.equal(saleRes.status, 'paid');
  assert.equal(saleRes.totalAmount, 1100000);

  // Cash increases by 1,100,000 through the ledger
  const stateAfterSale = await financeState(db, f.chairActor, { orgId });
  assert.equal(stateAfterSale.cooperative.cash, 1200000);
  assert.equal(stateAfterSale.cooperative.revenue, 1100000);
});

test('HURIZA Member Value Engine: financial close, statutory reserve deduction, dividend & patronage bonus distribution workflow', async () => {
  const f = await fixture();
  const created = await createCooperative(db, f.chairActor, {
    name: 'Koperative Dufatanye Muhinzi Flagship',
    category: 'agriculture',
    district: 'Rulindo',
    sector: 'Buyoga',
    description: 'Flagship demo cooperative',
    contact: '0788111222',
    nominalShareValue: 10000,
    minSharesPerMember: 5,
    statutoryReserveBps: 2000, // 20%
    socialFundBps: 1000,       // 10%
    dividendPoolBps: 4000,     // 40%
    bonusPoolBps: 6000         // 60%
  });
  const orgId = created.orgId;

  // Add memberships
  await joinCooperative(db, f.member1Actor, orgId);
  await joinCooperative(db, f.member2Actor, orgId);

  // Alice buys 40 shares (400,000 RWF), Bosco buys 60 shares (600,000 RWF)
  await financeAction(db, f.member1Actor, { action: 'subscribeCoopShares', orgId, shares: 40 });
  await financeAction(db, f.member1Actor, { action: 'payCoopShares', orgId, shares: 40 });
  await financeAction(db, f.member2Actor, { action: 'subscribeCoopShares', orgId, shares: 60 });
  await financeAction(db, f.member2Actor, { action: 'payCoopShares', orgId, shares: 60 });

  // Deliveries: Alice delivers 1,000 kg (400,000 RWF), Bosco delivers 3,000 kg (1,200,000 RWF)
  const d1 = await financeAction(db, f.chairActor, { action: 'recordCoopDelivery', orgId, userId: f.member1Actor.userId, productName: 'Maize', quantity: 1000, unitPrice: 400 }) as Record<string, unknown>;
  const d2 = await financeAction(db, f.chairActor, { action: 'recordCoopDelivery', orgId, userId: f.member2Actor.userId, productName: 'Maize', quantity: 3000, unitPrice: 400 }) as Record<string, unknown>;

  // Commercial sale: 5,000,000 RWF brings in revenue
  await financeAction(db, f.chairActor, {
    action: 'recordCoopSale',
    orgId,
    buyerName: 'National Grains Corporation',
    productName: 'Processed Grain',
    quantity: 10000,
    unitPrice: 500
  });

  // Now confirm delivery payouts with ample treasury funds
  await financeAction(db, f.chairActor, { action: 'confirmDeliveryPayment', orgId, deliveryId: String(d1.id) });
  await financeAction(db, f.chairActor, { action: 'confirmDeliveryPayment', orgId, deliveryId: String(d2.id) });

  // 1. Calculate Surplus Allocation
  // Revenue: 5,000,000; Expenses: 1,600,000; Net Surplus: 3,400,000
  const calcRes = await financeAction(db, f.chairActor, {
    action: 'calculateSurplusAllocation',
    orgId,
    periodLabel: '2025/2026 Fiscal Season'
  }) as Record<string, unknown>;

  assert.equal(calcRes.status, 'calculated');
  const allocId = String(calcRes.id);

  // 2. Cannot distribute before General Assembly approval
  await assert.rejects(
    financeAction(db, f.chairActor, { action: 'distributeMemberSurplus', orgId, allocationId: allocId }),
    /General Assembly/
  );

  // 3. Chairperson records General Assembly approval
  const approveRes = await financeAction(db, f.chairActor, {
    action: 'approveSurplusAllocation',
    orgId,
    allocationId: allocId,
    resolutionRef: 'GA-RES-2026-001'
  }) as Record<string, unknown>;
  assert.equal(approveRes.status, 'approved_by_assembly');

  // 4. Execute Member Value Distribution
  const distRes = await financeAction(db, f.chairActor, {
    action: 'distributeMemberSurplus',
    orgId,
    allocationId: allocId
  }) as Record<string, unknown>;
  assert.equal(distRes.status, 'distributed');
  assert.ok(Number(distRes.totalPayout) > 0);
});

test('HURIZA Investment Guardian: digital twin simulates payback, reserve headroom, and risk verdict', async () => {
  const f = await fixture();
  const created = await createCooperative(db, f.chairActor, {
    name: 'Guardian Test Coop',
    category: 'processing',
    district: 'Rulindo',
    sector: 'Buyoga',
    description: 'Grain processing testing',
    contact: '0788333222',
    nominalShareValue: 10000,
    minSharesPerMember: 5,
    statutoryReserveBps: 2000, // 20%
    socialFundBps: 1000,
    dividendPoolBps: 4000,
    bonusPoolBps: 6000
  });
  const orgId = created.orgId;

  // Capitalize cooperative with 8,000,000 RWF (matching prompt example, subscribe then pay)
  await financeAction(db, f.chairActor, { action: 'subscribeCoopShares', orgId, shares: 800 });
  await financeAction(db, f.chairActor, { action: 'payCoopShares', orgId, shares: 800 });

  // Evaluate Proposed Processing Machine: Cost 3,000,000 RWF, Net Benefit 250,000 RWF/month
  const sim = await financeAction(db, f.chairActor, {
    action: 'simulateInvestmentProposal',
    orgId,
    title: 'Commercial Grain Sheller & Dryer',
    category: 'processing',
    capitalCost: 3000000,
    monthlyOperatingCost: 50000,
    expectedMonthlyBenefit: 300000,
    usefulLifeMonths: 60,
    financingSource: 'cash_reserve'
  }) as Record<string, unknown>;

  // Payback estimate: 3,000,000 / 250,000 = 12 months (matching prompt example!)
  assert.equal(sim.paybackMonths, 12);
  assert.equal(sim.remainingCashAfterPurchase, 5000000);
  assert.equal(sim.guardianVerdict, 'sustainable');
});
