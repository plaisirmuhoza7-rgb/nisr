import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {ensureFirebaseAccount,readAccount} from '../src/server/accounts';
import {accessibleWorkspaces,homeWorkspace,safeAccountRedirect,type Workspace} from '../src/lib/access';

let pg:PGlite;
let db:Database;

before(async()=>{
  pg=new PGlite();
  await pg.waitReady;
  db={query:(q,p)=>pg.query(q,p),exec:q=>pg.exec(q),transaction:fn=>pg.transaction(tx=>fn({query:(q,p)=>tx.query(q,p),exec:q=>tx.exec(q)}))};
  for(const migration of ['001-identity.sql','002-finance.sql','003-firebase-accounts.sql','004-dual-savings-groups.sql','012-dedicated-workspace.sql']) {
    await db.exec(await readFile('migrations/'+migration,'utf8'));
  }
});

after(async()=>{
  await pg?.close();
});

test('dedicated workspace isolation in access helpers', () => {
  const workspaces: Workspace[] = ['personal', 'groups', 'fundraising', 'cooperative'];
  for (const ws of workspaces) {
    const list = accessibleWorkspaces('member', [], ws);
    assert.deepEqual(list, [ws], `Expected ${ws} to be strictly isolated to [${ws}]`);
    assert.equal(homeWorkspace('member', list, ws), ws);
    
    // Testing safeAccountRedirect with isolated workspaces
    const user = { workspaces: list, homeWorkspace: ws };
    assert.equal(safeAccountRedirect(`/app/${ws}`, user), `/app/${ws}`);
    for (const other of workspaces) {
      if (other !== ws) {
        assert.equal(safeAccountRedirect(`/app/${other}`, user), `/app/${ws}`, `Expected access to /app/${other} to redirect to /app/${ws}`);
      }
    }
  }
});

test('signing up with each of the 4 workspaces provisions correct organization and strict workspace isolation', async () => {
  const cases: {ws: Workspace; role: string; orgId: string}[] = [
    {ws: 'personal', role: 'member', orgId: ''},
    {ws: 'groups', role: 'president', orgId: 'group-ubumwe'},
    {ws: 'fundraising', role: 'president', orgId: 'fund-school'},
    {ws: 'cooperative', role: 'cooperative', orgId: 'coop-imena'},
  ];

  for (const c of cases) {
    const uid = `user-dedicated-${c.ws}`;
    const account = await ensureFirebaseAccount(db, {
      uid,
      email: `${c.ws}@example.test`,
      name: `User ${c.ws}`,
      emailVerified: true
    }, c.ws);

    assert.equal(account.dedicatedWorkspace, c.ws);
    assert.equal(account.role, c.role);
    assert.deepEqual(account.workspaces, [c.ws]);
    assert.equal(account.homeWorkspace, c.ws);

    if (c.orgId) {
      assert.ok(account.memberships.some(m => m.orgId === c.orgId));
    }

    const fetched = await readAccount(db, uid);
    assert.ok(fetched);
    assert.equal(fetched.dedicatedWorkspace, c.ws);
    assert.deepEqual(fetched.workspaces, [c.ws]);
    assert.equal(fetched.homeWorkspace, c.ws);
  }
});
