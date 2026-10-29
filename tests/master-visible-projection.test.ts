import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMasterVisibleProjection} from '../src/server/sheets/master-visible-projection';
import {DEMO_SNAPSHOT_SCHEMA,type DemoLogicalSnapshot} from '../src/server/sheets/demo-logical-snapshot';

function fixture():DemoLogicalSnapshot {
 const names='schema_migrations demo_tenants app_users account_profiles memberships sessions firebase_sessions goals interventions notifications finance_orgs finance_entries finance_lines finance_loans finance_campaigns finance_expenses finance_proposals finance_votes finance_audit savings_group_policies savings_cycles savings_rotation_rounds savings_obligations savings_group_invites finance_payments workspace_onboarding_requests organization_sheet_bindings personal_sheet_destinations organization_sheet_outbox'.split(' ');
 const tables:Record<string,Record<string,string|null>[]>=Object.fromEntries(names.map(n=>[n,[]]));
 for(const [tenant,org,name] of [['a','same','One cooperative'],['b','same','Second cooperative']])tables.finance_orgs.push({tenant_id:tenant,org_id:org,name,kind:'cooperative',district:'Kigali',member_count:'1',reserve_bps:'0',loan_limit_bps:'0',savings_model:null});
 tables.memberships.push({tenant_id:'a',org_id:'same',user_id:'yes',role:'member'},{tenant_id:'b',org_id:'same',user_id:'no',role:'member'});
 tables.account_profiles.push({tenant_id:'a',user_id:'yes',status:'active'},{tenant_id:'b',user_id:'no',status:'active'});
 tables.app_users.push({id:'yes',name:'Approved name',email:'approved@example.test',password_hash:'NEVER PASSWORD'},{id:'no',name:'Hidden name',email:'hidden@example.test',password_hash:'NEVER PASSWORD'});
 tables.personal_sheet_destinations.push({tenant_id:'a',org_id:'same',user_id:'yes'});
 tables.goals.push({tenant_id:'a',user_id:'yes',id:'g1',name:'Visible goal',target:'9007199254740991',saved:'10',deadline:'2027-01-01'},{tenant_id:'b',user_id:'no',id:'g2',name:'Hidden goal',target:'1',saved:'0',deadline:'2027-01-01'});
 tables.finance_lines.push({tenant_id:'a',org_id:'same',id:'l1',entry_id:'e1',account:'cash',user_id:'yes',debit:'9007199254740991',credit:'0'},{tenant_id:'b',org_id:'missing',id:'bad',entry_id:'e2',account:'cash',user_id:'no',debit:'1',credit:'0'});
 tables.finance_audit.push({tenant_id:'a',org_id:'same',id:'audit',sequence:'1',action:'save',actor_id:'yes',actor_role:'member',created_at:'2026',prev_hash:'0',hash:'1',details:'NEVER DETAILS'});
 tables.sessions.push({token_hash:'NEVER SESSION'});tables.savings_group_invites.push({invite_code:'NEVER INVITE'});
 tables.interventions.push({tenant_id:'b',org_id:'ngo-imizi',id:'i1',title:'Program note',created_at:'2026'},{tenant_id:'b',org_id:'other',id:'i2',title:'Hidden note',created_at:'2026'});
 return {schema:DEMO_SNAPSHOT_SCHEMA,tables};
}
test('projects scoped organizations and explicitly selected personal records without secrets',()=>{
 const update=renderMasterVisibleProjection(fixture());assert.equal(update.range,"'HURIZA data'!A1:J2000");
 const text=JSON.stringify(update.values);
 for(const value of ['One cooperative','Second cooperative','Approved name','Visible goal','9007199254740991','Program note','SIMULATED'])assert.ok(text.includes(value),value);
 for(const value of ['Hidden name','hidden@example.test','Hidden goal','Hidden note','NEVER PASSWORD','NEVER SESSION','NEVER INVITE','NEVER DETAILS'])assert.ok(!text.includes(value),value);
 assert.equal(update.values.some(row=>row[0]==='b'&&row[1]==='missing'),false);
 assert.equal(update.values.some(row=>row[0]==='a'&&row[1]==='same'&&row[2]==='personal_accounts'),true);
 assert.equal(update.values.some(row=>row[0]==='b'&&row[1]==='same'&&row[2]==='personal_accounts'),false);
});
test('disabled profiles and removed memberships revoke personal projections',()=>{
 const s=fixture();s.tables.account_profiles[0].status='disabled';
 assert.equal(JSON.stringify(renderMasterVisibleProjection(s).values).includes('Visible goal'),false);
 s.tables.account_profiles[0].status='active';s.tables.memberships=s.tables.memberships.filter(r=>r.user_id!=='yes');
 assert.equal(JSON.stringify(renderMasterVisibleProjection(s).values).includes('Visible goal'),false);
});
test('rejects invalid money and excess rows rather than truncating',()=>{
 const s=fixture();s.tables.finance_lines[0].debit='1.5';assert.throws(()=>renderMasterVisibleProjection(s),/invalid RWF/);
 const large=fixture();large.tables.finance_lines=Array.from({length:1000},(_,i)=>({...large.tables.finance_lines[0],id:String(i)}));
 assert.throws(()=>renderMasterVisibleProjection(large),/at most/);
});
