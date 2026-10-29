import type {Sql} from '../db';
import {renderManagedSnapshot, MANAGED_SNAPSHOT_PROVENANCE} from './snapshot';
import type {SheetCell} from './validation';

// Fixed persisted-field allowlist. A trailing $ marks exact nonnegative RWF.
const fields = {
  finance_orgs: 'org_id name kind district member_count reserve_bps loan_limit_bps savings_model',
  savings_group_policies: 'org_id description location contact administrator_label expected_members contribution_amount$ contribution_frequency contribution_type due_day rotation_order partial_policy missed_policy late_penalty$ cycle_start cycle_end share_out_date minimum_reserve_bps emergency_lending loan_limit_bps distribution_rule accepted_by accepted_at',
  savings_cycles: 'id start_date end_date status closed_at created_at',
  savings_rotation_rounds: 'id cycle_id round_number recipient_user_id due_date expected_pool$ status actual_paid$ payout_reference',
  savings_obligations: 'id cycle_id round_id user_id amount_due$ amount_confirmed$ due_date status',
  memberships: 'user_id role',
  finance_entries: 'id description reference reversal_of created_at',
  finance_lines: 'id entry_id account user_id debit$ credit$',
  finance_loans: 'id user_id amount$ months status approved_by created_at',
  finance_campaigns: 'id title category description target$ status',
  finance_expenses: 'id campaign_id title amount$ requested_by approved_by status',
  finance_payments: 'id user_id kind amount$ status reference loan_id campaign_id expense_id journal_id synthetic created_at obligation_id rotation_round_id cycle_id',
  finance_proposals: 'id title amount$ status created_by',
  finance_votes: 'proposal_id user_id',
  finance_audit: 'id sequence action actor_id actor_role created_at prev_hash hash',
  interventions: 'id title created_at',
  goals: 'id user_id name target$ saved$ deadline',
  workspace_onboarding_requests: 'id user_id purpose organization_name district description status created_at',
  personal_accounts: 'user_id name email',
} as const;

const specs = Object.entries(fields).map(([table, list]) => ({table, columns: list.split(' ')}));
const branches = specs.map(({table, columns}) => {
  if (table==='personal_accounts') return `SELECT 'personal_accounts' AS section,
    jsonb_build_object('user_id',u.id,'name',u.name,'email',u.email) AS data
    FROM personal_sheet_destinations d
    JOIN account_profiles p ON p.tenant_id=d.tenant_id AND p.user_id=d.user_id AND p.status='active'
    JOIN memberships m ON m.tenant_id=d.tenant_id AND m.org_id=d.org_id AND m.user_id=d.user_id
    JOIN app_users u ON u.id=d.user_id WHERE d.tenant_id=$1 AND d.org_id=$2 AND $2<>'ngo-imizi'`;
  const values = columns.map(field => {
    const name = field.replace(/\$$/, '');
    // Text casts prevent JSON parsers rounding PostgreSQL bigint money.
    return `'${name}', r.${name}${field.endsWith('$') || name==='sequence' ? '::text' : ''}`;
  }).join(',');
  const personal = table === 'goals' || table === 'workspace_onboarding_requests';
  const consent = personal ? ` AND EXISTS (
    SELECT 1 FROM personal_sheet_destinations d
    JOIN account_profiles p ON p.tenant_id=d.tenant_id AND p.user_id=d.user_id AND p.status='active'
    JOIN memberships m ON m.tenant_id=d.tenant_id AND m.org_id=d.org_id AND m.user_id=d.user_id
    WHERE d.tenant_id=$1 AND d.org_id=$2 AND d.user_id=r.user_id)` : '';
  return `SELECT '${table}' AS section, jsonb_build_object(${values}) AS data
    FROM ${table} r WHERE r.tenant_id=$1 ${personal ? '' : 'AND r.org_id=$2'}${table==='interventions'?'':" AND $2<>'ngo-imizi'"}${consent}`;
});

// One statement means revision, consent, binding and records share one MVCC view.
// No finance-row locks, network calls, credentials or invite codes.
const snapshotSql = `SELECT b.spreadsheet_id, o.desired_revision::text, o.delivered_revision::text,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('section',section,'data',data)
    ORDER BY section COLLATE "C", data::text COLLATE "C") FROM (${branches.join(' UNION ALL ')}) records),'[]'::jsonb) AS records
  FROM organization_sheet_bindings b JOIN organization_sheet_outbox o
    ON o.tenant_id=b.tenant_id AND o.org_id=b.org_id
  WHERE b.tenant_id=$1 AND b.org_id=$2`;

export type OrganizationSnapshot = {spreadsheetId:string; desiredRevision:string; deliveredRevision:string; rows:SheetCell[][]};

export async function loadOrganizationSnapshot(sql:Sql, tenantId:string, orgId:string):Promise<OrganizationSnapshot|null> {
  if (!tenantId || !orgId) throw new Error('Snapshot requires exact tenant and organization scope.');
  const {rows: results} = await sql.query<{spreadsheet_id:string;desired_revision:string;delivered_revision:string;records:{section:string;data:Record<string,unknown>}[]}>(snapshotSql,[tenantId,orgId]);
  if (!results.length) return null;
  const result=results[0];
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(result.spreadsheet_id)) throw new Error('Invalid spreadsheet binding.');
  for (const revision of [result.desired_revision,result.delivered_revision]) {
    if (typeof revision !== 'string' || !/^(0|[1-9][0-9]*)$/.test(revision)) throw new Error('Invalid snapshot revision.');
  }
  if (BigInt(result.desired_revision)<1n || BigInt(result.delivered_revision)>BigInt(result.desired_revision)) throw new Error('Invalid snapshot revision.');
  const rows:SheetCell[][]=[[MANAGED_SNAPSHOT_PROVENANCE],['Organization',orgId],['Record type','Record key','Field','Value','Field','Value','Field','Value','Field','Value']];
  for (const record of result.records) {
    const spec=specs.find(s=>s.table===record.section);
    if (!spec) throw new Error('Unknown snapshot record.');
    const key=String(record.data.id ?? record.data.org_id ?? (record.section==='finance_votes' ? `${record.data.proposal_id}/${record.data.user_id}` : record.data.user_id));
    let row:SheetCell[]=[record.section,key];
    for (const field of spec.columns) {
      const name=field.replace(/\$$/,'');
      const value=record.data[name];
      let cell:SheetCell;
      if (field.endsWith('$')) {
        if (typeof value!=='string' || !/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Snapshot money must be safe integer RWF.');
        cell=value;
      } else if (value===null) cell='';
      else if (typeof value==='string' || typeof value==='boolean' || (typeof value==='number' && Number.isSafeInteger(value))) cell=value;
      else if (name==='rotation_order' && Array.isArray(value) && value.every(v=>typeof v==='string')) cell=JSON.stringify(value);
      else throw new Error('Invalid snapshot field.');
      row.push(name+(field.endsWith('$')?' (RWF)':''),cell);
      if (row.length===10) {rows.push(row);row=[record.section,key];}
    }
    if (row.length>2) rows.push(row);
  }
  // Fail before the worker can make any write; never truncate a record.
  renderManagedSnapshot(rows);
  return {spreadsheetId:result.spreadsheet_id,desiredRevision:result.desired_revision,deliveredRevision:result.delivered_revision,rows};
}
