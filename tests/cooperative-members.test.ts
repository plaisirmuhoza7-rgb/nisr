import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {financeAction,financeState,seedFinance} from '../src/server/finance/service';

test('cooperative administrators add new members without changing existing accounts and roster is scoped',async()=>{
 const pg=await PGlite.create();
 try {
  for(const file of ['001-identity.sql','002-finance.sql','003-firebase-accounts.sql','004-dual-savings-groups.sql','012-dedicated-workspace.sql','013-savings-group-roles-and-expenses.sql','014-cooperative-management.sql']) await pg.exec(await readFile(`migrations/${file}`,'utf8'));
  const db:Database={query:(s,p)=>pg.query(s,p),exec:s=>pg.exec(s),transaction:fn=>pg.transaction(tx=>fn({query:(s,p)=>tx.query(s,p),exec:s=>tx.exec(s)}))};
  await pg.exec(`INSERT INTO demo_tenants(id) VALUES('a'),('b'); INSERT INTO app_users(id,name,email,password_hash,role) VALUES('admin','Admin','admin@example.invalid','original','cooperative'),('other','Other','other@example.invalid','original','member'); INSERT INTO account_profiles(user_id,tenant_id,status) VALUES('admin','a','active'),('other','b','active');`);
  await seedFinance(db,'a'); await seedFinance(db,'b');
  await pg.exec(`INSERT INTO finance_orgs(tenant_id,org_id,name,kind,member_count) VALUES('a','coop-second','Second','cooperative',2);
   INSERT INTO memberships VALUES('a','admin','coop-imena','cooperative'),('a','admin','coop-second','cooperative'),('a','other','coop-second','member'),('b','other','coop-imena','member')`);
  const admin={tenantId:'a',userId:'admin',role:'cooperative' as const};
  const input={action:'addCoopMember',orgId:'coop-imena',name:'New Member',phone:'0788123456',pin:'1234'};
  const countBefore=(await pg.query<{member_count:number}>("SELECT member_count FROM finance_orgs WHERE tenant_id='a' AND org_id='coop-imena'")).rows[0].member_count;
  const entriesBefore=(await pg.query<{n:number}>("SELECT count(*)::int AS n FROM finance_entries WHERE tenant_id='a' AND org_id='coop-imena'")).rows[0].n;
  const sharesBefore=(await pg.query<{n:number}>("SELECT count(*)::int AS n FROM cooperative_share_transactions WHERE tenant_id='a' AND org_id='coop-imena'")).rows[0].n;
  for(const invalid of [{phone:'not-a-phone'}, {phone:'0788123457',pin:'abc'}]) await assert.rejects(financeAction(db,admin,{...input,...invalid}));
  assert.equal((await pg.query("SELECT id FROM app_users WHERE email LIKE '%@momo.rw'")).rows.length,0);
  await assert.rejects(financeAction(db,{...admin,tenantId:'b'},input));
  await assert.rejects(financeAction(db,{...admin,userId:'missing'},input));
  await financeAction(db,admin,{...input,role:'cooperative'});
  const auditDetails=(await pg.query<{details:string}>("SELECT details FROM finance_audit WHERE tenant_id='a' AND org_id='coop-imena' AND action='addCoopMember'")).rows[0].details;
  const audit=JSON.parse(auditDetails) as {input:Record<string,unknown>};
  assert.equal('pin' in audit.input,false);
  assert.deepEqual((await pg.query("SELECT p.workspace,p.status,u.role FROM account_profiles p JOIN app_users u ON u.id=p.user_id WHERE p.user_id='user-0788123456'")).rows[0],{workspace:'cooperative',status:'active',role:'member'});
  assert.equal((await pg.query<{n:number}>("SELECT count(*)::int AS n FROM finance_entries WHERE tenant_id='a' AND org_id='coop-imena'")).rows[0].n,entriesBefore);
  assert.equal((await pg.query<{n:number}>("SELECT count(*)::int AS n FROM cooperative_share_transactions WHERE tenant_id='a' AND org_id='coop-imena'")).rows[0].n,sharesBefore);
  const before=(await pg.query("SELECT * FROM app_users WHERE id='user-0788123456'")).rows[0];
  await assert.rejects(financeAction(db,admin,{...input,name:'Hijack',pin:'9999'}),/already registered/);
  assert.deepEqual((await pg.query("SELECT * FROM app_users WHERE id='user-0788123456'")).rows[0],before);
  assert.equal((await pg.query<{member_count:number}>("SELECT member_count FROM finance_orgs WHERE tenant_id='a' AND org_id='coop-imena'")).rows[0].member_count,countBefore+1);
  await assert.rejects(financeAction(db,{tenantId:'b',userId:'other',role:'member'},input),/role cannot/);
  const state=await financeState(db,admin,{orgId:'coop-imena'});
  assert.ok(state.cooperativeState?.members.some(m=>m.id==='user-0788123456'&&m.phone==='0788123456'));
  assert.ok(!state.cooperativeState?.members.some(m=>m.id==='other'));
  const second=await financeState(db,admin,{orgId:'coop-second'});
  assert.ok(second.cooperativeState?.members.some(m=>m.id==='other'));
  assert.ok(!second.cooperativeState?.members.some(m=>m.id==='user-0788123456'));
  const member=await financeState(db,{tenantId:'a',userId:'user-0788123456',role:'member'},{orgId:'coop-imena'});
  assert.deepEqual(member.cooperativeState?.members,[]);
  const other=await financeState(db,{tenantId:'b',userId:'other',role:'member'},{orgId:'coop-imena'});
  assert.deepEqual(other.cooperativeState?.members,[]);
 } finally {await pg.close();}
});
