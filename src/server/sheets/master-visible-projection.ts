import type {DemoLogicalSnapshot} from './demo-logical-snapshot';
import {renderManagedSnapshot} from './snapshot';
import type {SheetCell,SheetRangeUpdate} from './validation';

// Keep this allowlist aligned with the organization export. In particular,
// private account credentials, sessions, invitations and audit details never
// belong in this shared view.
const fields:Record<string,string>={
 finance_orgs:'org_id name kind district member_count reserve_bps loan_limit_bps savings_model',
 savings_group_policies:'org_id description location contact administrator_label expected_members contribution_amount$ contribution_frequency contribution_type due_day rotation_order partial_policy missed_policy late_penalty$ cycle_start cycle_end share_out_date minimum_reserve_bps emergency_lending loan_limit_bps distribution_rule accepted_by accepted_at',
 savings_cycles:'id start_date end_date status closed_at created_at',
 savings_rotation_rounds:'id cycle_id round_number recipient_user_id due_date expected_pool$ status actual_paid$ payout_reference',
 savings_obligations:'id cycle_id round_id user_id amount_due$ amount_confirmed$ due_date status',
 memberships:'user_id role',
 finance_entries:'id description reference reversal_of created_at',
 finance_lines:'id entry_id account user_id debit$ credit$',
 finance_loans:'id user_id amount$ months status approved_by created_at',
 finance_campaigns:'id title category description target$ status',
 finance_expenses:'id campaign_id title amount$ requested_by approved_by status',
 finance_payments:'id user_id kind amount$ status reference loan_id campaign_id expense_id journal_id synthetic created_at obligation_id rotation_round_id cycle_id',
 finance_proposals:'id title amount$ status created_by',finance_votes:'proposal_id user_id',
 finance_audit:'id sequence action actor_id actor_role created_at prev_hash hash',
 interventions:'id title created_at',goals:'id user_id name target$ saved$ deadline',
 workspace_onboarding_requests:'id user_id purpose organization_name district description status created_at',
 personal_accounts:'user_id name email',
};
type Row=Record<string,string|null>;
type Scope={tenant:string;org:string;ngo:boolean};
const scopeKey=(tenant:string,org:string)=>JSON.stringify([tenant,org]);

/** A readable shared-file projection, NOT the authoritative encrypted master.
 * Call only with an authenticated, parsed logical snapshot. Every viewer of the
 * spreadsheet can see every exported organization. Personal information is
 * included only for an active member's explicit organization selection. */
export function renderMasterVisibleProjection(snapshot:DemoLogicalSnapshot):SheetRangeUpdate {
 const t=snapshot.tables;
 const scopes=new Map<string,Scope>();
 for(const org of t.finance_orgs){
  if(!org.tenant_id||!org.org_id||!['group','cooperative','fund'].includes(org.kind??''))continue;
  scopes.set(scopeKey(org.tenant_id,org.org_id),{tenant:org.tenant_id,org:org.org_id,ngo:false});
 }
 for(const row of t.interventions){
  if(row.tenant_id && row.org_id==='ngo-imizi')scopes.set(scopeKey(row.tenant_id,row.org_id),{tenant:row.tenant_id,org:row.org_id,ngo:true});
 }
 const records:{scope:Scope;section:string;row:Row}[]=[];
 const scopedTables=Object.keys(fields).filter(table=>!['interventions','goals','workspace_onboarding_requests','personal_accounts'].includes(table));
 for(const scope of scopes.values()){
  if(scope.ngo){for(const row of t.interventions)if(row.tenant_id===scope.tenant&&row.org_id===scope.org)records.push({scope,section:'interventions',row});continue;}
  for(const table of scopedTables)for(const row of t[table])if(row.tenant_id===scope.tenant&&row.org_id===scope.org)records.push({scope,section:table,row});
  for(const dest of t.personal_sheet_destinations){
   if(dest.tenant_id!==scope.tenant||dest.org_id!==scope.org||!dest.user_id)continue;
   if(!t.account_profiles.some(p=>p.tenant_id===scope.tenant&&p.user_id===dest.user_id&&p.status==='active'))continue;
   if(!t.memberships.some(m=>m.tenant_id===scope.tenant&&m.org_id===scope.org&&m.user_id===dest.user_id))continue;
   const user=t.app_users.find(u=>u.id===dest.user_id);
   if(user)records.push({scope,section:'personal_accounts',row:{user_id:dest.user_id,name:user.name,email:user.email}});
   for(const table of ['goals','workspace_onboarding_requests'])for(const row of t[table])if(row.tenant_id===scope.tenant&&row.user_id===dest.user_id)records.push({scope,section:table,row});
  }
 }
 records.sort((a,b)=>{const x=JSON.stringify([a.scope.tenant,a.scope.org,a.section,a.row]),y=JSON.stringify([b.scope.tenant,b.scope.org,b.section,b.row]);return x<y?-1:x>y?1:0;});
 const rows:SheetCell[][]=[['Tenant','Organization','Record type','Record key','Field','Value','Field','Value','Field','Value']];
 for(const {scope,section,row} of records){
  const key=String(row.id??row.org_id??(section==='finance_votes'?`${row.proposal_id}/${row.user_id}`:row.user_id??''));
  let line:SheetCell[]=[scope.tenant,scope.org,section,key];
  for(const field of fields[section].split(' ')){
   const money=field.endsWith('$'),name=field.replace(/\$$/,'');
   if(!Object.hasOwn(row,name))throw new Error('Shared projection contains a missing field.');
   const value=row[name];
   if(money && value!==null && (!/^(0|[1-9][0-9]*)$/.test(value)||BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER)))throw new Error('Shared projection contains invalid RWF.');
   line.push(name+(money?' (RWF)':''),value??'');
   if(line.length===10){rows.push(line);line=[scope.tenant,scope.org,section,key];}
  }
  if(line.length>4)rows.push(line);
 }
 return renderManagedSnapshot(rows);
}
