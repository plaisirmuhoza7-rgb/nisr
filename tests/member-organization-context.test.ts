import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {resolveMemberOrganizationContext} from '../src/server/member-organization-context';

test('one identity resolves its stored role for each exact tenant and organization',async()=>{
  const pg=await PGlite.create();
  try{
    for(const name of ['001-identity.sql','002-finance.sql','003-firebase-accounts.sql'])await pg.exec(await readFile(`migrations/${name}`,'utf8'));
    await pg.exec(`INSERT INTO demo_tenants(id) VALUES ('personal'),('a'),('b');
      INSERT INTO app_users VALUES('u','Demo','demo@example.invalid','firebase-managed','member');
      INSERT INTO account_profiles(user_id,tenant_id) VALUES('u','personal');
      INSERT INTO finance_orgs(tenant_id,org_id,name,kind) VALUES('a','group','Group A','group'),('b','group','Group B','group');
      INSERT INTO memberships VALUES('a','u','group','member'),('b','u','group','treasurer');`);
    const resolve=(tenantId:string,orgId:string,userId='u')=>pg.transaction(tx=>resolveMemberOrganizationContext(tx,userId,{tenantId,orgId}));
    assert.deepEqual(await resolve('a','group'),{actor:{userId:'u',tenantId:'a',role:'member'},orgId:'group'});
    assert.deepEqual(await resolve('b','group'),{actor:{userId:'u',tenantId:'b',role:'treasurer'},orgId:'group'});
    await assert.rejects(resolve('personal','group'),/cannot access/);
    await assert.rejects(resolve('a','other'),/cannot access/);
    await assert.rejects(resolve('a','group','other'),/cannot access/);
    assert.equal((await pg.query<{tenant_id:string}>("SELECT tenant_id FROM account_profiles WHERE user_id='u'")).rows[0].tenant_id,'personal');
    await pg.query("UPDATE memberships SET role='invalid' WHERE tenant_id='a'");
    await assert.rejects(resolve('a','group'),/cannot access/);
    await pg.query("UPDATE account_profiles SET status='disabled' WHERE user_id='u'");
    await assert.rejects(resolve('b','group'),/cannot access/);
  }finally{await pg.close();}
});

test('rejects missing, ambiguous and invalid context before granting an actor',async()=>{
  const badRows={async query(){return {rows:[{role:'member'},{role:'treasurer'}]};},async exec(){}};
  await assert.rejects(resolveMemberOrganizationContext(badRows as never,'u',{tenantId:'a',orgId:'o'}),/cannot access/);
  await assert.rejects(resolveMemberOrganizationContext(badRows as never,'',{tenantId:'a',orgId:'o'}),/cannot access/);
});
