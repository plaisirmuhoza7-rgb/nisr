import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import type { Actor, ActionInput } from '../src/lib/contracts';
import { migrate, type Database, type Sql } from '../src/server/db';
import { financeAction, financeState, seedFinance } from '../src/server/finance/service';

let pg: PGlite;
let db: Database;
let tenantCounter = 0;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = {
    query: (q, p) => pg.query(q, p),
    exec: q => pg.exec(q),
    transaction: fn =>
      pg.transaction(tx => fn({ query: (q, p) => tx.query(q, p), exec: q => tx.exec(q) } as Sql)),
  };
  await migrate(db);

  for (const [id, name, role] of [
    ['member', 'Aline Uwase', 'member'],
    ['president', 'Jean Mugisha', 'president'],
    ['treasurer', 'Diane Keza', 'treasurer'],
    ['cooperative', 'Imena Coop Admin', 'cooperative'],
    ['ngo', 'Dr. Clarisse Mukandori', 'ngo'],
  ] as const) {
    await db.query(
      'INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$1,$4) ON CONFLICT (id) DO NOTHING',
      [id, name, `${id}@test.invalid`, role]
    );
  }
});

after(async () => {
  await pg?.close();
});

async function fixture() {
  const tenantId = `ngo-test-${++tenantCounter}`;
  await db.query('INSERT INTO demo_tenants(id) VALUES($1)', [tenantId]);
  for (const role of ['member', 'president', 'treasurer', 'cooperative', 'ngo'] as const) {
    const orgs =
      role === 'ngo'
        ? ['ngo-imizi', 'fund-school']
        : role === 'cooperative'
        ? ['coop-imena', 'fund-school']
        : ['group-ubumwe', 'group-hope', 'fund-school'];
    for (const org of orgs) {
      await db.query(
        'INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4)',
        [tenantId, role, org, role]
      );
    }
  }
  await seedFinance(db, tenantId);
  const actor = (role: Actor['role'], userId = role): Actor => ({ tenantId, userId, role });
  return {
    tenantId,
    member: actor('member'),
    president: actor('president'),
    treasurer: actor('treasurer'),
    coop: actor('cooperative'),
    ngo: actor('ngo'),
  };
}

async function act(actor: Actor, input: ActionInput): Promise<Record<string, unknown>> {
  return (await financeAction(db, actor, input)) as Record<string, unknown>;
}

test('HURIZA Impact seeds Community Growth Initiative Rwanda, ImpactTrace chains, NISR district context, and enforces group member privacy', async () => {
  const f = await fixture();
  const state = await financeState(db, f.ngo);

  // Privacy invariant: NGO state never exposes individual savings group member loans, contributions, or ledger lines
  assert.equal(state.loans.length, 0);
  assert.equal(state.contributions.length, 0);
  assert.equal(state.payments.length, 0);
  assert.equal(state.ledger.length, 0);
  assert.equal(state.impact.groups, 2);
  assert.equal(state.impact.savings, 2000000);

  const ngo = state.ngoState;
  assert.ok(ngo, 'ngoState should be populated for NGO actor');
  assert.equal(ngo.profile.orgId, 'ngo-imizi');
  assert.ok(ngo.profile.name.includes('Community Growth Initiative Rwanda'));
  assert.deepEqual(ngo.profile.operatingDistricts, ['Gasabo', 'Kicukiro', 'Rulindo', 'Rwamagana', 'Huye']);

  // Flagship KPIs & Linked Entities
  assert.equal(ngo.kpis.supportedSavingsGroupsCount, 80);
  assert.equal(ngo.kpis.supportedCooperativesCount, 12);
  assert.equal(ngo.kpis.enrolledBeneficiariesCount, 2000);
  assert.ok(ngo.linkedEntities.some(e => e.orgId === 'group-ubumwe' && e.entityType === 'itsinda_savings_group'));
  assert.ok(ngo.linkedEntities.some(e => e.orgId === 'group-hope' && e.entityType === 'ikimina_rotating_group'));
  assert.ok(ngo.linkedEntities.some(e => e.orgId === 'coop-imena' && e.entityType === 'cooperative'));

  // ImpactTrace chains & 5 Guardian lenses
  assert.ok(ngo.impactTraceChains.length >= 5);
  assert.equal(ngo.guardianInsights.length, 5);
  assert.equal(ngo.districtContexts.length, 5);
});

test('NGO 4-step restricted expense workflow enforces budget line caps and only updates spent_amount on payment confirmation', async () => {
  const f = await fixture();
  const initial = (await financeState(db, f.ngo)).ngoState!;
  const blBefore = initial.budgetLines.find(b => b.lineCode === 'BL-101')!;

  // Overspending beyond unallocated budget line limit is rejected
  await assert.rejects(
    () =>
      act(f.ngo, {
        action: 'requestNgoExpense',
        programId: 'prog-frc-2026',
        grantId: 'grant-rift-2026',
        budgetLineId: 'bl-101',
        title: 'Excessive Unbudgeted Procurement',
        amount: 95000000,
      }),
    /exceeds remaining unallocated budget/i
  );

  // Step 1: Propose a valid 2,000,000 RWF expense on bl-101
  await act(f.ngo, {
    action: 'requestNgoExpense',
    programId: 'prog-frc-2026',
    grantId: 'grant-rift-2026',
    budgetLineId: 'bl-101',
    title: 'Gasabo Group Treasurer Refresher Kits',
    vendorName: 'Kigali Print & Supply',
    amount: 2000000,
  });

  const afterPropose = (await financeState(db, f.ngo)).ngoState!;
  const proposedExp = afterPropose.expenses.find(e => e.title === 'Gasabo Group Treasurer Refresher Kits')!;
  assert.equal(proposedExp.status, 'proposed');
  const blAfterPropose = afterPropose.budgetLines.find(b => b.lineCode === 'BL-101')!;
  assert.equal(blAfterPropose.committedAmount, blBefore.committedAmount + 2000000);
  assert.equal(blAfterPropose.spentAmount, blBefore.spentAmount, 'Proposed expense must not deduct spent cash');

  // Cannot confirm payment before finance approval
  await assert.rejects(
    () =>
      act(f.ngo, {
        action: 'confirmNgoExpensePayment',
        expenseId: proposedExp.id,
        paymentReference: 'MOMO-EARLY-999',
      }),
    /must receive Finance\/Director approval/i
  );

  // Step 2: Program Manager Review
  await act(f.ngo, {
    action: 'reviewNgoExpense',
    expenseId: proposedExp.id,
  });
  const afterReview = (await financeState(db, f.ngo)).ngoState!;
  assert.equal(afterReview.expenses.find(e => e.id === proposedExp.id)?.status, 'program_reviewed');

  // Step 3: Finance / Director Approval
  await act(f.ngo, {
    action: 'approveNgoExpense',
    expenseId: proposedExp.id,
  });
  const afterApprove = (await financeState(db, f.ngo)).ngoState!;
  assert.equal(afterApprove.expenses.find(e => e.id === proposedExp.id)?.status, 'finance_approved');
  assert.equal(
    afterApprove.budgetLines.find(b => b.lineCode === 'BL-101')?.spentAmount,
    blBefore.spentAmount,
    'Approved expense still must not deduct spent cash until payment confirmation'
  );

  // Step 4: Confirm Payment
  await act(f.ngo, {
    action: 'confirmNgoExpensePayment',
    expenseId: proposedExp.id,
    paymentReference: 'MOMO-NGO-CONFIRMED-777',
  });
  const afterPaid = (await financeState(db, f.ngo)).ngoState!;
  const paidExp = afterPaid.expenses.find(e => e.id === proposedExp.id)!;
  assert.equal(paidExp.status, 'paid');
  assert.equal(paidExp.paymentReference, 'MOMO-NGO-CONFIRMED-777');
  assert.equal(
    afterPaid.budgetLines.find(b => b.lineCode === 'BL-101')?.spentAmount,
    blBefore.spentAmount + 2000000
  );
});

test('NGO staff provisioning, read-only donor viewer guard, field sync, MEAL verification, and donor access revocation', async () => {
  const f = await fixture();

  // Add a new MEAL officer and a Donor Viewer account
  await act(f.ngo, {
    action: 'addNgoStaffMember',
    userId: 'staff-donor-test',
    fullName: 'External Donor Observer',
    email: 'donor-test@rift.org',
    phone: '+250788999111',
    ngoRole: 'donor_viewer',
    department: 'Donor Oversight',
    locationDistrict: 'Gasabo',
  });

  const donorActor: Actor = { tenantId: f.tenantId, userId: 'staff-donor-test', role: 'ngo' };
  const donorState = (await financeState(db, donorActor)).ngoState!;
  assert.equal(donorState.viewerRole, 'donor_viewer');
  assert.equal(donorState.viewerPermissions.isReadOnlyDonorOrAuditor, true);

  // Donor viewer cannot mutate NGO programs or approve expenses
  await assert.rejects(
    () =>
      act(donorActor, {
        action: 'createNgoProgram',
        name: 'Unauthorized Donor Program',
      }),
    /read-only institutional access/i
  );

  // Sync offline field visits, verify indicator, resolve data quality issue, generate & approve report, and revoke donor grant
  await act(f.ngo, { action: 'syncOfflineFieldVisits' });
  await act(f.ngo, {
    action: 'verifyNgoIndicator',
    indicatorId: 'ind-106',
    currentValue: 235,
    verificationStatus: 'approved',
  });
  await act(f.ngo, {
    action: 'resolveDataQualityIssue',
    issueId: 'dq-101',
    resolutionNote: 'Signed Huye safeguarding attendance sheet uploaded and verified.',
  });
  await act(f.ngo, {
    action: 'generateNgoReportSnapshot',
    programId: 'prog-frc-2026',
    grantId: 'grant-rift-2026',
    title: 'Q3 2026 Verified ImpactTrace Accountability Pack',
    reportType: 'donor_quarterly',
    reportingPeriod: '2026-Q3',
  });
  await act(f.ngo, {
    action: 'grantNgoDonorAccess',
    programId: 'prog-frc-2026',
    donorName: 'Nordic Development Partner',
    donorEmail: 'audit@nordic-dev.org',
    permissionsScope: 'aggregates_and_reports',
  });

  const updated = (await financeState(db, f.ngo)).ngoState!;
  assert.equal(updated.fieldVisits.filter(v => v.syncStatus === 'queued_offline').length, 0);
  const ind106 = updated.indicators.find(i => i.code === 'IND-ACT-01')!;
  assert.equal(ind106.currentValue, 235);
  assert.equal(ind106.verificationStatus, 'approved');
  assert.equal(updated.dataQualityIssues.find(d => d.issueType === 'missing_evidence')?.status, 'resolved');

  const nordicGrant = updated.donorAccessGrants.find(g => g.donorName === 'Nordic Development Partner')!;
  assert.equal(nordicGrant.status, 'active');

  await act(f.ngo, {
    action: 'revokeNgoDonorAccess',
    accessGrantId: nordicGrant.id,
  });
  const afterRevoke = (await financeState(db, f.ngo)).ngoState!;
  assert.equal(afterRevoke.donorAccessGrants.find(g => g.id === nordicGrant.id)?.status, 'revoked');
});
