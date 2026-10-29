import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Actor, ActionInput } from '../src/lib/contracts';
import type { Database, Sql } from '../src/server/db';
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
  await db.exec(await readFile('migrations/001-identity.sql', 'utf8'));
  await db.exec(await readFile('migrations/002-finance.sql', 'utf8'));
  await db.exec(await readFile('migrations/003-firebase-accounts.sql', 'utf8'));
  await db.exec(await readFile('migrations/004-dual-savings-groups.sql', 'utf8'));
  await db.exec(await readFile('migrations/010-savings-group-administrator-label.sql', 'utf8'));
  await db.exec(await readFile('migrations/013-savings-group-roles-and-expenses.sql', 'utf8'));
  await db.exec(await readFile('migrations/014-cooperative-management.sql', 'utf8'));
  await db.exec(await readFile('migrations/015-fundraising-platform.sql', 'utf8'));

  for (const [id, name, role] of [
    ['member', 'Aline Uwase', 'member'],
    ['president', 'Jean Mugisha', 'president'],
    ['treasurer', 'Diane Keza', 'treasurer'],
    ['cooperative', 'Imena Coop Admin', 'cooperative'],
    ['ngo', 'Imizi NGO Officer', 'ngo'],
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
  const tenantId = `fund-test-${++tenantCounter}`;
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
  const actor = (role: Actor['role']): Actor => ({ tenantId, userId: role, role });
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

test('seed initializes all 5 flagship campaigns and createCampaign generates unique human-readable slugs with child-welfare safeguards', async () => {
  const f = await fixture();
  const state = await financeState(db, f.president);
  assert.ok(state.fundraisingState);
  const slugs = state.fundraisingState.campaigns.map(c => c.slug);
  for (const expectedSlug of [
    'support-school-children',
    'uwase-wedding-2026',
    'celebrate-aline-birthday',
    'community-water-project',
    'medical-support-jean-bosco',
  ]) {
    assert.ok(slugs.includes(expectedSlug), `Expected seeded slug ${expectedSlug}`);
  }

  // Create two campaigns with identical title to verify unique slug suffixing
  const c1 = await act(f.member, {
    action: 'createCampaign',
    title: 'Mugabo & Keza Wedding 2026',
    family: 'moments',
    subcategory: 'wedding',
    description: 'Traditional introduction and wedding celebration.',
    target: 2500000,
  });
  const c2 = await act(f.member, {
    action: 'createCampaign',
    title: 'Mugabo & Keza Wedding 2026',
    family: 'moments',
    subcategory: 'wedding',
    description: 'Second wedding campaign with same title.',
    target: 1500000,
  });
  assert.equal(c1.slug, 'mugabo-keza-wedding-2026');
  assert.equal(c2.slug, 'mugabo-keza-wedding-2026-2');

  // Child welfare campaign automatically enforces protective defaults
  const childCamp = await act(f.member, {
    action: 'createCampaign',
    title: 'Primary Learners Nutrition Support',
    family: 'causes',
    subcategory: 'child_welfare',
    beneficiaryType: 'child_protected',
    description: 'Aggregated school meal support for primary students.',
    target: 1200000,
    contributorsVisibility: 'everyone',
  });
  const afterState = await financeState(db, f.member);
  const createdChild = afterState.fundraisingState!.campaigns.find(c => c.id === childCamp.id)!;
  assert.equal(createdChild.privacyPolicy.contributorsVisibility, 'team_only');
  assert.equal(createdChild.verificationStatus, 'pending_review');
});

test('campaign visibility (public, unlisted, private) and selected contributor statistics access & revocation are enforced server-side', async () => {
  const f = await fixture();

  // 1. Verify seeded wedding campaign ('uwase-wedding-2026') has selected_contributors stats visibility:
  // 'member' was granted selected_stats in seed, whereas 'ngo' was not.
  const ngoState = await financeState(db, f.ngo);
  const weddingForNgo = ngoState.fundraisingState!.campaigns.find(
    c => c.slug === 'uwase-wedding-2026'
  )!;
  assert.ok(weddingForNgo);
  assert.equal(weddingForNgo.viewerAccess.canViewRaised, false);
  assert.equal(weddingForNgo.viewerAccess.canViewGoal, false);
  assert.equal(weddingForNgo.raised, null);
  assert.equal(weddingForNgo.target, null);

  const memberState = await financeState(db, f.member);
  const weddingForMember = memberState.fundraisingState!.campaigns.find(
    c => c.slug === 'uwase-wedding-2026'
  )!;
  assert.equal(weddingForMember.viewerAccess.canViewRaised, true);
  assert.equal(weddingForMember.viewerAccess.canViewGoal, true);
  assert.equal(weddingForMember.target, 3500000);

  // 2. Organizer ('president') revokes 'member' access to selected_stats on wedding campaign
  await act(f.president, {
    action: 'revokeCampaignAccess',
    campaignId: weddingForMember.id,
    userId: f.member.userId,
    grantType: 'selected_stats',
  });

  const memberAfterRevoke = await financeState(db, f.member);
  const weddingAfterRevoke = memberAfterRevoke.fundraisingState!.campaigns.find(
    c => c.slug === 'uwase-wedding-2026'
  )!;
  assert.equal(weddingAfterRevoke.viewerAccess.canViewRaised, false);
  assert.equal(weddingAfterRevoke.raised, null);
  assert.equal(weddingAfterRevoke.target, null);

  // 3. Create a private campaign owned by 'president'
  const priv = await act(f.president, {
    action: 'createCampaign',
    title: 'Private Family Emergency Fund',
    family: 'causes',
    subcategory: 'emergency',
    description: 'Invitation-only family solidarity campaign.',
    target: 1000000,
    visibility: 'private',
  });

  // Uninvited member cannot see private campaign at all
  const memberNoPriv = await financeState(db, f.member);
  assert.equal(
    memberNoPriv.fundraisingState!.campaigns.find(c => c.id === priv.id),
    undefined
  );

  // Grant private_view to member -> member can now view it
  await act(f.president, {
    action: 'grantCampaignAccess',
    campaignId: String(priv.id),
    userId: f.member.userId,
    grantType: 'private_view',
  });
  const memberWithPriv = await financeState(db, f.member);
  assert.ok(memberWithPriv.fundraisingState!.campaigns.find(c => c.id === priv.id));

  // Revoke private_view -> immediately hidden again
  await act(f.president, {
    action: 'revokeCampaignAccess',
    campaignId: String(priv.id),
    userId: f.member.userId,
    grantType: 'private_view',
  });
  const memberRevokedPriv = await financeState(db, f.member);
  assert.equal(
    memberRevokedPriv.fundraisingState!.campaigns.find(c => c.id === priv.id),
    undefined
  );
});

test('simulated contributions, pledges, gift registry items, and supporter anonymity work accurately', async () => {
  const f = await fixture();
  const initial = await financeState(db, f.president);
  const wedding = initial.fundraisingState!.campaigns.find(c => c.slug === 'uwase-wedding-2026')!;
  const giftItem = wedding.giftItems[0];
  assert.ok(giftItem);

  // 1. Confirmed donation towards a gift item updates raised, ledger, and gift item progress
  await act(f.member, {
    action: 'donate',
    campaignId: wedding.id,
    amount: 50000,
    outcome: 'success',
    reference: 'wed-gift-contrib-1',
    channel: 'mtn_momo',
    displayPreference: 'anonymous',
    giftItemId: giftItem.id,
    message: 'Anonymous wedding blessing!',
  });

  // 2. Failed donation and unconfirmed pledge never inflate confirmed raised cash
  await act(f.member, {
    action: 'donate',
    campaignId: wedding.id,
    amount: 200000,
    outcome: 'failed',
    reference: 'wed-failed-1',
  });
  await act(f.coop, {
    action: 'donate',
    campaignId: wedding.id,
    amount: 300000,
    contributionType: 'pledge',
    reference: 'wed-pledge-1',
    message: 'Pledging 300k next week',
  });

  // Check organizer view: raised is exactly 50,000, pledgedTotal is 300,000, gift item increased by 50,000
  const orgView = (await financeState(db, f.president)).fundraisingState!.campaigns.find(
    c => c.id === wedding.id
  )!;
  assert.equal(orgView.raised, 50000);
  assert.equal(orgView.pledgedTotal, 300000);
  assert.equal(
    orgView.giftItems.find(g => g.id === giftItem.id)!.contributedAmount,
    giftItem.contributedAmount + 50000
  );

  // Check public/other viewer ('ngo') for supporter anonymity:
  // 'member' donated anonymously, so 'ngo' sees 'Anonymous Supporter' and never sees 'Aline Uwase' on that contribution
  const ngoView = (await financeState(db, f.ngo)).fundraisingState!.campaigns.find(
    c => c.id === wedding.id
  )!;
  const anonContribution = ngoView.contributions.find(c => c.message === 'Anonymous wedding blessing!')!;
  assert.ok(anonContribution);
  assert.equal(anonContribution.contributorName, 'Anonymous Supporter');
  assert.equal(anonContribution.userId, 'supporter');
});

test('3-step TrustFlow expense workflow updates milestones and ledger only after independent approval and payment confirmation', async () => {
  const f = await fixture();
  const initial = await financeState(db, f.president);
  const school = initial.fundraisingState!.campaigns.find(
    c => c.slug === 'support-school-children'
  )!;
  const milestone = school.milestones[0];
  assert.ok(milestone);
  assert.equal(school.raised, 850000);
  assert.equal(school.spent, 0);

  // Step 1: Treasurer requests a 400,000 RWF expense linked to Milestone 1
  const exp = await act(f.treasurer, {
    action: 'requestExpense',
    campaignId: school.id,
    amount: 400000,
    title: 'Purchase 1,200 Exercise Books',
    category: 'Learning Materials',
    vendorName: 'Kigali Stationery Supply Ltd',
    receiptUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85',
    milestoneId: milestone.id,
    description: 'Invoice #INV-2026-88 for primary school notebooks',
  });
  assert.equal(exp.status, 'requested');

  // Self-approval by requester (treasurer) is rejected
  await assert.rejects(
    act(f.treasurer, { action: 'approveExpense', expenseId: exp.id }),
    /role cannot|different authorized person/
  );

  // Step 2: Independent approval by President reserves funds (pendingTotal = 400,000, spent = 0)
  const payment = await act(f.president, {
    action: 'approveExpense',
    expenseId: exp.id,
  });
  assert.equal(payment.status, 'pending');

  const midState = (await financeState(db, f.president)).fundraisingState!.campaigns.find(
    c => c.id === school.id
  )!;
  assert.equal(midState.spent, 0);
  assert.equal(midState.held, 400000);
  assert.equal(midState.availableBalance, 450000);

  // Step 3: Treasurer confirms MoMo disbursement -> spent becomes 400,000 and milestone spentAmount updates
  await act(f.treasurer, {
    action: 'confirmPayment',
    orgId: 'fund-school',
    paymentId: payment.id,
    outcome: 'success',
  });

  const finalState = (await financeState(db, f.president)).fundraisingState!.campaigns.find(
    c => c.id === school.id
  )!;
  assert.equal(finalState.spent, 400000);
  assert.equal(finalState.held, 0);
  assert.equal(finalState.availableBalance, 450000);
  const updatedMilestone = finalState.milestones.find(m => m.id === milestone.id)!;
  assert.equal(updatedMilestone.spentAmount, 400000);
});
