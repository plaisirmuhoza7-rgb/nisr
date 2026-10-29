import type {Sql, Database} from '../db';

/** Private whole-app recovery format, NEVER an organization export or browser API.
 * Caller must serialize all access and authenticate the payload before restore.
 * Values use PostgreSQL text I/O: bigint, dates and JSON never pass through JS numbers.
 * Session hashes/password placeholders are private data: never log this payload.
 */
export const DEMO_SNAPSHOT_SCHEMA = 'huriza-private-demo-logical-v1';
export const DEMO_SNAPSHOT_MAX_BYTES = 1_500_000;
export const DEMO_SNAPSHOT_TABLES = {
  schema_migrations:'name applied_at',
  demo_tenants:'id created_at',
  app_users:'id name email password_hash role',
  account_profiles:'user_id tenant_id status is_test_account created_at workspace',
  memberships:'tenant_id user_id org_id role',
  sessions:'token_hash tenant_id user_id expires_at',
  firebase_sessions:'token_hash user_id created_at expires_at',
  goals:'id tenant_id user_id name target saved deadline',
  interventions:'id tenant_id org_id title created_at',
  notifications:'id tenant_id user_id message created_at',
  finance_orgs:'tenant_id org_id name kind district member_count reserve_bps loan_limit_bps savings_model',
  finance_entries:'id tenant_id org_id description reference reversal_of posting_txid created_at',
  finance_lines:'id entry_id tenant_id org_id account user_id debit credit',
  finance_loans:'id tenant_id org_id user_id amount months status approved_by created_at',
  finance_campaigns:'id tenant_id org_id title category description target status',
  finance_expenses:'id tenant_id org_id campaign_id title amount requested_by approved_by status',
  finance_proposals:'id tenant_id org_id title amount status created_by',
  finance_votes:'tenant_id org_id proposal_id user_id',
  finance_audit:'id tenant_id org_id sequence action actor_id actor_role details created_at prev_hash hash',
  savings_group_policies:'tenant_id org_id description location contact expected_members contribution_amount contribution_frequency contribution_type due_day rotation_order partial_policy missed_policy late_penalty cycle_start cycle_end share_out_date minimum_reserve_bps emergency_lending loan_limit_bps distribution_rule accepted_by accepted_at administrator_label',
  savings_cycles:'id tenant_id org_id start_date end_date status closed_at created_at',
  savings_rotation_rounds:'id tenant_id org_id cycle_id round_number recipient_user_id due_date expected_pool status actual_paid payout_reference',
  savings_obligations:'id tenant_id org_id cycle_id round_id user_id amount_due amount_confirmed due_date status',
  savings_group_invites:'invite_code tenant_id org_id created_by created_at',
  savings_group_role_history:'id tenant_id org_id user_id old_role new_role assigned_by created_at',
  savings_group_expense_categories:'id tenant_id org_id name description created_at',
  savings_group_expenses:'id tenant_id org_id category title description amount receipt_attachment status recorded_by approved_by approved_at payment_reference journal_id created_at',
  finance_payments:'id tenant_id org_id user_id kind amount status reference loan_id campaign_id expense_id journal_id synthetic created_at obligation_id rotation_round_id cycle_id',
  cooperative_profiles:'tenant_id org_id category sector registration_number nominal_share_value min_shares_per_member max_shares_per_member statutory_reserve_bps social_fund_bps dividend_pool_bps bonus_pool_bps created_at',
  cooperative_staff_appointments:'id tenant_id org_id user_id title department appointed_at status created_at',
  cooperative_share_accounts:'id tenant_id org_id user_id shares_subscribed shares_paid amount_subscribed amount_paid amount_outstanding status created_at',
  cooperative_share_transactions:'id tenant_id org_id user_id kind shares amount payment_reference journal_id status created_at',
  cooperative_deliveries:'id tenant_id org_id user_id product_name category quantity unit grade unit_price total_value payment_status payment_reference delivery_date notes created_at',
  cooperative_sales:'id tenant_id org_id buyer_name product_name quantity unit unit_price total_amount payment_status payment_reference sale_date journal_id created_at',
  cooperative_surplus_allocations:'id tenant_id org_id period_label gross_revenue total_expenses net_surplus statutory_reserve_amount social_fund_amount distributable_surplus dividend_pool bonus_pool status resolution_ref approved_by approved_at created_at',
  cooperative_member_distributions:'id tenant_id org_id allocation_id user_id shares_held share_ratio_bps dividend_amount participation_units participation_ratio_bps bonus_amount total_entitlement payout_status payout_reference paid_at created_at',
  cooperative_investments:'id tenant_id org_id title category capital_cost monthly_operating_cost expected_monthly_benefit useful_life_months financing_source status guardian_verdict payback_months created_by created_at',
  cooperative_governance_events:'id tenant_id org_id event_type title meeting_date agenda resolutions recorded_by created_at',
  fundraising_campaign_profiles:'campaign_id tenant_id org_id slug family subcategory theme organizer_user_id organizer_name beneficiary_name beneficiary_type location event_date start_date story cover_image_url video_url visibility stats_visibility goal_visibility raised_visibility contributors_visibility spending_visibility allow_comments allow_anonymous allow_rsvp suggested_amounts verification_status verification_notes created_at',
  fundraising_campaign_media:'id tenant_id org_id campaign_id media_type url caption sort_order uploaded_by created_at',
  fundraising_campaign_updates:'id tenant_id org_id campaign_id update_type title body media_url author_id author_name created_at',
  fundraising_comments:'id tenant_id org_id campaign_id update_id author_id author_name is_anonymous comment_type message reaction status created_at',
  fundraising_reactions:'id tenant_id org_id campaign_id target_type target_id user_id reaction_type created_at',
  fundraising_followers:'tenant_id org_id campaign_id user_id created_at',
  fundraising_contributions:'id tenant_id org_id campaign_id payment_id user_id contributor_name display_preference custom_display_name amount contribution_type channel status reference message dedication gift_item_id team_id created_at',
  fundraising_access_grants:'id tenant_id org_id campaign_id user_id user_name grant_type status granted_by expires_at created_at',
  fundraising_team_members:'id tenant_id org_id campaign_id user_id user_name campaign_role team_name assigned_by created_at',
  fundraising_milestones:'id tenant_id org_id campaign_id title description target_amount allocated_amount spent_amount outcome_status outcome_evidence sort_order created_at',
  fundraising_expense_details:'expense_id tenant_id org_id campaign_id category description vendor_name receipt_url milestone_id payment_reference created_at',
  fundraising_gift_items:'id tenant_id org_id campaign_id title description target_amount contributed_amount image_url status created_at',
  fundraising_rsvps:'id tenant_id org_id campaign_id user_id guest_name attendance_status guests_count dietary_or_note created_at',
  fundraising_matching_pledges:'id tenant_id org_id campaign_id sponsor_name pledged_amount confirmed_amount match_ratio_bps status created_at',
  fundraising_moderation_events:'id tenant_id org_id campaign_id actor_id event_type reason created_at',
  ngo_profiles:'tenant_id org_id name ngo_type designation mission focus_sectors operating_districts contact_email contact_phone website registration_ref reporting_period approval_threshold_rwf data_retention_months created_at',
  ngo_staff_members:'id tenant_id org_id user_id full_name email phone ngo_role assigned_program_id department location_district status assigned_by created_at',
  ngo_programs:'id tenant_id org_id code name description objective target_population districts start_date end_date funding_source total_budget lead_officer partner_orgs status created_at',
  ngo_projects:'id tenant_id org_id program_id code name district sector site_name budget_allocated budget_spent lead_officer status start_date end_date created_at',
  ngo_grants:'id tenant_id org_id program_id donor_name grant_code title currency original_amount exchange_rate_rwf award_amount_rwf received_amount_rwf approved_budget_rwf restricted_categories start_date end_date next_report_due reporting_schedule conditions_note status created_at',
  ngo_budget_lines:'id tenant_id org_id program_id grant_id category line_code description allocated_amount committed_amount spent_amount created_at',
  ngo_activities:'id tenant_id org_id program_id project_id grant_id budget_line_id title activity_type district sector scheduled_date completed_date lead_officer target_participants actual_participants linked_entity_type linked_entity_id evidence_url evidence_note status verification_status created_at',
  ngo_expenses:'id tenant_id org_id program_id project_id grant_id budget_line_id activity_id title category vendor_name amount currency receipt_url description status requested_by reviewed_by approved_by payment_reference created_at',
  ngo_beneficiary_cohorts:'id tenant_id org_id program_id cohort_code name cohort_type district sector linked_org_id households_count participants_count female_count youth_count enrollment_stage safeguarding_level consent_basis assigned_officer notes created_at',
  ngo_field_visits:'id tenant_id org_id program_id activity_id officer_id officer_name visit_date district sector community_name purpose form_type attendees_count observations outcomes_recorded follow_up_needed evidence_attachment sync_status verification_status created_at',
  ngo_indicators:'id tenant_id org_id program_id code name level unit baseline_value target_value current_value numerator_label denominator_label data_source disaggregation reporting_period responsible_officer verification_status methodology_note created_at',
  ngo_data_quality_issues:'id tenant_id org_id program_id issue_type severity record_ref description resolution_note status detected_by resolved_by created_at',
  ngo_report_snapshots:'id tenant_id org_id program_id grant_id title report_type reporting_period executive_summary activities_summary indicators_snapshot budget_summary risks_and_limitations status prepared_by approved_by created_at',
  ngo_donor_access_grants:'id tenant_id org_id program_id grant_id donor_name donor_email access_code permissions_scope status expires_at granted_by created_at',
  workspace_onboarding_requests:'id tenant_id user_id purpose organization_name district description status created_at',
  organization_sheet_bindings:'tenant_id org_id spreadsheet_id created_at',
  personal_sheet_destinations:'tenant_id user_id org_id created_at',
  organization_sheet_outbox:'tenant_id org_id desired_revision delivered_revision status updated_at attempt_count next_attempt_at last_error_code',
  personal_wallets:'id tenant_id user_id institution account_name account_type account_identifier balance currency notes created_at updated_at',
  personal_loans:'id tenant_id user_id counterparty_name counterparty_phone direction amount paid_amount due_date notes status created_at updated_at',
  personal_investment_plans:'id tenant_id user_id title category capital_required projected_revenue projected_expenses time_horizon_months notes status created_at updated_at',
} as const;
type Row = Record<string,string|null>;
export type DemoLogicalSnapshot = {schema:typeof DEMO_SNAPSHOT_SCHEMA;tables:Record<string,Row[]>};
const entries=Object.entries(DEMO_SNAPSHOT_TABLES);
const quote=(s:string)=>`"${s}"`;
const fail=():never=>{throw new Error('Invalid private demo snapshot.');};

async function verifyLayout(sql:Sql):Promise<void>{
  const columns=(await sql.query<{table_name:string;column_name:string;is_generated:string}>(`SELECT table_name,column_name,is_generated FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`)).rows;
  const actual=columns.filter(c=>!(c.table_name==='organization_sheet_bindings'&&c.column_name==='financial_org_id'&&c.is_generated==='ALWAYS')).map(c=>`${c.table_name}.${c.column_name}`).sort();
  const expected=entries.flatMap(([table,list])=>list.split(' ').map(c=>`${table}.${c}`)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Private demo snapshot schema requires an explicit format upgrade.');
}

export function parseDemoLogicalSnapshot(payload:string):DemoLogicalSnapshot {
  if(Buffer.byteLength(payload,'utf8')>DEMO_SNAPSHOT_MAX_BYTES) fail();
  let raw:unknown;try{raw=JSON.parse(payload);}catch{fail();}
  if(!raw || typeof raw!=='object' || Array.isArray(raw))fail();
  const value=raw as DemoLogicalSnapshot;
  if(Object.keys(value).sort().join(',')!=='schema,tables'||value.schema!==DEMO_SNAPSHOT_SCHEMA||!value.tables||typeof value.tables!=='object'||Array.isArray(value.tables))fail();
  if(Object.keys(value.tables).sort().join(',')!==Object.keys(DEMO_SNAPSHOT_TABLES).sort().join(','))fail();
  let count=0;
  for(const [table,columns] of entries){
    const rows=value.tables[table];if(!Array.isArray(rows))fail();
    count+=rows.length;if(count>10000)fail();
    const keys=columns.split(' ').sort().join(',');
    for(const row of rows){
      if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!==keys)fail();
      for(const cell of Object.values(row))if(cell!==null&&(typeof cell!=='string'||cell.length>50000||cell.includes('\0')))fail();
    }
  }
  return value;
}

/** Invoke inside a consistent transaction under the caller's global mutex.
 * Scope discovery is privileged recovery access, not a user financial read.
 * Every financial data SELECT is restricted to one tenant + organization.
 */
export async function captureDemoLogicalSnapshot(sql:Sql):Promise<string>{
  await verifyLayout(sql);
  const tables:Record<string,Row[]>={};
  const scopes=(await sql.query<{tenant_id:string;org_id:string}>('SELECT tenant_id,org_id FROM finance_orgs ORDER BY tenant_id,org_id')).rows;
  for(const [table,list] of entries){
    const cols=list.split(' ');
    const projection=cols.map(c=>`${quote(c)}::text AS ${quote(c)}`).join(',');
    const scoped=table.startsWith('finance_')||table.startsWith('savings_')||table.startsWith('cooperative_')||table.startsWith('fundraising_');
    const rows:Row[]=[];
    if(scoped){for(const scope of scopes)rows.push(...(await sql.query<Row>(`SELECT ${projection} FROM ${quote(table)} WHERE tenant_id=$1 AND org_id=$2`,[scope.tenant_id,scope.org_id])).rows);}
    else rows.push(...(await sql.query<Row>(`SELECT ${projection} FROM ${quote(table)}`)).rows);
    tables[table]=rows.map(row=>Object.fromEntries(cols.map(c=>[c,row[c]]))).sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;});
  }
  const payload=JSON.stringify({schema:DEMO_SNAPSHOT_SCHEMA,tables});
  parseDemoLogicalSnapshot(payload);return payload;
}

/** Target MUST be freshly migrated, otherwise empty, isolated PGlite. Never use
 * against the live source. Caller authenticates hash/HMAC first; parser is not
 * authentication. Foreign keys/CHECKs stay active. Only enqueue triggers and the
 * historic transaction-id line guard are suspended, transactionally; deferred
 * journal balance triggers and immutability remain active. Old posting_txid is
 * regenerated on restore (engine-local metadata); no new lines may be appended
 * to old entries after the restore transaction finishes.
 */
export async function restoreDemoLogicalSnapshot(db:Database,payload:string):Promise<void>{
  const snapshot=parseDemoLogicalSnapshot(payload);
  await db.transaction(async tx=>{
    await verifyLayout(tx);
    for(const [table] of entries)if(table!=='schema_migrations'&&(await tx.query(`SELECT 1 FROM ${quote(table)} LIMIT 1`)).rows.length)throw new Error('Snapshot restore requires an empty target.');
    const names=(await tx.query<{name:string}>('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);
    if(JSON.stringify(names)!==JSON.stringify(snapshot.tables.schema_migrations.map(r=>r.name).sort()))throw new Error('Snapshot migration version mismatch.');
    const disabled=(await tx.query<{table_name:string;trigger_name:string}>(`SELECT c.relname AS table_name,t.tgname AS trigger_name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgname IN ('organization_sheet_changed','organization_sheet_initial_snapshot','personal_sheet_destination_changed','personal_goal_sheet_changed','personal_onboarding_sheet_changed','personal_sheet_user_changed','personal_sheet_profile_changed','organization_sheet_profile_status_changed','finance_lines_scope'))`)).rows;
    for(const t of disabled){if(!Object.hasOwn(DEMO_SNAPSHOT_TABLES,t.table_name))fail();await tx.exec(`ALTER TABLE ${quote(t.table_name)} DISABLE TRIGGER ${quote(t.trigger_name)}`);}
    for(const [table,list] of entries){
      const cols=list.split(' ');
      const types=(await tx.query<{column_name:string;udt_name:string}>('SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['public',table])).rows;
      const typeMap=new Map(types.map(t=>[t.column_name,t.udt_name]));
      for(const c of cols)if(!['text','int4','int8','bool','date','timestamptz','jsonb'].includes(typeMap.get(c)??''))fail();
      for(const row of snapshot.tables[table]){
        if(table==='schema_migrations'){await tx.query('UPDATE schema_migrations SET applied_at=$1 WHERE name=$2',[row.applied_at,row.name]);continue;}
        const insertCols=cols.filter(c=>table!=='finance_entries'||c!=='posting_txid');
        await tx.query(`INSERT INTO ${quote(table)} (${insertCols.map(quote).join(',')}) VALUES (${insertCols.map((c,i)=>`$${i+1}::text::${typeMap.get(c)}`).join(',')})`,insertCols.map(c=>row[c]));
      }
    }
    // The suspended guard also checks line scope; explicitly validate that part.
    const invalid=await tx.query(`SELECT 1 FROM finance_lines l JOIN finance_entries e ON e.id=l.entry_id WHERE (l.tenant_id,l.org_id) IS DISTINCT FROM (e.tenant_id,e.org_id) LIMIT 1`);
    if(invalid.rows.length)throw new Error('Invalid restored journal scope.');
    await tx.exec('SET CONSTRAINTS ALL IMMEDIATE');
    for(const t of disabled)await tx.exec(`ALTER TABLE ${quote(t.table_name)} ENABLE TRIGGER ${quote(t.trigger_name)}`);
  });
}
