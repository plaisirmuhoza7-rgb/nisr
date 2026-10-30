import {randomUUID} from 'node:crypto';
import type {Database,Sql} from './db';
import {DomainError,orgPermissions} from './permissions';
import {accessibleWorkspaces,homeWorkspace,type AccountUser,type AccountMembership} from '@/lib/access';
import type {Role} from '@/lib/contracts';
export interface VerifiedIdentity {uid:string;email:string;name?:string;emailVerified:boolean}
export async function readAccount(db:Sql,uid:string,emailVerified=true):Promise<AccountUser|null>{
 const {rows}=await db.query('SELECT u.id,u.name,u.email,u.role,p.tenant_id,p.status,p.is_test_account,p.workspace FROM app_users u JOIN account_profiles p ON p.user_id=u.id WHERE u.id=$1',[uid]);
 const row=rows[0];if(!row||row.status!=='active')return null;
 const role=row.role as Role;
 const dedicatedWorkspace=(row.workspace as import('@/lib/access').Workspace)||null;
 const memberships=(await db.query('SELECT org_id,role FROM memberships WHERE tenant_id=$1 AND user_id=$2 ORDER BY org_id',[row.tenant_id,uid])).rows.map(m=>({orgId:String(m.org_id),role:m.role as Role}));
 const workspaces=accessibleWorkspaces(role,memberships,dedicatedWorkspace);
 const primary=dedicatedWorkspace==='cooperative'?'coop-imena':dedicatedWorkspace==='impact'?'ngo-imizi':dedicatedWorkspace==='groups'?'group-ubumwe':dedicatedWorkspace==='fundraising'?'fund-school':memberships.find(m=>m.orgId!=='fund-school')?.orgId;
 const org=primary?(await db.query('SELECT name FROM finance_orgs WHERE tenant_id=$1 AND org_id=$2',[row.tenant_id,primary])).rows[0]:null;
 return {id:uid,name:String(row.name),email:String(row.email),role,tenantId:String(row.tenant_id),workspaces,homeWorkspace:homeWorkspace(role,workspaces,dedicatedWorkspace),organizationName:org?String(org.name):primary==='ngo-imizi'?'Community Impact Program':primary==='coop-imena'?'Imena Cooperative':primary==='group-ubumwe'?'Ubumwe Savings Group':primary==='fund-school'?'School Futures Fund':null,memberships,emailVerified,isTestAccount:Boolean(row.is_test_account),dedicatedWorkspace};
}

const WORKSPACE_ORGS:Record<string,{orgId:string;name:string;kind?:'group'|'fund'|'cooperative'}>={
  'groups':{orgId:'group-ubumwe',name:'Ubumwe Savings Group',kind:'group'},
  'fundraising':{orgId:'fund-school',name:'School Futures Fund',kind:'fund'},
  'cooperative':{orgId:'coop-imena',name:'Imena Cooperative',kind:'cooperative'},
  'impact':{orgId:'ngo-imizi',name:'Community Impact Program'}
};

function roleForWorkspace(workspace?:import('@/lib/access').Workspace):Role{
  if(workspace==='cooperative') return 'cooperative';
  if(workspace==='impact') return 'ngo';
  if(workspace==='groups'||workspace==='fundraising') return 'president';
  return 'member';
}

async function provisionWorkspaceInTx(tx:Sql,tenantId:string,uid:string,workspace:import('@/lib/access').Workspace){
  const role=roleForWorkspace(workspace);
  await tx.query('UPDATE app_users SET role=$1 WHERE id=$2',[role,uid]);
  await tx.query('UPDATE account_profiles SET workspace=$1 WHERE user_id=$2',[workspace,uid]);
  const target=WORKSPACE_ORGS[workspace];
  if(target){
    if(target.kind){
      await tx.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count,savings_model) VALUES($1,$2,$3,$4,'Gasabo',24,CASE WHEN $4='group' THEN 'ACCUMULATING' ELSE NULL END) ON CONFLICT DO NOTHING",[tenantId,target.orgId,target.name,target.kind]);
      if(target.kind==='group'){
        await tx.query("INSERT INTO savings_group_policies(tenant_id,org_id,expected_members,cycle_start,cycle_end,accepted_by) VALUES($1,$2,5,CURRENT_DATE,(CURRENT_DATE+interval '1 year')::date,'system-provision') ON CONFLICT DO NOTHING",[tenantId,target.orgId]);
        await tx.query("INSERT INTO savings_cycles(id,tenant_id,org_id,start_date,end_date) SELECT $3,$1,$2,cycle_start,cycle_end FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2 AND NOT EXISTS(SELECT 1 FROM savings_cycles c WHERE c.tenant_id=$1 AND c.org_id=$2 AND c.status<>'closed')",[tenantId,target.orgId,`cycle-${tenantId}-${target.orgId}`]);
      }
    }
    await tx.query('INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,user_id,org_id) DO UPDATE SET role=EXCLUDED.role',[tenantId,uid,target.orgId,role]);
    if(workspace==='impact'){
      const hasIntervention=(await tx.query('SELECT 1 FROM interventions WHERE tenant_id=$1 AND org_id=$2 LIMIT 1',[tenantId,target.orgId])).rows.length>0;
      if(!hasIntervention){
        await tx.query('INSERT INTO interventions(id,tenant_id,org_id,title) VALUES($1,$2,$3,$4)',[randomUUID(),tenantId,target.orgId,'Treasury transparency workshop · Rwamagana']);
      }
    }
  }
  const hasGoals=(await tx.query('SELECT 1 FROM goals WHERE tenant_id=$1 AND user_id=$2 LIMIT 1',[tenantId,uid])).rows.length>0;
  if(!hasGoals){
    await tx.query('INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),tenantId,uid,'School fees · Term one',600000,240000,'2027-01-15']);
    await tx.query('INSERT INTO goals(id,tenant_id,user_id,name,target,saved,deadline) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),tenantId,uid,'Emergency reserve',300000,90000,'2027-04-01']);
    await tx.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[randomUUID(),tenantId,uid,`Welcome to your private ${workspace} workspace. All transactions and identities are simulated.`]);
  }
}

export async function ensureFirebaseAccount(
  db:Database,
  identity:VerifiedIdentity,
  workspace?:import('@/lib/access').Workspace,
  sessionToken?:{oldHash?:string;newHash:string}
):Promise<AccountUser>{
 if(!identity.emailVerified)throw new DomainError('Verify your email address before signing in.',403);
 const {seedFinanceInTx}=await import('./finance/service');
 await db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[identity.uid]);
  const profile=(await tx.query('SELECT status,tenant_id,workspace FROM account_profiles WHERE user_id=$1',[identity.uid])).rows[0];
  if(profile?.status==='disabled')throw new DomainError('This account is disabled. Contact your organization administrator.',403);
  if(profile){
    const tenantId=String(profile.tenant_id);
    await tx.query('UPDATE app_users SET name=$1,email=$2 WHERE id=$3',[identity.name?.trim().slice(0,100)||identity.email.split('@')[0],identity.email.toLowerCase(),identity.uid]);
    const effectiveWorkspace=(workspace||(profile.workspace as import('@/lib/access').Workspace|null)||undefined);
    if(effectiveWorkspace){
      const targetOrg=WORKSPACE_ORGS[effectiveWorkspace]?.orgId;
      const hasTargetMembership=targetOrg?(await tx.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3',[tenantId,identity.uid,targetOrg])).rows.length>0:true;
      if((workspace && (!profile.workspace || profile.workspace==='personal' || profile.workspace===workspace)) || !hasTargetMembership){
        await provisionWorkspaceInTx(tx,tenantId,identity.uid,effectiveWorkspace);
        if(effectiveWorkspace!=='personal'){
          await seedFinanceInTx(tx,tenantId);
        }
      }
    }
    if(sessionToken){
      if(sessionToken.oldHash)await tx.query('DELETE FROM firebase_sessions WHERE token_hash=$1',[sessionToken.oldHash]);
      await tx.query("INSERT INTO firebase_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours') ON CONFLICT(token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at",[sessionToken.newHash,identity.uid]);
    }
    return;
  }
  const existing=(await tx.query('SELECT id FROM app_users WHERE id=$1 OR email=$2',[identity.uid,identity.email.toLowerCase()])).rows[0];
  // An interrupted sign-up can leave a user row for this exact verified identity with no profile and no
  // memberships. If a user deleted and recreated their Firebase Auth account with the same verified email,
  // existing.id will have an account_profiles row (is_test_account = false) which we can cleanly replace.
  // A pre-seeded organizational row (no account_profiles row or is_test_account = true) stays blocked.
  const orphanSelf=existing&&String(existing.id)===identity.uid&&!(await tx.query('SELECT 1 FROM memberships WHERE user_id=$1',[identity.uid])).rows.length;
  let replacedStaleFirebaseUser=false;
  if(existing && !orphanSelf && String(existing.id)!==identity.uid){
    const oldUid=String(existing.id);
    const oldProfile=(await tx.query('SELECT tenant_id,is_test_account FROM account_profiles WHERE user_id=$1',[oldUid])).rows[0];
    if(oldProfile && !oldProfile.is_test_account){
      await tx.query('DELETE FROM firebase_sessions WHERE user_id=$1',[oldUid]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1',[oldUid]);
      await tx.query('DELETE FROM personal_sheet_destinations WHERE user_id=$1',[oldUid]).catch(()=>undefined);
      await tx.query('DELETE FROM workspace_onboarding_requests WHERE user_id=$1',[oldUid]).catch(()=>undefined);
      await tx.query('DELETE FROM goals WHERE user_id=$1',[oldUid]);
      await tx.query('DELETE FROM notifications WHERE user_id=$1',[oldUid]);
      await tx.query('DELETE FROM memberships WHERE user_id=$1',[oldUid]);
      await tx.query('DELETE FROM account_profiles WHERE user_id=$1',[oldUid]);
      await tx.query('DELETE FROM app_users WHERE id=$1',[oldUid]);
      replacedStaleFirebaseUser=true;
    }
  }
  if(existing && !orphanSelf && !replacedStaleFirebaseUser){
    throw new DomainError('This email is already linked to another HURIZA record. Sign in with the original account or contact support.',403);
  }
  const tenantId=randomUUID();
  await tx.query('INSERT INTO demo_tenants(id) VALUES($1)',[tenantId]);
  const role=roleForWorkspace(workspace);
  await tx.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,'firebase-managed',$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role",[identity.uid,identity.name?.trim().slice(0,100)||identity.email.split('@')[0],identity.email.toLowerCase(),role]);
  await tx.query('INSERT INTO account_profiles(user_id,tenant_id,workspace) VALUES($1,$2,$3)',[identity.uid,tenantId,workspace||null]);

  if(workspace){
    await provisionWorkspaceInTx(tx,tenantId,identity.uid,workspace);
    if(workspace!=='personal'){
      await seedFinanceInTx(tx,tenantId);
    }
  }
  if(sessionToken){
    if(sessionToken.oldHash)await tx.query('DELETE FROM firebase_sessions WHERE token_hash=$1',[sessionToken.oldHash]);
    await tx.query("INSERT INTO firebase_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours') ON CONFLICT(token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at",[sessionToken.newHash,identity.uid]);
  }
 });
 const user=await readAccount(db,identity.uid,true);if(!user)throw new DomainError('Account access is unavailable.',403);return user;
}
export async function provisionAccess(db:Database,identity:VerifiedIdentity,options:{role:Role;tenantId?:string;testAccount?:boolean}):Promise<AccountUser>{
 if(options.testAccount!==true&&!identity.emailVerified)throw new DomainError('Verify this user email before assigning organizational access.',403);
 await db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[identity.uid]);
  const profile=(await tx.query('SELECT tenant_id FROM account_profiles WHERE user_id=$1 FOR UPDATE',[identity.uid])).rows[0];
  const tenantId=options.tenantId||String(profile?.tenant_id||randomUUID());
  if(profile&&profile.tenant_id!==tenantId){
   const existing=(await tx.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2',[profile.tenant_id,identity.uid])).rows;
   if(existing.length)throw new DomainError('Moving an established organizational account requires a reviewed migration.');
  }
  if(options.tenantId){if(!(await tx.query('SELECT 1 FROM demo_tenants WHERE id=$1',[tenantId])).rows.length)throw new DomainError('Organization space not found.');}
  else await tx.query('INSERT INTO demo_tenants(id) VALUES($1) ON CONFLICT DO NOTHING',[tenantId]);
  await tx.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,'firebase-managed',$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role",[identity.uid,identity.name||identity.email.split('@')[0],identity.email.toLowerCase(),options.role]);
  await tx.query("INSERT INTO account_profiles(user_id,tenant_id,is_test_account) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,status='active',is_test_account=EXCLUDED.is_test_account",[identity.uid,tenantId,options.testAccount===true]);
  await tx.query('DELETE FROM memberships WHERE user_id=$1',[identity.uid]);
  const orgs:Record<string,{name:string;kind:string}>={'group-ubumwe':{name:'Community Savings Group',kind:'group'},'fund-school':{name:'Community Fund',kind:'fund'},'coop-imena':{name:'Community Cooperative',kind:'cooperative'}};
  for(const orgId of Object.keys(orgPermissions(options.role))){
   if(orgs[orgId]){
    await tx.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,savings_model) VALUES($1,$2,$3,$4,CASE WHEN $4='group' THEN 'ACCUMULATING' ELSE NULL END) ON CONFLICT DO NOTHING",[tenantId,orgId,orgs[orgId].name,orgs[orgId].kind]);
    if(orgs[orgId].kind==='group'){
     await tx.query("INSERT INTO savings_group_policies(tenant_id,org_id,expected_members,cycle_start,cycle_end,accepted_by) VALUES($1,$2,2,CURRENT_DATE,(CURRENT_DATE+interval '1 year')::date,'system-provision') ON CONFLICT DO NOTHING",[tenantId,orgId]);
     await tx.query("INSERT INTO savings_cycles(id,tenant_id,org_id,start_date,end_date) SELECT $3,$1,$2,cycle_start,cycle_end FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2 AND NOT EXISTS(SELECT 1 FROM savings_cycles c WHERE c.tenant_id=$1 AND c.org_id=$2 AND c.status<>'closed')",[tenantId,orgId,`cycle-${tenantId}-${orgId}`]);
    }
   }
   await tx.query('INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4)',[tenantId,identity.uid,orgId,options.role]);
  }
  if(profile&&profile.tenant_id!==tenantId){await tx.query('UPDATE goals SET tenant_id=$1 WHERE tenant_id=$2 AND user_id=$3',[tenantId,profile.tenant_id,identity.uid]);await tx.query('UPDATE notifications SET tenant_id=$1 WHERE tenant_id=$2 AND user_id=$3',[tenantId,profile.tenant_id,identity.uid]);}
  await tx.query('DELETE FROM firebase_sessions WHERE user_id=$1',[identity.uid]);
 });
 const user=await readAccount(db,identity.uid,true);if(!user)throw new DomainError('Account provisioning failed.');return user;
}
