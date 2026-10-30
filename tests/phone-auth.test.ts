import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../src/server/db';
import { normalizeRwandanPhone, hashPhonePin, phoneToEmail, loginWithPhone } from '../src/server/phone-auth';
import { ensureFirebaseAccount, readAccount } from '../src/server/accounts';
import { createSavingsGroup, financeAction, type NewSavingsGroup } from '../src/server/finance/service';

let pg: PGlite;
let db: Database;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = {
    query: (q, p) => pg.query(q, p),
    exec: q => pg.exec(q),
    transaction: fn => pg.transaction(tx => fn({ query: (q, p) => tx.query(q, p), exec: q => tx.exec(q) }))
  };
  for (const migration of [
    '001-identity.sql',
    '002-finance.sql',
    '003-firebase-accounts.sql',
    '004-dual-savings-groups.sql',
    '010-savings-group-administrator-label.sql',
    '012-dedicated-workspace.sql',
    '013-savings-group-roles-and-expenses.sql'
  ]) {
    await db.exec(await readFile('migrations/' + migration, 'utf8'));
  }
});

after(async () => {
  await pg?.close();
});

test('normalizeRwandanPhone normalizes and validates Rwandan MTN and Airtel numbers', () => {
  assert.equal(normalizeRwandanPhone('+250 788 123 456'), '0788123456');
  assert.equal(normalizeRwandanPhone('250788123456'), '0788123456');
  assert.equal(normalizeRwandanPhone('0788123456'), '0788123456');
  assert.equal(normalizeRwandanPhone('0738123456'), '0738123456');
  assert.equal(normalizeRwandanPhone('0728123456'), '0728123456');

  assert.throws(() => normalizeRwandanPhone('0718123456'), /Invalid Rwandan telephone/);
  assert.throws(() => normalizeRwandanPhone('12345'), /Invalid Rwandan telephone/);
});

test('hashPhonePin enforces 4 to 8 numeric digits and returns consistent hash', () => {
  const hash1 = hashPhonePin('1234');
  const hash2 = hashPhonePin('1234');
  assert.equal(hash1, hash2);
  assert.ok(hash1.length === 64);

  assert.throws(() => hashPhonePin('123'), /PIN must be between 4 and 8 digits/);
  assert.throws(() => hashPhonePin('abcd'), /PIN must be between 4 and 8 digits/);
  assert.throws(() => hashPhonePin('123456789'), /PIN must be between 4 and 8 digits/);
});

test('phoneToEmail produces momo.rw alias', () => {
  assert.equal(phoneToEmail('0788123456'), '0788123456@momo.rw');
});

test('President provisions groups workspace, adds member with phone & pin, and member logs in with phone', async () => {
  // 1. President signs up with Firebase email
  const president = await ensureFirebaseAccount(
    db,
    { uid: 'firebase-president-eric', email: 'eric@ubumwe.rw', name: 'Eric President', emailVerified: true },
    'groups'
  );
  assert.equal(president.role, 'president');
  assert.equal(president.homeWorkspace, 'groups');

  // 2. President adds member Aline via phone & numeric PIN
  const addResult = (await financeAction(
    db,
    { tenantId: president.tenantId, userId: president.id, role: 'president' },
    {
      action: 'addGroupMember',
      name: 'Aline Mukeshimana',
      phone: '0788998877',
      pin: '5678',
      role: 'member'
    }
  )) as Record<string, unknown>;

  assert.ok(addResult.ok);
  assert.equal(addResult.phone, '0788998877');

  // 3. Member Aline logs in using phone & numeric PIN
  const memberAccount = await loginWithPhone(db, '0788998877', '5678');
  assert.equal(memberAccount.name, 'Aline Mukeshimana');
  assert.equal(memberAccount.email, '0788998877@momo.rw');
  assert.equal(memberAccount.role, 'member');
  assert.equal(memberAccount.tenantId, president.tenantId);
  assert.equal(memberAccount.homeWorkspace, 'groups');
  assert.ok(memberAccount.workspaces.includes('groups'));

  // 4. Invalid PIN rejects with 401
  await assert.rejects(
    loginWithPhone(db, '0788998877', '0000'),
    /Invalid telephone number or PIN/
  );

  // 5. Unknown phone rejects with 401
  await assert.rejects(
    loginWithPhone(db, '0788000000', '5678'),
    /Invalid telephone number or PIN/
  );

  // 6. President sends MoMo payment reminder to Aline
  const remindResult = (await financeAction(
    db,
    { tenantId: president.tenantId, userId: president.id, role: 'president' },
    {
      action: 'sendPaymentReminder',
      memberId: memberAccount.id,
      note: 'Your contribution of 10,000 RWF is due on *182#.'
    }
  )) as Record<string, unknown>;
  assert.ok(remindResult.ok);

  const notifications = (await db.query('SELECT message FROM notifications WHERE user_id=$1', [memberAccount.id])).rows;
  assert.ok(notifications.some(n => String(n.message).includes('[MOMO-REMINDER]')));
});

test('Rotating Ikimina group updates rotation order when president adds members', async () => {
  const president = await ensureFirebaseAccount(
    db,
    { uid: 'firebase-president-rotating', email: 'rot@ikimina.rw', name: 'Rotating President', emailVerified: true },
    'groups'
  );

  const actor = { tenantId: president.tenantId, userId: president.id, role: 'president' as const };
  const input: NewSavingsGroup = {
    model: 'ROTATING',
    name: 'Ikimina Cyacu',
    description: 'Contribute and rotate',
    location: 'Gasabo',
    contact: '0788000000',
    expectedMembers: 2,
    contributionAmount: 10000,
    frequency: 'monthly',
    startDate: '2025-01-01',
    endDate: '2025-02-01',
    shareOutDate: '2025-01-01',
    rotationOrder: ['Rotating President', 'Initial Member'],
    reserveBps: 0,
    accepted: true
  };
  const created = await createSavingsGroup(db, actor, input);

  // Add member via phone to this rotating group
  await financeAction(
    db,
    actor,
    {
      action: 'addGroupMember',
      orgId: created.orgId,
      name: 'Eric Gatete',
      phone: '0788112233',
      pin: '1234',
      role: 'member'
    }
  );

  const policy = (await db.query('SELECT rotation_order, expected_members FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2', [president.tenantId, created.orgId])).rows[0];
  const order = policy.rotation_order as string[];
  assert.ok(order.includes('Eric Gatete'));
  assert.equal(policy.expected_members, 3);
});

test('Member added to custom group logs in via phone with various Rwandan formats and loads group state', async () => {
  const president = await ensureFirebaseAccount(
    db,
    { uid: 'firebase-pres-custom', email: 'pres@custom.rw', name: 'Custom President', emailVerified: true },
    'groups'
  );
  const pActor = { tenantId: president.tenantId, userId: president.id, role: 'president' as const };
  const input: NewSavingsGroup = {
    model: 'ACCUMULATING',
    name: 'Terimbere Ibimina',
    description: 'Custom community group',
    location: 'Rwamagana',
    contact: '0788334455',
    expectedMembers: 3,
    contributionAmount: 5000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    shareOutDate: '2026-12-31',
    rotationOrder: [],
    reserveBps: 1000,
    accepted: true
  };
  const created = await createSavingsGroup(db, pActor, input);

  // President adds member Jean with phone '+250 788 445 566' and PIN '9876'
  await financeAction(db, pActor, {
    action: 'addGroupMember',
    orgId: created.orgId,
    name: 'Jean Habimana',
    phone: '+250 788 445 566',
    pin: '9876',
    role: 'member'
  });

  // Member logs in using 9 digits without leading 0 '788445566'
  const jeanAccount = await loginWithPhone(db, '788445566', '9876');
  assert.equal(jeanAccount.name, 'Jean Habimana');
  assert.equal(jeanAccount.role, 'member');
  assert.equal(jeanAccount.homeWorkspace, 'groups');
  assert.ok(jeanAccount.memberships.some(m => m.orgId === created.orgId));

  // Also test logging in with '+2500788445566'
  const jeanAccount2 = await loginWithPhone(db, '+2500788445566', '9876');
  assert.equal(jeanAccount2.id, jeanAccount.id);

  // Fetch financeState as Jean for the group
  const jeanActor = { tenantId: jeanAccount.tenantId, userId: jeanAccount.id, role: 'member' as const };
  const { financeState } = await import('../src/server/finance/service');
  const state = await financeState(db, jeanActor, { orgId: created.orgId });
  assert.ok(state.savingsGroup);
  assert.equal(state.savingsGroup.name, 'Terimbere Ibimina');
  assert.ok(state.savingsGroup.members.some(m => m.id === jeanAccount.id));
  assert.ok(state.savingsGroup.members.some(m => m.id === president.id));
});


