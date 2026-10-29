import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Database} from '../src/server/db';
import {linkExistingMemberToOrganization as link} from '../src/server/member-organization-link';

test('links active existing accounts with scoped administrator authority and capacity',async()=>{
  const pg=await PGlite.create();
  try{
    for(const name of ['001-identity.sql','002-finance.sql','003-firebase-accounts.sql','004-dual-savings-groups.sql'])await pg.exec(await readFile(`migrations/${name}`,'utf8'));
    const db:Database={query:(s,p)=>pg.query(s,p),exec:s=>pg.exec(s),transaction:fn=>pg.transaction(tx=>fn({query:(s,p)=>tx.query(s,p),exec:s=>tx.exec(s)}))};
    await pg.exec(`INSERT INTO demo_tenants(id) VALUES ('personal'),('a'),('b');
      INSERT INTO app_users(id,name,email,password_hash,role) VALUES
      ('admin','Admin','admin@example.invalid','managed','member'),('target','Target','target@example.invalid','managed','member'),('other','Other','other@example.invalid','managed','member'),('disabled','Disabled','disabled@example.invalid','managed','member');
      INSERT INTO account_profiles(user_id,tenant_id,status) VALUES ('admin','personal','active'),('target','personal','active'),('other','personal','active'),('disabled','personal','disabled');
      INSERT INTO finance_orgs(tenant_id,org_id,name,kind,savings_model,member_count) VALUES
      ('a','g','Group','group','ACCUMULATING',1),('b','g','Other Group','group','ROTATING',0),('a','c','Cooperative','cooperative',NULL,1),('a','f','Fund','fund',NULL,1);
      INSERT INTO savings_group_policies(tenant_id,org_id,expected_members,accepted_by) VALUES('a','g',2,'admin'),('b','g',2,'admin');
      INSERT INTO memberships VALUES('a','admin','g','president'),('a','admin','c','cooperative'),('a','admin','f','president'),('b','admin','g','member');`);
    const target={administratorUserId:'admin',memberUserId:'target',tenantId:'a',orgId:'g'};
    assert.deepEqual(await link(db,target),{duplicate:false});
    assert.deepEqual(await link(db,target),{duplicate:true});
    assert.equal((await pg.query<{role:string}>("SELECT role FROM memberships WHERE tenant_id='a' AND org_id='g' AND user_id='target'")).rows[0].role,'member');
    assert.equal((await pg.query<{tenant_id:string}>("SELECT tenant_id FROM account_profiles WHERE user_id='target'")).rows[0].tenant_id,'personal');
    assert.equal((await pg.query<{member_count:number}>("SELECT member_count FROM finance_orgs WHERE tenant_id='a' AND org_id='g'")).rows[0].member_count,2);
    await assert.rejects(link(db,{...target,memberUserId:'other'}),/membership limit/);
    await assert.rejects(link(db,{...target,tenantId:'b'}),/unavailable/);
    await assert.rejects(link(db,{...target,orgId:'f'}),/unavailable/);
    await assert.rejects(link(db,{...target,orgId:'missing'}),/unavailable/);
    await assert.rejects(link(db,{...target,administratorUserId:'other'}),/unavailable/);
    await assert.rejects(link(db,{...target,memberUserId:'disabled'}),/unavailable/);
    assert.deepEqual(await link(db,{...target,orgId:'c'}),{duplicate:false});
    assert.equal((await pg.query("SELECT 1 FROM memberships WHERE tenant_id='a' AND org_id='g' AND user_id='target'")).rows.length,1);
    await pg.query("UPDATE account_profiles SET status='disabled' WHERE user_id='admin'");
    await assert.rejects(link(db,{...target,orgId:'c',memberUserId:'other'}),/unavailable/);
  }finally{await pg.close();}
});
