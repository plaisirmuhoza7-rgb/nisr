import { createHash, randomUUID } from 'node:crypto';
import type {
  Actor, ActionInput, FinanceState, ScheduleItem, Role,
  GroupExpense, GroupExpenseCategory, GroupRoleHistoryItem, GroupMonthlyReport,
  CooperativeState, CooperativeProfile, CooperativeStaffAppointment, CooperativeShareAccount,
  CooperativeDelivery, CooperativeSale, CooperativeSurplusAllocation, CooperativeMemberDistribution,
  CooperativeInvestment, CooperativeGovernanceEvent, CampaignRole
} from '../../lib/contracts';
import type { Database, Sql } from '../db';
import { assertPermission, DomainError } from '../permissions';
import {
  buildFundraisingState,
  createRichCampaign,
  sanitizeCampaignText,
  generateUniqueSlug,
  seedFundraisingDemoCampaigns,
} from '../fundraising/service';
import {
  buildNgoState,
  handleNgoAction,
} from '../ngo/service';

type Row = Record<string, unknown>;
type Outcome = 'success'|'failed'|'pending'|'unknown';
const GROUP = 'group-ubumwe';
const FUND = 'fund-school';
const COOP = 'coop-imena';
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function id(prefix: string) { return `${prefix}-${randomUUID()}`; }
function num(value: unknown): number {
  const n = BigInt(String(value ?? 0));
  if (n > MAX || n < -MAX) throw new Error('Amount exceeds safe integer RWF range');
  return Number(n);
}
function money(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Amount must be a positive safe integer in RWF');
  return value;
}
function integer(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${field} must be an integer between ${min} and ${max}`);
  return value;
}
function str(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${field} is required (maximum ${max} characters)`);
  return value.trim();
}
function outcome(value: unknown): Outcome {
  if (value !== 'success' && value !== 'failed' && value !== 'pending' && value !== 'unknown') throw new Error('Invalid simulated provider outcome');
  return value;
}
function bps(amount: number, basis: number) { return num(BigInt(amount) * BigInt(basis) / 10000n); }
function reserveFor(amount: number, basis: number) { return num((BigInt(amount)*BigInt(basis)+9999n)/10000n); }
function sum(values: number[]) { return num(values.reduce((a,b) => a + BigInt(b), 0n)); }
function difference(first: number, ...rest: number[]) { return num(rest.reduce((a,b)=>a-BigInt(b),BigInt(first))); }
function date(value: unknown) { return new Date(String(value)).toISOString().slice(0, 10); }
function periodDate(start:string,offset:number,frequency:string){const d=new Date(`${date(start)}T00:00:00Z`);if(frequency==='weekly'){d.setUTCDate(d.getUTCDate()+7*offset);return d.toISOString().slice(0,10);}const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+offset);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);}
async function one(sql: Sql, query: string, params: unknown[] = []): Promise<Row | undefined> { return (await sql.query(query, params)).rows[0]; }
async function required(sql: Sql, table: string, actor: Actor, org: string, recordId: unknown) {
  // Table names come exclusively from constants at call sites; identifiers are never user supplied.
  const row = await one(sql, `SELECT * FROM ${table} WHERE tenant_id=$1 AND org_id=$2 AND id=$3`, [actor.tenantId, org, str(recordId,'Record ID')]);
  if (!row) throw new Error('Record not found in this organization');
  return row;
}
async function orgRow(sql: Sql, tenant: string, org: string) {
  const row = await one(sql, 'SELECT * FROM finance_orgs WHERE tenant_id=$1 AND org_id=$2 FOR UPDATE', [tenant, org]);
  if (!row) throw new Error('Organization not found');
  return row;
}
async function balance(sql: Sql, tenant: string, org: string, account: string, user?: string): Promise<number> {
  const row = await one(sql, `SELECT COALESCE(SUM(debit-credit),0)::text AS amount FROM finance_lines WHERE tenant_id=$1 AND org_id=$2 AND account=$3${user ? ' AND user_id=$4' : ''}`, user ? [tenant,org,account,user] : [tenant,org,account]);
  return num(row?.amount);
}
async function pending(sql: Sql, tenant: string, org: string): Promise<number> {
  const row = await one(sql, "SELECT COALESCE(SUM(amount),0)::text AS amount FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND kind IN ('loan','expense','group-payout','share-out') AND status IN ('pending','unknown')", [tenant,org]);
  return num(row?.amount);
}
async function loanOutstanding(sql: Sql, tenant: string, org: string, loanId: string) {
  const row = await one(sql, `SELECT COALESCE(SUM(CASE WHEN p.kind='loan' THEN p.amount WHEN p.kind='repayment' THEN -p.amount ELSE 0 END),0)::text AS amount
    FROM finance_payments p WHERE p.tenant_id=$1 AND p.org_id=$2 AND p.loan_id=$3 AND p.status='success'
    AND NOT EXISTS (SELECT 1 FROM finance_entries e WHERE e.tenant_id=$1 AND e.org_id=$2 AND e.reversal_of=p.journal_id)`,[tenant,org,loanId]);
  return num(row?.amount);
}
type Line = {account:string;debit?:number;credit?:number;user?:string};
async function journal(sql: Sql, tenant: string, org: string, description: string, reference: string, lines: Line[], reversalOf?: string) {
  const debits = sum(lines.map(l => l.debit ?? 0));
  const credits = sum(lines.map(l => l.credit ?? 0));
  if (debits <= 0 || debits !== credits) throw new Error('Journal must balance');
  const changes=new Map<string,bigint>();
  for(const line of lines) changes.set(line.account,(changes.get(line.account)??0n)+BigInt(line.debit??0)-BigInt(line.credit??0));
  for(const [account,delta] of changes) {
    const resulting=BigInt(await balance(sql,tenant,org,account))+delta;
    if(resulting>MAX||resulting< -MAX) throw new Error('Posting would exceed safe integer RWF balance');
    if(['cash','loans','equipment'].includes(account)&&resulting<0n) throw new Error('Posting would create a negative asset balance');
  }
  for(const line of lines.filter(l=>l.user&&['loans','savings'].includes(l.account))) {
    const resulting=BigInt(await balance(sql,tenant,org,line.account,line.user))+BigInt(line.debit??0)-BigInt(line.credit??0);
    if(line.account==='loans'&&resulting<0n) throw new Error('Posting would create a negative borrower balance');
    if(line.account==='savings'&&resulting>0n) throw new Error('Posting would create negative member savings');
  }
  const entryId = id('entry');
  await sql.query('INSERT INTO finance_entries(id,tenant_id,org_id,description,reference,reversal_of) VALUES($1,$2,$3,$4,$5,$6)',[entryId,tenant,org,`SIMULATED · ${description}`,reference,reversalOf ?? null]);
  for (const line of lines) {
    await sql.query('INSERT INTO finance_lines(id,entry_id,tenant_id,org_id,account,user_id,debit,credit) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id('line'),entryId,tenant,org,line.account,line.user ?? null,line.debit ?? 0,line.credit ?? 0]);
  }
  return entryId;
}
async function treasury(sql: Sql, tenant: string, org: string, config?: Row) {
  const row = config ?? await orgRow(sql,tenant,org);
  const cash = await balance(sql,tenant,org,'cash');
  const reserve = reserveFor(cash,num(row.reserve_bps));
  const held = await pending(sql,tenant,org);
  return {cash,reserve,pending:held,lendingCapacity:Math.max(0,difference(cash,reserve,held)),outstandingLoans:await balance(sql,tenant,org,'loans'),contributions:-(await balance(sql,tenant,org,'savings'))};
}
async function validateLoan(sql: Sql, actor: Actor, org: string, config: Row, amount: number, user: string) {
  const savings = Math.max(0,-await balance(sql,actor.tenantId,org,'savings',user));
  const limit = bps(savings,num(config.loan_limit_bps));
  const outstanding = await balance(sql,actor.tenantId,org,'loans',user);
  const row = await one(sql,"SELECT COALESCE(SUM(amount),0)::text AS amount FROM finance_loans WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3 AND status='disbursing'",[actor.tenantId,org,user]);
  if (BigInt(amount)+BigInt(outstanding)+BigInt(String(row?.amount ?? 0)) > BigInt(limit)) throw new Error(`Loan exceeds savings-based limit: ${Math.max(0,difference(limit,outstanding,num(row?.amount)))} RWF available`);
  const t = await treasury(sql,actor.tenantId,org,config);
  if (amount > t.lendingCapacity) throw new Error('Insufficient lending capacity after reserve and pending disbursements');
}
async function validatePendingLoan(sql: Sql, actor: Actor, org: string, config: Row, payment: Row) {
  const loan=await required(sql,'finance_loans',actor,org,payment.loan_id);
  if(loan.status!=='disbursing') throw new Error('Loan is not awaiting disbursement');
  const user=String(loan.user_id),savings=Math.max(0,-await balance(sql,actor.tenantId,org,'savings',user));
  const limit=bps(savings,num(config.loan_limit_bps));
  const outstanding=await balance(sql,actor.tenantId,org,'loans',user);
  const committed=await one(sql,"SELECT COALESCE(SUM(amount),0)::text AS amount FROM finance_loans WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3 AND status='disbursing'",[actor.tenantId,org,user]);
  if(BigInt(outstanding)+BigInt(String(committed?.amount??0))>BigInt(limit)) throw new Error('Pending loan no longer meets the current savings-based limit; resolve eligibility before confirming success');
  const t=await treasury(sql,actor.tenantId,org,config);
  if(BigInt(t.reserve)+BigInt(t.pending)>BigInt(t.cash)) throw new Error('Pending loan would consume the required cash reserve');
}
async function campaignTotals(sql: Sql, tenant: string, org: string, campaign: string) {
  const rows = (await sql.query(`SELECT p.kind,COALESCE(SUM(p.amount),0)::text AS amount FROM finance_payments p WHERE p.tenant_id=$1 AND p.org_id=$2 AND p.campaign_id=$3 AND p.status='success'
    AND NOT EXISTS (SELECT 1 FROM finance_entries e WHERE e.tenant_id=$1 AND e.org_id=$2 AND e.reversal_of=p.journal_id) GROUP BY p.kind`,[tenant,org,campaign])).rows;
  const raised = num(rows.find(r=>r.kind==='donation')?.amount);
  const spent = num(rows.find(r=>r.kind==='expense')?.amount);
  const held = await one(sql,"SELECT COALESCE(SUM(amount),0)::text AS amount FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND kind='expense' AND status IN ('pending','unknown')",[tenant,org,campaign]);
  return {raised,spent,held:num(held?.amount)};
}
async function postPayment(sql: Sql, payment: Row) {
  if (payment.status !== 'success') throw new Error('Provider success is required before posting');
  if (payment.journal_id) return;
  const tenant = String(payment.tenant_id), org = String(payment.org_id), user = String(payment.user_id), amount = num(payment.amount);
  let lines: Line[];
  const organization=await orgRow(sql,tenant,org);
  if(payment.kind==='group-payout'&&BigInt(-await balance(sql,tenant,org,'rotation_payable'))<BigInt(amount)) throw new Error('Confirmed rotation obligations do not cover this payout');
  switch(payment.kind) {
    case 'contribution': lines=organization.savings_model==='ROTATING'?[{account:'cash',debit:amount},{account:'rotation_payable',credit:amount}]:[{account:'cash',debit:amount},{account:'savings',credit:amount,user}]; break;
    case 'loan': lines=[{account:'loans',debit:amount,user},{account:'cash',credit:amount}]; break;
    case 'repayment': lines=[{account:'cash',debit:amount},{account:'loans',credit:amount,user}]; break;
    case 'donation': lines=[{account:'cash',debit:amount},{account:'donations',credit:amount}]; break;
    case 'expense': lines=[{account:'expenses',debit:amount},{account:'cash',credit:amount}]; break;
    case 'group-payout': lines=[{account:'rotation_payable',debit:amount},{account:'cash',credit:amount}]; break;
    case 'share-out': lines=[{account:'savings',debit:amount,user},{account:'cash',credit:amount}]; break;
    default: throw new Error('Unsupported payment kind');
  }
  const journalId=await journal(sql,tenant,org,`${payment.kind} · provider success`,String(payment.reference),lines);
  await sql.query('UPDATE finance_payments SET journal_id=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[journalId,tenant,org,payment.id]);
  if(payment.kind==='loan') await sql.query("UPDATE finance_loans SET status='active' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[tenant,org,payment.loan_id]);
  if(payment.kind==='repayment' && await loanOutstanding(sql,tenant,org,String(payment.loan_id))===0) await sql.query("UPDATE finance_loans SET status='repaid' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[tenant,org,payment.loan_id]);
  if(payment.kind==='expense'&&payment.expense_id) {
    await sql.query("UPDATE finance_expenses SET status='paid' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[tenant,org,payment.expense_id]);
    await sql.query("UPDATE savings_group_expenses SET status='paid', payment_reference=$1, journal_id=$2 WHERE tenant_id=$3 AND org_id=$4 AND id=$5",[payment.reference,journalId,tenant,org,payment.expense_id]);
    const hasFundDetails = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_expense_details'")).rows.length > 0;
    if (hasFundDetails) {
      await sql.query("UPDATE fundraising_expense_details SET payment_reference=$1 WHERE tenant_id=$2 AND org_id=$3 AND expense_id=$4", [payment.reference, tenant, org, payment.expense_id]);
      const expDetail = await one(sql, 'SELECT milestone_id FROM fundraising_expense_details WHERE tenant_id=$1 AND org_id=$2 AND expense_id=$3', [tenant, org, payment.expense_id]);
      if (expDetail?.milestone_id) {
        await sql.query('UPDATE fundraising_milestones SET spent_amount = spent_amount + $1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4', [amount, tenant, org, expDetail.milestone_id]);
      }
    }
  }
  if(payment.kind==='donation') {
    const hasFundContrib = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_contributions'")).rows.length > 0;
    if (hasFundContrib) {
      await sql.query("UPDATE fundraising_contributions SET status='success' WHERE tenant_id=$1 AND org_id=$2 AND payment_id=$3", [tenant, org, payment.id]);
      const contrib = await one(sql, 'SELECT gift_item_id FROM fundraising_contributions WHERE tenant_id=$1 AND org_id=$2 AND payment_id=$3', [tenant, org, payment.id]);
      if (contrib?.gift_item_id) {
        await sql.query(
          `UPDATE fundraising_gift_items
           SET contributed_amount = LEAST(target_amount, contributed_amount + $1),
               status = CASE WHEN contributed_amount + $1 >= target_amount THEN 'fulfilled' ELSE 'partially_funded' END
           WHERE tenant_id=$2 AND org_id=$3 AND id=$4`,
          [amount, tenant, org, contrib.gift_item_id]
        );
      }
    }
  }
  if(payment.kind==='contribution'&&payment.obligation_id){
    await sql.query("UPDATE savings_obligations SET amount_confirmed=amount_confirmed+$1,status=CASE WHEN amount_confirmed+$1>=amount_due THEN 'paid' ELSE 'partial' END WHERE tenant_id=$2 AND org_id=$3 AND id=$4",[amount,tenant,org,payment.obligation_id]);
    const round=await one(sql,'SELECT round_id FROM savings_obligations WHERE tenant_id=$1 AND org_id=$2 AND id=$3',[tenant,org,payment.obligation_id]);
    if(round?.round_id) await sql.query("UPDATE savings_rotation_rounds r SET status=CASE WHEN (SELECT COALESCE(SUM(o.amount_confirmed),0)>=r.expected_pool FROM savings_obligations o WHERE o.tenant_id=r.tenant_id AND o.org_id=r.org_id AND o.round_id=r.id) THEN 'ready' ELSE 'collecting' END WHERE r.tenant_id=$1 AND r.org_id=$2 AND r.id=$3 AND r.status IN ('scheduled','collecting','ready')",[tenant,org,round.round_id]);
  }
  if(payment.kind==='group-payout'&&payment.rotation_round_id){
   await sql.query("UPDATE savings_rotation_rounds SET status='paid',actual_paid=$1,payout_reference=$2 WHERE tenant_id=$3 AND org_id=$4 AND id=$5",[amount,payment.reference,tenant,org,payment.rotation_round_id]);
   const rotation=await one(sql,'SELECT cycle_id FROM savings_rotation_rounds WHERE tenant_id=$1 AND org_id=$2 AND id=$3',[tenant,org,payment.rotation_round_id]);
   const remaining=await one(sql,"SELECT id FROM savings_rotation_rounds WHERE tenant_id=$1 AND org_id=$2 AND cycle_id=$3 AND status<>'paid' LIMIT 1",[tenant,org,rotation?.cycle_id]);
   if(!remaining) await sql.query("UPDATE savings_cycles SET status='closed',closed_at=now() WHERE tenant_id=$1 AND org_id=$2 AND id=$3 AND status<>'closed'",[tenant,org,rotation?.cycle_id]);
  }
  if(payment.kind==='share-out'&&payment.cycle_id){
   const outstanding=await one(sql,"SELECT 1 FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND cycle_id=$3 AND kind='share-out' AND status IN ('pending','unknown') LIMIT 1",[tenant,org,payment.cycle_id]);
   if(!outstanding) await sql.query("UPDATE savings_cycles SET status='closed',closed_at=now() WHERE tenant_id=$1 AND org_id=$2 AND id=$3 AND status='settling'",[tenant,org,payment.cycle_id]);
  }
}
async function createPayment(sql: Sql, actor: Actor, org: string, kind: string, amount: number, status: Outcome, reference: string, related: {loanId?:string;campaignId?:string;expenseId?:string;obligationId?:string;rotationRoundId?:string;cycleId?:string} = {}) {
  const prior=await one(sql,'SELECT * FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND reference=$3',[actor.tenantId,org,reference]);
  if(prior) {
    if(prior.kind!==kind || num(prior.amount)!==amount || prior.user_id!==actor.userId || (prior.loan_id??undefined)!==related.loanId || (prior.campaign_id??undefined)!==related.campaignId || (prior.expense_id??undefined)!==related.expenseId || (prior.obligation_id??undefined)!==related.obligationId || (prior.rotation_round_id??undefined)!==related.rotationRoundId || (prior.cycle_id??undefined)!==related.cycleId) throw new Error('Reference already belongs to a different payment');
    return {id:prior.id,status:prior.status,reference:prior.reference,amount:num(prior.amount),duplicate:true,synthetic:true};
  }
  const payment=await one(sql,`INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,loan_id,campaign_id,expense_id,obligation_id,rotation_round_id,cycle_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[id('pay'),actor.tenantId,org,actor.userId,kind,amount,status,reference,related.loanId??null,related.campaignId??null,related.expenseId??null,related.obligationId??null,related.rotationRoundId??null,related.cycleId??null]);
  if(!payment) throw new Error('Payment creation failed');
  if(status==='success') await postPayment(sql,payment);
  return {id:payment.id,status,reference,synthetic:true};
}
function schedule(amount: number, months: number, created: unknown, repaid: number): ScheduleItem[] {
  const base = BigInt(amount)/BigInt(months), remainder=BigInt(amount)%BigInt(months);
  let remainingPaid=repaid;
  return Array.from({length:months},(_,i)=>{
    const installment=num(base+(BigInt(i)<remainder?1n:0n));
    const due=new Date(String(created));
    // Preserve the disbursement day, clamped to each target month's last day.
    const day=due.getUTCDate(); due.setUTCDate(1); due.setUTCMonth(due.getUTCMonth()+i+1);
    const last=new Date(Date.UTC(due.getUTCFullYear(),due.getUTCMonth()+1,0)).getUTCDate(); due.setUTCDate(Math.min(day,last));
    const paid=Math.max(0,Math.min(remainingPaid,installment)); remainingPaid=difference(remainingPaid,paid);
    return {dueDate:due.toISOString().slice(0,10),amount:installment,paid};
  });
}
function memberName(user: unknown, name: unknown) {
  if(typeof name==='string' && name.trim() && name!==user) return name;
  return user==='member'?'Aline Uwase':user==='president'?'Jean Mugisha':user==='treasurer'?'Diane Keza':String(user);
}
function displayedPaymentStatus(payment: Row) { return payment.reversed?'reversed':String(payment.status); }
function displayedPayment(payment: Row): FinanceState['payments'][number] {
  return {id:String(payment.id),kind:`SIMULATED · ${payment.kind}`,amount:num(payment.amount),status:displayedPaymentStatus(payment),reference:String(payment.reference),...(payment.loan_id?{loanId:String(payment.loan_id)}:{})};
}
async function paymentRows(sql: Sql, actor: Actor, org: string, personal: boolean) {
  return (await sql.query(`SELECT p.*,u.name AS member_name,EXISTS(SELECT 1 FROM finance_entries e WHERE e.tenant_id=p.tenant_id AND e.org_id=p.org_id AND e.reversal_of=p.journal_id) AS reversed
    FROM finance_payments p LEFT JOIN app_users u ON u.id=p.user_id WHERE p.tenant_id=$1 AND p.org_id=$2${personal?' AND p.user_id=$3':''} ORDER BY p.created_at DESC,p.id`,personal?[actor.tenantId,org,actor.userId]:[actor.tenantId,org])).rows;
}
async function fillFundState(sql: Sql, actor: Actor, state: FinanceState) {
  if(!await hasMembership(sql,actor,FUND)) return;
  await assertPermission(actor,FUND,'read');
  await orgRow(sql,actor.tenantId,FUND);
  const hasFundProfiles = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_campaign_profiles'")).rows.length > 0;
  if (hasFundProfiles) {
    const fundState = await buildFundraisingState(sql, actor);
    state.fundraisingState = fundState;
    for(const c of fundState.campaigns) {
      state.campaigns.push({
        id: c.id,
        title: c.title,
        category: c.category,
        description: c.description,
        target: c.target ?? 0,
        raised: c.raised ?? 0,
        spent: c.spent ?? 0,
        status: c.status,
      });
    }
  } else {
    const campaigns=(await sql.query('SELECT * FROM finance_campaigns WHERE tenant_id=$1 AND org_id=$2 ORDER BY id',[actor.tenantId,FUND])).rows;
    for(const c of campaigns) {
      const totals=await campaignTotals(sql,actor.tenantId,FUND,String(c.id));
      state.campaigns.push({id:String(c.id),title:String(c.title),category:String(c.category),description:String(c.description),target:num(c.target),raised:totals.raised,spent:totals.spent,status:String(c.status)});
    }
  }
  const manager=actor.role==='president'||actor.role==='treasurer';
  state.payments.push(...(await paymentRows(sql,actor,FUND,!manager)).map(displayedPayment));
  // Expense IDs are provided in alerts because the shared UI state has no expense collection.
  if(manager) {
    const expenses=(await sql.query("SELECT * FROM finance_expenses WHERE tenant_id=$1 AND org_id=$2 AND status='requested'",[actor.tenantId,FUND])).rows;
    state.alerts.push(...expenses.map(e=>({id:String(e.id),kind:'expense',message:`SIMULATED expense awaiting independent approval: ${e.title} · ${num(e.amount)} RWF`})));
  }
}
async function fillCooperativeState(sql: Sql, actor: Actor, coopOrg: string, state: FinanceState) {
  const t = await treasury(sql, actor.tenantId, coopOrg);
  const rev = -await balance(sql, actor.tenantId, coopOrg, 'revenue');
  const exp = await balance(sql, actor.tenantId, coopOrg, 'expenses');
  const cap = -await balance(sql, actor.tenantId, coopOrg, 'capital');
  const eq = await balance(sql, actor.tenantId, coopOrg, 'equipment');

  const proposals = (await sql.query('SELECT p.*,COUNT(v.user_id)::text AS votes FROM finance_proposals p LEFT JOIN finance_votes v ON v.tenant_id=p.tenant_id AND v.org_id=p.org_id AND v.proposal_id=p.id WHERE p.tenant_id=$1 AND p.org_id=$2 GROUP BY p.id ORDER BY p.id', [actor.tenantId, coopOrg])).rows;

  state.cooperative = {
    cash: t.cash,
    reserve: t.reserve,
    shareCapital: cap,
    revenue: rev,
    expenses: exp,
    assets: [{ name: 'SIMULATED · processing equipment', value: eq }],
    proposals: proposals.map(p => ({ id: String(p.id), title: String(p.title), amount: num(p.amount), status: String(p.status), votes: num(p.votes) }))
  };

  const hasCoopProfiles = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cooperative_profiles'")).rows.length > 0;
  if (!hasCoopProfiles) return;

  const orgRowData = await orgRow(sql, actor.tenantId, coopOrg);
  const p = await one(sql, 'SELECT * FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, coopOrg]);

  // Shares accounts
  const shareRows = (await sql.query(
    `SELECT s.*, u.name as user_name FROM cooperative_share_accounts s
     LEFT JOIN app_users u ON u.id = s.user_id
     WHERE s.tenant_id=$1 AND s.org_id=$2 ORDER BY s.amount_paid DESC, s.shares_paid DESC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const mappedShares: CooperativeShareAccount[] = shareRows.map(r => ({
    id: String(r.id),
    userId: String(r.user_id),
    userName: r.user_name ? String(r.user_name) : undefined,
    sharesSubscribed: num(r.shares_subscribed),
    sharesPaid: num(r.shares_paid),
    amountSubscribed: num(r.amount_subscribed),
    amountPaid: num(r.amount_paid),
    amountOutstanding: num(r.amount_outstanding),
    status: String(r.status) as CooperativeShareAccount['status']
  }));

  const myShare = mappedShares.find(s => s.userId === actor.userId);
  const totalPaid = sum(mappedShares.map(s => s.amountPaid));
  const unpaidSub = sum(mappedShares.map(s => s.amountOutstanding));

  // Staff appointments
  const staffRows = (await sql.query(
    `SELECT a.*, u.name as user_name FROM cooperative_staff_appointments a
     LEFT JOIN app_users u ON u.id = a.user_id
     WHERE a.tenant_id=$1 AND a.org_id=$2 ORDER BY a.appointed_at ASC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const mappedStaff: CooperativeStaffAppointment[] = staffRows.map(r => ({
    id: String(r.id),
    userId: String(r.user_id),
    userName: r.user_name ? String(r.user_name) : undefined,
    title: String(r.title),
    department: String(r.department),
    appointedAt: date(r.appointed_at),
    status: String(r.status) as CooperativeStaffAppointment['status']
  }));

  // Deliveries
  const delivRows = (await sql.query(
    `SELECT d.*, u.name as member_name FROM cooperative_deliveries d
     LEFT JOIN app_users u ON u.id = d.user_id
     WHERE d.tenant_id=$1 AND d.org_id=$2 ORDER BY d.delivery_date DESC, d.id DESC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const mappedDeliveries: CooperativeDelivery[] = delivRows.map(r => ({
    id: String(r.id),
    userId: String(r.user_id),
    memberName: r.member_name ? String(r.member_name) : undefined,
    productName: String(r.product_name),
    category: String(r.category) as CooperativeDelivery['category'],
    quantity: num(r.quantity),
    unit: String(r.unit),
    grade: String(r.grade),
    unitPrice: num(r.unit_price),
    totalValue: num(r.total_value),
    paymentStatus: String(r.payment_status) as CooperativeDelivery['paymentStatus'],
    paymentReference: r.payment_reference ? String(r.payment_reference) : undefined,
    deliveryDate: date(r.delivery_date),
    notes: r.notes ? String(r.notes) : undefined
  }));

  const myDeliveries = mappedDeliveries.filter(d => d.userId === actor.userId);

  // Sales
  const saleRows = (await sql.query(
    `SELECT * FROM cooperative_sales WHERE tenant_id=$1 AND org_id=$2 ORDER BY sale_date DESC, id DESC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const mappedSales: CooperativeSale[] = saleRows.map(r => ({
    id: String(r.id),
    buyerName: String(r.buyer_name),
    productName: String(r.product_name),
    quantity: num(r.quantity),
    unit: String(r.unit),
    unitPrice: num(r.unit_price),
    totalAmount: num(r.total_amount),
    paymentStatus: String(r.payment_status) as CooperativeSale['paymentStatus'],
    paymentReference: r.payment_reference ? String(r.payment_reference) : undefined,
    saleDate: date(r.sale_date)
  }));

  // Surplus Allocations & Distributions
  const allocRows = (await sql.query(
    `SELECT * FROM cooperative_surplus_allocations WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const mappedAllocations: CooperativeSurplusAllocation[] = await Promise.all(allocRows.map(async a => {
    const distRows = (await sql.query(
      `SELECT d.*, u.name as user_name FROM cooperative_member_distributions d
       LEFT JOIN app_users u ON u.id = d.user_id
       WHERE d.tenant_id=$1 AND d.org_id=$2 AND d.allocation_id=$3 ORDER BY d.total_entitlement DESC`,
      [actor.tenantId, coopOrg, a.id]
    )).rows;

    const distributions: CooperativeMemberDistribution[] = distRows.map(d => ({
      id: String(d.id),
      allocationId: String(d.allocation_id),
      userId: String(d.user_id),
      userName: d.user_name ? String(d.user_name) : undefined,
      sharesHeld: num(d.shares_held),
      shareRatioBps: num(d.share_ratio_bps),
      dividendAmount: num(d.dividend_amount),
      participationUnits: num(d.participation_units),
      participationRatioBps: num(d.participation_ratio_bps),
      bonusAmount: num(d.bonus_amount),
      totalEntitlement: num(d.total_entitlement),
      payoutStatus: String(d.payout_status) as CooperativeMemberDistribution['payoutStatus'],
      payoutReference: d.payout_reference ? String(d.payout_reference) : undefined,
      paidAt: d.paid_at ? new Date(String(d.paid_at)).toISOString() : undefined
    }));

    return {
      id: String(a.id),
      periodLabel: String(a.period_label),
      grossRevenue: num(a.gross_revenue),
      totalExpenses: num(a.total_expenses),
      netSurplus: num(a.net_surplus),
      statutoryReserveAmount: num(a.statutory_reserve_amount),
      socialFundAmount: num(a.social_fund_amount),
      distributableSurplus: num(a.distributable_surplus),
      dividendPool: num(a.dividend_pool),
      bonusPool: num(a.bonus_pool),
      status: String(a.status) as CooperativeSurplusAllocation['status'],
      resolutionRef: a.resolution_ref ? String(a.resolution_ref) : undefined,
      approvedBy: a.approved_by ? String(a.approved_by) : undefined,
      approvedAt: a.approved_at ? new Date(String(a.approved_at)).toISOString() : undefined,
      distributions
    };
  }));

  const myDistributions = mappedAllocations.flatMap(a => a.distributions || []).filter(d => d.userId === actor.userId);

  // Investments (Guardian evaluations)
  const invRows = (await sql.query(
    `SELECT * FROM cooperative_investments WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const minReserve = bps(t.cash, num(p?.statutory_reserve_bps ?? 2000));
  const mappedInvestments: CooperativeInvestment[] = invRows.map(r => {
    const cost = num(r.capital_cost);
    const opCost = num(r.monthly_operating_cost);
    const benefit = num(r.expected_monthly_benefit);
    const netGain = difference(benefit, opCost);
    const remainingCash = difference(t.cash, cost);
    return {
      id: String(r.id),
      title: String(r.title),
      category: String(r.category) as CooperativeInvestment['category'],
      capitalCost: cost,
      monthlyOperatingCost: opCost,
      expectedMonthlyBenefit: benefit,
      usefulLifeMonths: num(r.useful_life_months),
      financingSource: String(r.financing_source) as CooperativeInvestment['financingSource'],
      status: String(r.status) as CooperativeInvestment['status'],
      guardianVerdict: String(r.guardian_verdict) as CooperativeInvestment['guardianVerdict'],
      paybackMonths: num(r.payback_months),
      remainingCashAfterPurchase: remainingCash,
      liquidityBuffer: difference(remainingCash, minReserve),
      netMonthlyGain: netGain,
      createdBy: String(r.created_by),
      createdAt: date(r.created_at)
    };
  });

  // Governance events
  const govRows = (await sql.query(
    `SELECT * FROM cooperative_governance_events WHERE tenant_id=$1 AND org_id=$2 ORDER BY meeting_date DESC, created_at DESC`,
    [actor.tenantId, coopOrg]
  )).rows;

  const mappedGovernance: CooperativeGovernanceEvent[] = govRows.map(r => ({
    id: String(r.id),
    eventType: String(r.event_type) as CooperativeGovernanceEvent['eventType'],
    title: String(r.title),
    meetingDate: date(r.meeting_date),
    agenda: String(r.agenda),
    resolutions: String(r.resolutions),
    recordedBy: String(r.recorded_by),
    createdAt: date(r.created_at)
  }));

  const netSurplus = difference(rev, exp);
  const totalAssets = sum([t.cash, eq, unpaidSub]);

  state.cooperativeState = {
    profile: {
      orgId: coopOrg,
      name: String(orgRowData.name),
      category: (p?.category as CooperativeProfile['category']) ?? 'agriculture',
      sector: String(p?.sector ?? 'Buyoga'),
      district: String(orgRowData.district),
      registrationNumber: p?.registration_number ? String(p.registration_number) : undefined,
      nominalShareValue: num(p?.nominal_share_value ?? 10000),
      minSharesPerMember: num(p?.min_shares_per_member ?? 5),
      maxSharesPerMember: num(p?.max_shares_per_member ?? 1000),
      statutoryReserveBps: num(p?.statutory_reserve_bps ?? 2000),
      socialFundBps: num(p?.social_fund_bps ?? 1000),
      dividendPoolBps: num(p?.dividend_pool_bps ?? 4000),
      bonusPoolBps: num(p?.bonus_pool_bps ?? 6000),
      memberCount: num(orgRowData.member_count),
      shareCapital: totalPaid > 0 ? totalPaid : cap,
      unpaidSubscriptions: unpaidSub,
      availableCash: t.cash,
      reserveCash: t.reserve
    },
    staff: mappedStaff,
    shares: mappedShares,
    myShareAccount: myShare,
    deliveries: mappedDeliveries,
    myDeliveries,
    sales: mappedSales,
    surplusAllocations: mappedAllocations,
    myDistributions,
    investments: mappedInvestments,
    governance: mappedGovernance,
    financialStatements: {
      revenue: rev,
      expenses: exp,
      netSurplus,
      cash: t.cash,
      reserve: t.reserve,
      shareCapital: totalPaid > 0 ? totalPaid : cap,
      sharesReceivable: unpaidSub,
      equipmentAssets: eq,
      totalAssets,
      liabilities: 0
    }
  };

  const hasExpenseTables = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_group_expenses'")).rows.length > 0;
  if (hasExpenseTables) {
    const expenseRows = (await sql.query(`SELECT e.*, u1.name AS recorded_by_name, u2.name AS approved_by_name
      FROM savings_group_expenses e
      LEFT JOIN app_users u1 ON u1.id=e.recorded_by
      LEFT JOIN app_users u2 ON u2.id=e.approved_by
      WHERE e.tenant_id=$1 AND e.org_id=$2 ORDER BY e.created_at DESC, e.id DESC`, [actor.tenantId, coopOrg])).rows;
    state.groupExpenses = expenseRows.map(r => ({
      id: String(r.id),
      category: String(r.category),
      title: String(r.title),
      description: String(r.description || ''),
      amount: num(r.amount),
      receiptAttachment: r.receipt_attachment ? String(r.receipt_attachment) : undefined,
      status: String(r.status) as GroupExpense['status'],
      recordedBy: String(r.recorded_by),
      recordedByName: r.recorded_by_name ? String(r.recorded_by_name) : undefined,
      approvedBy: r.approved_by ? String(r.approved_by) : undefined,
      approvedByName: r.approved_by_name ? String(r.approved_by_name) : undefined,
      approvedAt: r.approved_at ? date(r.approved_at) : undefined,
      paymentReference: r.payment_reference ? String(r.payment_reference) : undefined,
      createdAt: date(r.created_at),
    }));
  }

  const pendingDeliveries = mappedDeliveries.filter(d => d.paymentStatus === 'pending');
  if(pendingDeliveries.length > 0) {
    state.alerts.push({
      id: 'pending-deliveries',
      kind: 'info',
      message: `${pendingDeliveries.length} member produce delivery batch(es) awaiting authorized payment confirmation.`
    });
  }
  if(t.cash < minReserve) {
    state.alerts.push({
      id: 'reserve-shortfall',
      kind: 'warning',
      message: `Cooperative cash (${t.cash.toLocaleString()} RWF) is below the statutory reserve target (${minReserve.toLocaleString()} RWF).`
    });
  }
  state.alerts.push({
    id: 'coop-synthetic',
    kind: 'info',
    message: 'All cooperative records, deliveries, sales and Member Value Engine distributions are synthetic and for demonstration.'
  });
}

const emptyTreasury={cash:0,reserve:0,pending:0,lendingCapacity:0,outstandingLoans:0,contributions:0};
const emptyCoop={cash:0,reserve:0,shareCapital:0,revenue:0,expenses:0,assets:[] as {name:string;value:number}[],proposals:[] as FinanceState['cooperative']['proposals']};
const emptyImpact={groups:0,members:0,savings:0,loans:0,reportingCompleteness:0,organizations:[] as FinanceState['impact']['organizations']};

export async function financeState(db: Database, actor: Actor, options: {personal?:boolean;orgId?:string} = {}): Promise<FinanceState> {
  // A single transaction keeps all projections consistent with one another.
  return db.transaction(sql=>financeStateInTransaction(sql,actor,options));
}

export async function financeStateInTransaction(sql: Sql, actor: Actor, options: {personal?:boolean;orgId?:string} = {}): Promise<FinanceState> {
    const state: FinanceState={treasury:{...emptyTreasury},member:{eligibleSavings:0,loanLimit:0,outstanding:0},contributions:[],loans:[],ledger:[],payments:[],campaigns:[],cooperative:{...emptyCoop,assets:[],proposals:[]},impact:{...emptyImpact,organizations:[]},alerts:[]};
    // A personal workspace never inherits organizational visibility from an officer role.
    if(options.personal && (actor.role==='ngo'||actor.role==='cooperative')) return state;
    if(actor.role==='ngo'&&!options.orgId) {
      await assertPermission(actor,'ngo-imizi','report');
      if(!await hasMembership(sql,actor,'ngo-imizi')) {
        await fillFundState(sql,actor,state);
        return state;
      }
      const groups=(await sql.query("SELECT * FROM finance_orgs WHERE tenant_id=$1 AND kind='group' ORDER BY org_id FOR UPDATE",[actor.tenantId])).rows;
      for(const g of groups) {
        const org=String(g.org_id), t=await treasury(sql,actor.tenantId,org,g);
        state.impact.organizations.push({id:org,name:String(g.name),district:String(g.district),members:num(g.member_count),savings:t.contributions,outstanding:t.outstandingLoans,reportingStatus:'Synthetic demo · reconciled'});
      }
      state.impact.groups=groups.length;
      state.impact.members=sum(state.impact.organizations.map(g=>g.members));
      state.impact.savings=sum(state.impact.organizations.map(g=>g.savings));
      state.impact.loans=sum(state.impact.organizations.map(g=>g.outstanding));
      state.impact.reportingCompleteness=100;
      state.alerts.push({id:'synthetic-impact',kind:'info',message:'Synthetic operational aggregates only. These records do not establish real-world impact.'});
      state.ngoState = await buildNgoState(sql, actor, 'ngo-imizi');
      await fillFundState(sql,actor,state);
      return state;
    }
    const coopOrg = options.orgId?.startsWith('coop-') ? options.orgId : (actor.role === 'cooperative' && !options.orgId ? COOP : undefined);
    if(coopOrg) {
      if(!options.personal && !(await sql.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3',[actor.tenantId,actor.userId,coopOrg])).rows.length) {
        await fillFundState(sql, actor, state);
        return state;
      }
      const coopMembership = await one(sql, 'SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3', [actor.tenantId, actor.userId, coopOrg]);
      const coopActor = coopMembership ? { ...actor, role: coopMembership.role as Role } : actor;
      if (coopActor.role !== 'member') await assertPermission(coopActor, COOP, 'read');
      await fillCooperativeState(sql, coopActor, coopOrg, state);
      state.ledger = await ledgerState(sql, coopActor, coopOrg);
      await fillFundState(sql, coopActor, state);
      return state;
    }
    const groupOrg=options.orgId??GROUP;
    if(!groupOrg.startsWith('group-')) throw new Error('Invalid savings group');
    if(!options.personal&&!(await sql.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3',[actor.tenantId,actor.userId,groupOrg])).rows.length){await fillFundState(sql,actor,state);return state;}
    if(options.personal&&!(await sql.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3',[actor.tenantId,actor.userId,groupOrg])).rows.length){await fillFundState(sql,actor,state);return state;}
    if(options.personal&&!(await sql.query('SELECT 1 FROM finance_orgs WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,groupOrg])).rows.length){await fillFundState(sql,actor,state);return state;}
    const groupRole=await requireMembership(sql,actor,groupOrg);
    if(!options.orgId&&groupRole!==actor.role){await fillFundState(sql,actor,state);return state;}
    const groupActor={...actor,role:groupRole};
    await assertPermission(groupActor,GROUP,'read');
    {
      const group=await orgRow(sql,actor.tenantId,groupOrg);
      if(group.kind!=='group') throw new Error('Organization is not a savings group');
      const policy=await one(sql,'SELECT * FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,groupOrg]);
      const cycle=await one(sql,'SELECT * FROM savings_cycles WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC LIMIT 1',[actor.tenantId,groupOrg]);
      const rounds=(await sql.query(`SELECT r.*,u.name AS recipient_name,COALESCE(SUM(o.amount_confirmed),0)::text AS confirmed
        FROM savings_rotation_rounds r JOIN app_users u ON u.id=r.recipient_user_id LEFT JOIN savings_obligations o ON o.tenant_id=r.tenant_id AND o.org_id=r.org_id AND o.round_id=r.id
        WHERE r.tenant_id=$1 AND r.org_id=$2 AND r.cycle_id=$3 GROUP BY r.id,u.name ORDER BY r.round_number`,[actor.tenantId,groupOrg,cycle?.id??''])).rows;
      const groupMembers=(await sql.query(`SELECT m.user_id,u.name,u.email,m.role FROM memberships m JOIN app_users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.org_id=$2${groupRole==='member'?' AND m.user_id=$3':''} ORDER BY u.name,u.id`,groupRole==='member'?[actor.tenantId,groupOrg,actor.userId]:[actor.tenantId,groupOrg])).rows;
      const obligationRows=(await sql.query(`SELECT id,user_id,amount_due,amount_confirmed,due_date,status,round_id FROM savings_obligations WHERE tenant_id=$1 AND org_id=$2${cycle?' AND cycle_id=$3':''}${groupRole==='member'?(cycle?' AND user_id=$4':' AND user_id=$3'):''} ORDER BY due_date,id`,cycle?(groupRole==='member'?[actor.tenantId,groupOrg,cycle.id,actor.userId]:[actor.tenantId,groupOrg,cycle.id]):(groupRole==='member'?[actor.tenantId,groupOrg,actor.userId]:[actor.tenantId,groupOrg]))).rows;
      const t=await treasury(sql,actor.tenantId,groupOrg,group);
      const gross=t.contributions,distribution=String(policy?.distribution_rule??'proportional');
      const distributable=Math.max(0,difference(t.cash,t.reserve,t.pending,t.outstandingLoans));
      const mappedMembers = await Promise.all(groupMembers.map(async m => {
        const savings = Math.max(0, -await balance(sql, actor.tenantId, groupOrg, 'savings', String(m.user_id)));
        const debt = await balance(sql, actor.tenantId, groupOrg, 'loans', String(m.user_id));
        const email = String(m.email || '');
        const phone = email.endsWith('@momo.rw') ? email.replace('@momo.rw', '') : '';
        return {
          id: String(m.user_id),
          name: String(m.name),
          role: String(m.role) as Actor['role'],
          phone,
          savings,
          debt
        };
      }));
      const hasExpenseTables = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_group_expenses'")).rows.length > 0;
      let mappedExpenses: GroupExpense[] = [];
      let mappedCategories: GroupExpenseCategory[] = [];
      let mappedRoleHistory: GroupRoleHistoryItem[] = [];

      if (hasExpenseTables) {
        const expenseRows=(await sql.query(`SELECT e.*,u1.name AS recorded_by_name,u2.name AS approved_by_name
          FROM savings_group_expenses e
          LEFT JOIN app_users u1 ON u1.id=e.recorded_by
          LEFT JOIN app_users u2 ON u2.id=e.approved_by
          WHERE e.tenant_id=$1 AND e.org_id=$2 ORDER BY e.created_at DESC,e.id DESC`,[actor.tenantId,groupOrg])).rows;
        mappedExpenses = expenseRows.map(r=>({
          id:String(r.id),
          category:String(r.category),
          title:String(r.title),
          description:String(r.description||''),
          amount:num(r.amount),
          receiptAttachment:r.receipt_attachment?String(r.receipt_attachment):undefined,
          status:String(r.status) as GroupExpense['status'],
          recordedBy:String(r.recorded_by),
          recordedByName:r.recorded_by_name?String(r.recorded_by_name):undefined,
          approvedBy:r.approved_by?String(r.approved_by):undefined,
          approvedByName:r.approved_by_name?String(r.approved_by_name):undefined,
          approvedAt:r.approved_at?new Date(String(r.approved_at)).toISOString():undefined,
          paymentReference:r.payment_reference?String(r.payment_reference):undefined,
          journalId:r.journal_id?String(r.journal_id):undefined,
          createdAt:date(r.created_at)
        }));
        const categoryRows=(await sql.query('SELECT id,name,description FROM savings_group_expense_categories WHERE tenant_id=$1 AND org_id=$2 ORDER BY name ASC',[actor.tenantId,groupOrg])).rows;
        mappedCategories = categoryRows.map(r=>({
          id:String(r.id),
          name:String(r.name),
          description:r.description?String(r.description):undefined
        }));
        const roleHistoryRows=(await sql.query(`SELECT h.*,u1.name AS user_name,u2.name AS assigned_by_name
          FROM savings_group_role_history h
          LEFT JOIN app_users u1 ON u1.id=h.user_id
          LEFT JOIN app_users u2 ON u2.id=h.assigned_by
          WHERE h.tenant_id=$1 AND h.org_id=$2 ORDER BY h.created_at DESC,h.id DESC`,[actor.tenantId,groupOrg])).rows;
        mappedRoleHistory = roleHistoryRows.map(r=>({
          id:String(r.id),
          userId:String(r.user_id),
          userName:r.user_name?String(r.user_name):undefined,
          oldRole:String(r.old_role) as Role,
          newRole:String(r.new_role) as Role,
          assignedBy:String(r.assigned_by),
          assignedByName:r.assigned_by_name?String(r.assigned_by_name):undefined,
          createdAt:new Date(String(r.created_at)).toISOString()
        }));
      }

      // Compute monthly financial reports
      const monthlyMap=new Map<string,{month:string;totalIncome:number;totalExpenses:number;netSavings:number;confirmedContributions:number;disbursedLoans:number;repaidLoans:number;expensesByCategory:Map<string,number>}>();
      const getOrCreateMonth=(mStr:string)=>{
        if(!monthlyMap.has(mStr)){
          monthlyMap.set(mStr,{month:mStr,totalIncome:0,totalExpenses:0,netSavings:0,confirmedContributions:0,disbursedLoans:0,repaidLoans:0,expensesByCategory:new Map<string,number>()});
        }
        return monthlyMap.get(mStr)!;
      };
      for(const exp of mappedExpenses){
        if(exp.status==='paid'){
          const m=exp.createdAt.slice(0,7);
          const entry=getOrCreateMonth(m);
          entry.totalExpenses=sum([entry.totalExpenses,exp.amount]);
          const prevCat=entry.expensesByCategory.get(exp.category)??0;
          entry.expensesByCategory.set(exp.category,sum([prevCat,exp.amount]));
        }
      }
      const allGroupPayments=await paymentRows(sql,actor,groupOrg,false);
      for(const p of allGroupPayments){
        if(p.status==='success'){
          const m=date(p.created_at).slice(0,7);
          const entry=getOrCreateMonth(m);
          if(p.kind==='contribution'){
            entry.confirmedContributions=sum([entry.confirmedContributions,num(p.amount)]);
            entry.totalIncome=sum([entry.totalIncome,num(p.amount)]);
          }else if(p.kind==='income'){
            entry.totalIncome=sum([entry.totalIncome,num(p.amount)]);
          }else if(p.kind==='loan'){
            entry.disbursedLoans=sum([entry.disbursedLoans,num(p.amount)]);
          }else if(p.kind==='repayment'){
            entry.repaidLoans=sum([entry.repaidLoans,num(p.amount)]);
          }
        }
      }
      const currentMonthKey=new Date().toISOString().slice(0,7);
      getOrCreateMonth(currentMonthKey);
      const mappedMonthlyReports:GroupMonthlyReport[]=Array.from(monthlyMap.values())
        .sort((a,b)=>b.month.localeCompare(a.month))
        .map(m=>({
          month:m.month,
          totalIncome:m.totalIncome,
          totalExpenses:m.totalExpenses,
          netSavings:difference(m.totalIncome,m.totalExpenses),
          confirmedContributions:m.confirmedContributions,
          disbursedLoans:m.disbursedLoans,
          repaidLoans:m.repaidLoans,
          expensesByCategory:Array.from(m.expensesByCategory.entries()).map(([category,amount])=>({category,amount})),
          closingCash:t.cash,
          closingReserve:t.reserve
        }));

      state.savingsGroup={id:groupOrg,name:String(group.name),district:String(group.district),model:String(group.savings_model) as 'ACCUMULATING'|'ROTATING',memberCount:num(group.member_count),memberRole:groupRole,members:mappedMembers,expectedMembers:num(policy?.expected_members??group.member_count),contributionAmount:num(policy?.contribution_amount??0),frequency:String(policy?.contribution_frequency??'monthly') as 'daily'|'weekly'|'monthly',...(groupRole==='president'||groupRole==='treasurer'?{inviteCode:String((await one(sql,'SELECT invite_code FROM savings_group_invites WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC LIMIT 1',[actor.tenantId,groupOrg]))?.invite_code??'')}:{ }),cycleStart:cycle?date(cycle.start_date):String(policy?.cycle_start??''),cycleEnd:cycle?date(cycle.end_date):String(policy?.cycle_end??''),cycleStatus:String(cycle?.status??'none'),reserveBps:num(group.reserve_bps),emergencyLending:Boolean(policy?.emergency_lending),rotationRounds:rounds.map(r=>({id:String(r.id),roundNumber:num(r.round_number),recipientId:String(r.recipient_user_id),recipientName:String(r.recipient_name),dueDate:date(r.due_date),expectedPool:num(r.expected_pool),confirmed:num(r.confirmed),shortfall:Math.max(0,difference(num(r.expected_pool),num(r.confirmed))),status:String(r.status)})),obligations:obligationRows.map(o=>({id:String(o.id),userId:String(o.user_id),amountDue:num(o.amount_due),amountConfirmed:num(o.amount_confirmed),dueDate:date(o.due_date),status:String(o.status),roundId:o.round_id?String(o.round_id):null})),shareOut:{contributions:gross,cash:t.cash,reserve:t.reserve,outstandingLoans:t.outstandingLoans,pending:t.pending,distributable,ready:String(group.savings_model)==='ACCUMULATING'&&cycle?.status==='settling'&&distributable>0&&distribution.length>0},expenses:mappedExpenses,expenseCategories:mappedCategories,roleHistory:mappedRoleHistory,monthlyReports:mappedMonthlyReports};
      state.groupExpenses=mappedExpenses;
      state.groupExpenseCategories=mappedCategories;
      state.roleHistory=mappedRoleHistory;
      if(!options.personal) state.treasury=await treasury(sql,actor.tenantId,groupOrg,group);
      state.member.eligibleSavings=Math.max(0,-await balance(sql,actor.tenantId,groupOrg,'savings',actor.userId));
    state.member.loanLimit=group.savings_model==='ROTATING'?0:bps(state.member.eligibleSavings,num(group.loan_limit_bps));
    state.member.outstanding=await balance(sql,actor.tenantId,groupOrg,'loans',actor.userId);
    const personal=options.personal===true||groupRole==='member';
    const scope=personal?' AND l.user_id=$3':'';
    const params=personal?[actor.tenantId,groupOrg,actor.userId]:[actor.tenantId,groupOrg];
    const payments=await paymentRows(sql,actor,groupOrg,personal);
    state.payments=payments.map(displayedPayment);
    state.contributions=payments.filter(p=>p.kind==='contribution').map(p=>({id:String(p.id),member:memberName(p.user_id,p.member_name),amount:num(p.amount),status:displayedPaymentStatus(p),date:date(p.created_at)}));
    const loans=(await sql.query(`SELECT l.*,u.name AS member_name,(SELECT e.created_at FROM finance_payments p JOIN finance_entries e ON e.id=p.journal_id AND e.tenant_id=p.tenant_id AND e.org_id=p.org_id
      WHERE p.tenant_id=l.tenant_id AND p.org_id=l.org_id AND p.loan_id=l.id AND p.kind='loan' AND p.status='success' LIMIT 1) AS disbursed_at
      FROM finance_loans l LEFT JOIN app_users u ON u.id=l.user_id WHERE l.tenant_id=$1 AND l.org_id=$2${scope} ORDER BY l.created_at DESC,l.id`,params)).rows;
    for(const l of loans) {
      const outstanding=await loanOutstanding(sql,actor.tenantId,groupOrg,String(l.id));
      const paid=l.status==='active'||l.status==='repaid'?difference(num(l.amount),outstanding):0;
      state.loans.push({id:String(l.id),member:memberName(l.user_id,l.member_name),userId:String(l.user_id),amount:num(l.amount),months:num(l.months),status:String(l.status),reasons:l.status==='requested'?['Awaiting independent president approval; eligibility is checked again at approval.']:l.status==='disbursing'?['SIMULATED payment awaiting provider confirmation; cash is reserved.']:[],schedule:schedule(num(l.amount),num(l.months),l.disbursed_at??l.created_at,paid)});
    }
    if(!personal) state.ledger=await ledgerState(sql,actor,groupOrg);
    if(!options.personal) await fillFundState(sql,actor,state);
    if(state.treasury.pending) state.alerts.push({id:'pending',kind:'warning',message:`${state.treasury.pending.toLocaleString()} RWF is held for unresolved simulated disbursements.`});
    if(groupRole==='president'){
      const pendingExpenses=mappedExpenses.filter(e=>e.status==='recorded');
      if(pendingExpenses.length>0) state.alerts.push({id:'pending-expenses',kind:'warning',message:`${pendingExpenses.length} group expense(s) totaling ${sum(pendingExpenses.map(e=>e.amount)).toLocaleString()} RWF awaiting president approval.`});
    }
    if(['president','treasurer'].includes(groupRole)){
      const approvedExpenses=mappedExpenses.filter(e=>e.status==='approved');
      if(approvedExpenses.length>0) state.alerts.push({id:'approved-expenses',kind:'info',message:`${approvedExpenses.length} approved expense(s) totaling ${sum(approvedExpenses.map(e=>e.amount)).toLocaleString()} RWF ready for MoMo payment confirmation.`});
    }
    state.alerts.push({id:'simulation',kind:'info',message:'All payments, USSD and MoMo operations in this demo are synthetic. No real money is sent.'});
    return state;
    }
}
async function ledgerState(sql: Sql, actor: Actor, org: string): Promise<FinanceState['ledger']> {
  const rows=(await sql.query(`SELECT e.id,e.created_at,e.description,e.reference,SUM(l.debit)::text AS debit,SUM(l.credit)::text AS credit
    FROM finance_entries e JOIN finance_lines l ON l.entry_id=e.id AND l.tenant_id=e.tenant_id AND l.org_id=e.org_id
    WHERE e.tenant_id=$1 AND e.org_id=$2 GROUP BY e.id ORDER BY e.created_at DESC,e.id LIMIT 100`,[actor.tenantId,org])).rows;
  return rows.map(r=>({id:String(r.id),date:date(r.created_at),description:String(r.description),debit:num(r.debit),credit:num(r.credit),reference:String(r.reference)}));
}
async function requireMembership(sql: Sql, actor: Actor, org: string) {
  const membership=await one(sql,'SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 FOR SHARE',[actor.tenantId,actor.userId,org]);
  if(!membership) throw new Error('You are not a member of this organization');
  return membership.role as Actor['role'];
}
async function hasMembership(sql: Sql, actor: Actor, org: string) {
  const membership=await one(sql,'SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 FOR SHARE',[actor.tenantId,actor.userId,org]);
  return membership?.role===actor.role;
}
async function notify(sql: Sql, actor: Actor, user: string, message: string) {
  await sql.query('INSERT INTO notifications(id,tenant_id,user_id,message) VALUES($1,$2,$3,$4)',[id('notification'),actor.tenantId,user,`SIMULATED · ${message}`]);
}
async function audit(sql: Sql, actor: Actor, org: string, action: string, input: ActionInput, result: unknown) {
  const prior=await one(sql,'SELECT sequence,hash FROM finance_audit WHERE tenant_id=$1 AND org_id=$2 ORDER BY sequence DESC LIMIT 1',[actor.tenantId,org]);
  const sequence=num(BigInt(String(prior?.sequence??0))+1n),prevHash=String(prior?.hash??'0'.repeat(64));
  const createdAt=new Date().toISOString(),details=JSON.stringify({input,result},(_key,value)=>typeof value==='bigint'?value.toString():value);
  const hash=createHash('sha256').update(JSON.stringify([actor.tenantId,org,sequence,actor.userId,actor.role,action,details,createdAt,prevHash])).digest('hex');
  await sql.query('INSERT INTO finance_audit(id,tenant_id,org_id,sequence,action,actor_id,actor_role,details,created_at,prev_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id('audit'),actor.tenantId,org,sequence,action,actor.userId,actor.role,details,createdAt,prevHash,hash]);
}

const FUND_ACTIONS = [
  'donate','createCampaign','updateCampaign','grantCampaignAccess','revokeCampaignAccess',
  'postCampaignUpdate','addCampaignComment','moderateCampaignComment','toggleCampaignReaction',
  'toggleCampaignFollow','addCampaignMedia','createCampaignMilestone','updateCampaignMilestone',
  'submitCampaignRsvp','addCampaignGiftItem','createMatchingPledge','assignCampaignTeamMember','moderateCampaign'
];

async function requireCampaignTeamRole(
  sql: Sql,
  actor: Actor,
  org: string,
  campaignId: unknown,
  allowedRoles?: CampaignRole[]
) {
  const campaign = await required(sql, 'finance_campaigns', actor, org, campaignId);
  const cId = String(campaign.id);
  const profile = await one(sql, 'SELECT * FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND campaign_id=$2', [actor.tenantId, cId]);
  const isOwner = profile && String(profile.organizer_user_id) === actor.userId;
  const isOrgOfficer = actor.role === 'president' || actor.role === 'treasurer' || (actor.role === 'accountant' && (!allowedRoles || allowedRoles.includes('accountant')));
  const teamRow = await one(sql, 'SELECT campaign_role FROM fundraising_team_members WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4', [actor.tenantId, org, cId, actor.userId]);
  const hasTeamRole = teamRow && (!allowedRoles || allowedRoles.includes(String(teamRow.campaign_role) as CampaignRole) || String(teamRow.campaign_role) === 'owner');
  if (!isOwner && !isOrgOfficer && !hasTeamRole) {
    throw new DomainError('You do not have organizer or team authorization for this campaign.', 403);
  }
  return { campaign, profile };
}

export async function financeAction(db: Database, actor: Actor, input: ActionInput): Promise<unknown> {
  const action=input.action;
  const ngoActions = new Set([
    'createNgoOrganization','updateNgoProfile','addNgoStaffMember','updateNgoStaffRole',
    'createNgoProgram','createNgoProject','createNgoGrant','createNgoBudgetLine',
    'requestNgoExpense','reviewNgoExpense','approveNgoExpense','confirmNgoExpensePayment',
    'recordNgoActivity','verifyNgoActivity','enrollNgoBeneficiaryCohort',
    'submitNgoFieldVisit','syncOfflineFieldVisits','createNgoIndicator',
    'recordIndicatorObservation','verifyNgoIndicator','resolveDataQualityIssue',
    'generateNgoReportSnapshot','approveNgoReportSnapshot','grantNgoDonorAccess','revokeNgoDonorAccess'
  ]);
  if (ngoActions.has(action)) {
    return db.transaction(async sql => {
      const ngoOrg = input.orgId ?? 'ngo-imizi';
      if (!(await hasMembership(sql, actor, ngoOrg)) && actor.role !== 'ngo') {
        throw new DomainError('You are not an authorized member of this NGO workspace.', 403);
      }
      await handleNgoAction(sql, actor, { ...input, kind: action, orgId: ngoOrg }, async (tx, act, oId, evt, details) => {
        await tx.query(
          `INSERT INTO interventions (id, tenant_id, org_id, title) VALUES ($1, $2, $3, $4)`,
          [id('intv'), act.tenantId, oId, `[NGO_AUDIT:${evt}] ${JSON.stringify(details).slice(0, 180)}`]
        );
      });
      return { ok: true, action, orgId: ngoOrg, synthetic: true };
    });
  }
  const defaultOrg=FUND_ACTIONS.includes(action)||(['requestExpense','approveExpense'].includes(action)&&!input.orgId?.startsWith('group-')&&!input.orgId?.startsWith('coop-'))?FUND:['createProposal','vote','recordCoop','subscribeCoopShares','payCoopShares','recordCoopDelivery','confirmDeliveryPayment','recordCoopSale','recordCoopExpense','approveCoopExpense','confirmCoopExpensePayment','calculateSurplusAllocation','approveSurplusAllocation','distributeMemberSurplus','simulateInvestmentProposal','recordGovernanceEvent','assignStaffAppointment'].includes(action)?COOP:GROUP;
  const org=input.orgId??defaultOrg;
  const permission=
    action==='contribute'||action==='donate'||action==='payCoopShares'||action==='addCampaignComment'||action==='toggleCampaignReaction'||action==='toggleCampaignFollow'||action==='submitCampaignRsvp'?'contribute':
    action==='requestLoan'||action==='requestExpense'||action==='subscribeCoopShares'?'request':
    action==='approveLoan'||action==='approveExpense'||action==='approveCoopExpense'||action==='approveSurplusAllocation'?'approve':
    action==='repay'?'repay':
    action==='vote'?'request':
    action==='createCampaign'||action==='updateCampaign'||action==='grantCampaignAccess'||action==='revokeCampaignAccess'||action==='postCampaignUpdate'||action==='moderateCampaignComment'||action==='addCampaignMedia'||action==='createCampaignMilestone'||action==='updateCampaignMilestone'||action==='addCampaignGiftItem'||action==='createMatchingPledge'||action==='assignCampaignTeamMember'||action==='moderateCampaign'?'read':
    action==='recordExpense'||action==='recordIncome'||action==='createExpenseCategory'||action==='recordCoopDelivery'||action==='recordCoopSale'||action==='recordCoopExpense'||action==='calculateSurplusAllocation'||action==='simulateInvestmentProposal'||action==='recordGovernanceEvent'?'report':
    'manage';
  return db.transaction(async sql=>{
    if(['contribute','requestLoan','approveLoan','repay','configureGroup','recordExpense','confirmExpensePayment','recordIncome','createExpenseCategory'].includes(action)&&!org.startsWith('group-')) throw new Error('Your role cannot perform this action in this organization');
    if(['subscribeCoopShares','payCoopShares','recordCoopDelivery','confirmDeliveryPayment','recordCoopSale','recordCoopExpense','approveCoopExpense','confirmCoopExpensePayment','calculateSurplusAllocation','approveSurplusAllocation','distributeMemberSurplus','simulateInvestmentProposal','recordGovernanceEvent','assignStaffAppointment'].includes(action)&&!org.startsWith('coop-')) throw new Error('Your role cannot perform this action in this organization');
    const memberRole=await requireMembership(sql,actor,org);
    const config=await orgRow(sql,actor.tenantId,org);
    if(config.kind==='group'||config.kind==='cooperative') actor={...actor,role:memberRole};
    else if(memberRole!==actor.role) throw new Error('Your membership role does not match your account role');
    if(config.kind==='group'&&config.savings_model==='ROTATING'&&['requestLoan','approveLoan','repay','configureGroup'].includes(action)) throw new Error('Loans and lending changes are disabled for rotating groups.');
    if(config.kind==='group'){
      const permitted=await sql.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 AND role=$4 FOR SHARE',[actor.tenantId,actor.userId,org,actor.role]);
      if(!permitted.rows.length) throw new Error('Your role cannot perform this action in this organization');
      await assertPermission(actor,GROUP,permission);
    } else if(config.kind==='cooperative'){
      const permitted=await sql.query('SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 AND role=$4 FOR SHARE',[actor.tenantId,actor.userId,org,actor.role]);
      if(!permitted.rows.length) throw new Error('Your role cannot perform this action in this organization');
      if(actor.role==='member'){if(!['read','contribute','request'].includes(permission)) throw new Error('Your role cannot perform this action in this organization');}
      else await assertPermission(actor,COOP,permission);
    } else await assertPermission(actor,org,permission);
    if(['contribute','requestLoan','approveLoan','repay','configureGroup','recordExpense','confirmExpensePayment','recordIncome','createExpenseCategory'].includes(action) && config.kind!=='group') throw new Error('Action requires a savings group');
    if(FUND_ACTIONS.includes(action) && config.kind!=='fund') throw new Error('Action requires a fundraising organization');
    if(action==='requestExpense' && config.kind!=='fund' && config.kind!=='group') throw new Error('Action requires a fundraising organization or savings group');
    if(action==='approveExpense' && config.kind!=='fund' && config.kind!=='group') throw new Error('Invalid organization for expense approval');
    if(['createProposal','vote','recordCoop','subscribeCoopShares','payCoopShares','recordCoopDelivery','confirmDeliveryPayment','recordCoopSale','recordCoopExpense','approveCoopExpense','confirmCoopExpensePayment','calculateSurplusAllocation','approveSurplusAllocation','distributeMemberSurplus','simulateInvestmentProposal','recordGovernanceEvent','assignStaffAppointment'].includes(action) && config.kind!=='cooperative') throw new Error('Action requires a cooperative');
    const run=async()=>{switch(action) {
      case 'contribute': {
        const amount=money(input.amount),reference=str(input.reference,'Payment reference');
        let related:{obligationId?:string}={};
        if(config.savings_model==='ROTATING'){
          const obligation=await one(sql,"SELECT * FROM savings_obligations WHERE tenant_id=$1 AND org_id=$2 AND round_id=$3 AND user_id=$4 FOR UPDATE",[actor.tenantId,org,input.roundId,actor.userId]);
          if(!obligation) throw new Error('No contribution obligation exists for your account and selected round');
          if(obligation.status==='paid'||BigInt(String(obligation.amount_confirmed))+BigInt(amount)>BigInt(String(obligation.amount_due))) throw new Error('Contribution exceeds the remaining round obligation');
          if(amount<BigInt(String(obligation.amount_due))-BigInt(String(obligation.amount_confirmed))&&String((await one(sql,'SELECT partial_policy FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,org]))?.partial_policy)==='full_only') throw new Error('This group requires the full contribution obligation in one payment');
          related={obligationId:String(obligation.id)};
        }
        return createPayment(sql,actor,org,'contribution',amount,outcome(input.outcome),reference,related);
      }
      case 'requestLoan': {
        const amount=money(input.amount),months=integer(input.months,1,24,'Months');
        await validateLoan(sql,actor,org,config,amount,actor.userId);
        const loanId=id('loan');
        await sql.query("INSERT INTO finance_loans(id,tenant_id,org_id,user_id,amount,months,status) VALUES($1,$2,$3,$4,$5,$6,'requested')",[loanId,actor.tenantId,org,actor.userId,amount,months]);
        const presidents=(await sql.query("SELECT m.user_id FROM memberships m JOIN app_users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.role='president' AND u.role=m.role",[actor.tenantId,org])).rows;
        for(const president of presidents) await notify(sql,actor,String(president.user_id),`A ${amount.toLocaleString()} RWF loan request awaits independent approval.`);
        return {id:loanId,status:'requested',synthetic:true};
      }
      case 'approveLoan': {
        if(actor.role!=='president') throw new Error('Only the president may approve or decline group loans');
        const loan=await required(sql,'finance_loans',actor,org,input.loanId);
        if(loan.user_id===actor.userId) throw new Error('A president cannot approve their own loan');
        if(input.decision!=='approve'&&input.decision!=='decline') throw new Error('Invalid approval decision');
        if(loan.status!=='requested') {
          if((input.decision==='approve'&&['disbursing','active','repaid'].includes(String(loan.status)))||(input.decision==='decline'&&loan.status==='declined')) return {id:loan.id,status:loan.status,duplicate:true};
          throw new Error('Loan is no longer awaiting approval');
        }
        if(input.decision==='decline') {
          await sql.query("UPDATE finance_loans SET status='declined',approved_by=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4",[actor.userId,actor.tenantId,org,loan.id]);
          await notify(sql,actor,String(loan.user_id),'Your loan request was declined.');
          return {id:loan.id,status:'declined'};
        }
        await validateLoan(sql,actor,org,config,num(loan.amount),String(loan.user_id));
        await sql.query("UPDATE finance_loans SET status='disbursing',approved_by=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4",[actor.userId,actor.tenantId,org,loan.id]);
        await notify(sql,actor,String(loan.user_id),'Your loan was approved; simulated provider confirmation is pending.');
        // Approval creates a pending synthetic provider operation; confirmation is a separate authorized action.
        return createPayment(sql,{...actor,userId:String(loan.user_id)},org,'loan',num(loan.amount),'pending',`loan-${loan.id}`,{loanId:String(loan.id)});
      }
      case 'confirmPayment': {
        const payment=await required(sql,'finance_payments',actor,org,input.paymentId);
        const next=outcome(input.outcome);
        if(payment.status==='success'||payment.status==='failed') {
          if(payment.status!==next) throw new Error('Terminal provider status cannot be changed');
          return {id:payment.id,status:payment.status,duplicate:true,synthetic:true};
        }
        if(payment.kind==='group-payout'){
          if(!['president','treasurer'].includes(actor.role)) throw new Error('Only a group administrator may confirm this simulated payout');
          const round=await required(sql,'savings_rotation_rounds',actor,org,payment.rotation_round_id);
          if(round.recipient_user_id===actor.userId) throw new Error('The payout recipient cannot confirm their own payout');
          if(round.status==='paid') throw new Error('This rotation round has already been paid');
        }
        if(payment.kind==='share-out'&&(!['president','treasurer'].includes(actor.role)||payment.user_id===actor.userId)) throw new Error('A group administrator other than the recipient must confirm a share-out');
        if(next==='success'&&payment.kind==='loan') await validatePendingLoan(sql,actor,org,config,payment);
        await sql.query('UPDATE finance_payments SET status=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[next,actor.tenantId,org,payment.id]);
        if(next==='success') await postPayment(sql,{...payment,status:next});
        if(payment.kind==='group-payout'&&next!=='success') await sql.query('UPDATE savings_rotation_rounds SET status=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[next,actor.tenantId,org,payment.rotation_round_id]);
        if(next==='failed'&&payment.kind==='loan') await sql.query("UPDATE finance_loans SET status='failed' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,payment.loan_id]);
        if(next==='failed'&&payment.kind==='expense') await sql.query("UPDATE finance_expenses SET status='failed' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,payment.expense_id]);
        if(next==='success'||next==='failed') await notify(sql,actor,String(payment.user_id),`Provider ${payment.kind} result: ${next}. Reference ${payment.reference}.`);
        return {id:payment.id,status:next,synthetic:true};
      }
      case 'repay': {
        const loan=await required(sql,'finance_loans',actor,org,input.loanId);
        if(loan.user_id!==actor.userId) throw new Error('Only the borrower may make a personal repayment');
        const amount=money(input.amount), reference=str(input.reference,'Payment reference'),status=outcome(input.outcome);
        const prior=await one(sql,'SELECT id FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND reference=$3',[actor.tenantId,org,reference]);
        if(prior) return createPayment(sql,actor,org,'repayment',amount,status,reference,{loanId:String(loan.id)});
        if(loan.status!=='active') throw new Error('Loan must be active to receive repayment');
        const outstanding=await loanOutstanding(sql,actor.tenantId,org,String(loan.id));
        const held=await one(sql,"SELECT COALESCE(SUM(amount),0)::text AS amount FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND loan_id=$3 AND kind='repayment' AND status IN ('pending','unknown')",[actor.tenantId,org,loan.id]);
        if(BigInt(amount)+BigInt(String(held?.amount??0))>BigInt(outstanding)) throw new Error('Repayment exceeds remaining principal after pending repayments');
        return createPayment(sql,actor,org,'repayment',amount,status,reference,{loanId:String(loan.id)});
      }
      case 'donate': {
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId);
        if(campaign.status!=='active') throw new Error('Campaign is not active');
        const amount=money(input.amount);
        const reference=str(input.reference,'Payment reference');
        const rawCType=typeof input.contributionType==='string'?input.contributionType:'one_time';
        const cType=rawCType==='recurring_intent'||rawCType==='recurring_simulated'?'recurring_simulated':rawCType==='pledge'?'pledge':rawCType==='gift_item'?'gift_item':'one_time';
        const hasFundTables=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_contributions'")).rows.length>0;
        const userRow=await one(sql,'SELECT name FROM app_users WHERE id=$1',[actor.userId]);
        const contributorName=typeof input.contributorName==='string'&&input.contributorName.trim()?sanitizeCampaignText(input.contributorName.slice(0,120)):String(userRow?.name || 'Community Supporter');
        const displayPref=typeof input.displayPreference==='string'&&['public_name','display_name','anonymous'].includes(input.displayPreference)?input.displayPreference:'public_name';
        const customDisplay=typeof input.customDisplayName==='string'?sanitizeCampaignText(input.customDisplayName.slice(0,120)):'';
        const rawChannel=typeof input.channel==='string'?input.channel:'mtn_momo';
        const channel=rawChannel==='airtel_money'?'airtel_money':rawChannel==='card_sim'||rawChannel==='card_simulated'||rawChannel==='bank_transfer'?'card_simulated':'mtn_momo';
        const message=typeof input.message==='string'?sanitizeCampaignText(input.message.slice(0,500)):'';
        const dedication=typeof input.dedication==='string'?sanitizeCampaignText(input.dedication.slice(0,200)):'';
        const giftItemId=typeof input.giftItemId==='string'&&input.giftItemId.trim()?input.giftItemId.trim():null;
        const teamId=typeof input.teamId==='string'&&input.teamId.trim()?input.teamId.trim():null;

        if(cType==='pledge'){
          if(!hasFundTables) throw new Error('Fundraising pledge tables are not initialized');
          const existingPledge=await one(sql,'SELECT id,status FROM fundraising_contributions WHERE tenant_id=$1 AND org_id=$2 AND reference=$3',[actor.tenantId,org,reference]);
          if(existingPledge) return {id:existingPledge.id,status:existingPledge.status,duplicate:true,synthetic:true};
          const pledgeId=id('fcontrib');
          await sql.query(
            `INSERT INTO fundraising_contributions(
               id,tenant_id,org_id,campaign_id,payment_id,user_id,contributor_name,
               display_preference,custom_display_name,amount,contribution_type,channel,status,
               reference,message,dedication,gift_item_id,team_id
             ) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,'pledge',$10,'pledged',$11,$12,$13,$14,$15)`,
            [pledgeId,actor.tenantId,org,String(campaign.id),actor.userId,contributorName,displayPref,customDisplay,amount,channel,reference,message,dedication,giftItemId,teamId]
          );
          return {id:pledgeId,status:'pledged',synthetic:true};
        }

        const payStatus=outcome(input.outcome);
        const payRes=await createPayment(sql,actor,org,'donation',amount,payStatus,reference,{campaignId:String(campaign.id)});
        if(hasFundTables){
          const existingContrib=await one(sql,'SELECT id FROM fundraising_contributions WHERE tenant_id=$1 AND org_id=$2 AND reference=$3',[actor.tenantId,org,reference]);
          if(!existingContrib){
            await sql.query(
              `INSERT INTO fundraising_contributions(
                 id,tenant_id,org_id,campaign_id,payment_id,user_id,contributor_name,
                 display_preference,custom_display_name,amount,contribution_type,channel,status,
                 reference,message,dedication,gift_item_id,team_id
               ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
              [id('fcontrib'),actor.tenantId,org,String(campaign.id),payRes.id,actor.userId,contributorName,displayPref,customDisplay,amount,cType,channel,payRes.status,reference,message,dedication,giftItemId,teamId]
            );
            if(payRes.status==='success' && giftItemId){
              await sql.query(
                `UPDATE fundraising_gift_items
                 SET contributed_amount = contributed_amount + $1,
                     status = CASE WHEN contributed_amount + $1 >= target_amount THEN 'fulfilled' ELSE 'partially_funded' END
                 WHERE tenant_id=$2 AND org_id=$3 AND id=$4`,
                [amount,actor.tenantId,org,giftItemId]
              );
            }
          }
        }
        return payRes;
      }
      case 'createCampaign': {
        const hasFundTables=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_campaign_profiles'")).rows.length>0;
        if(hasFundTables){
          return createRichCampaign(sql,actor,input,org);
        }
        const campaignId=id('campaign');
        await sql.query('INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target) VALUES($1,$2,$3,$4,$5,$6,$7)',[campaignId,actor.tenantId,org,str(input.title,'Title'),str(input.category,'Category',80),str(input.description,'Description',2000),money(input.target)]);
        return {id:campaignId,synthetic:true};
      }
      case 'requestExpense': {
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId), amount=money(input.amount),expenseId=id('expense');
        const totals=await campaignTotals(sql,actor.tenantId,org,String(campaign.id));
        if(amount>difference(totals.raised,totals.spent,totals.held)) throw new Error('Expense exceeds available campaign donations');
        const expTitle=str(input.title,'Expense title');
        await sql.query('INSERT INTO finance_expenses(id,tenant_id,org_id,campaign_id,title,amount,requested_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[expenseId,actor.tenantId,org,campaign.id,expTitle,amount,actor.userId]);
        const hasExpDetails=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_expense_details'")).rows.length>0;
        if(hasExpDetails){
          const expCat=typeof input.category==='string'&&input.category.trim()?input.category.trim().slice(0,80):'Operations';
          const expDesc=typeof input.description==='string'?sanitizeCampaignText(input.description.slice(0,500)):'';
          const vendorName=typeof input.vendorName==='string'?sanitizeCampaignText(input.vendorName.slice(0,120)):'';
          const receiptUrl=typeof input.receiptUrl==='string'?input.receiptUrl.trim().slice(0,500):'';
          const milestoneId=typeof input.milestoneId==='string'&&input.milestoneId.trim()?input.milestoneId.trim():null;
          await sql.query(
            `INSERT INTO fundraising_expense_details(expense_id,tenant_id,org_id,campaign_id,milestone_id,category,description,vendor_name,receipt_url)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [expenseId,actor.tenantId,org,String(campaign.id),milestoneId,expCat,expDesc,vendorName,receiptUrl]
          );
          if(milestoneId){
            await sql.query(
              `UPDATE fundraising_milestones
               SET allocated_amount = allocated_amount + $1,
                   outcome_status = CASE WHEN outcome_status='planned' THEN 'in_progress' ELSE outcome_status END
               WHERE tenant_id=$2 AND org_id=$3 AND id=$4`,
              [amount,actor.tenantId,org,milestoneId]
            );
          }
        }
        return {id:expenseId,status:'requested',synthetic:true};
      }
      case 'approveExpense': {
        if(config.kind==='group'){
          if(actor.role!=='president') throw new Error('Only the group president may approve or decline group expenses');
          const expense=await required(sql,'savings_group_expenses',actor,org,input.expenseId);
          const decision=input.decision==='decline'?'decline':'approve';
          if(expense.status!=='recorded'){
            if((decision==='approve'&&['approved','paid'].includes(String(expense.status)))||(decision==='decline'&&expense.status==='declined')) return {id:expense.id,status:expense.status,duplicate:true};
            throw new Error('Expense is no longer awaiting approval');
          }
          if(decision==='decline'){
            await sql.query("UPDATE savings_group_expenses SET status='declined',approved_by=$1,approved_at=now() WHERE tenant_id=$2 AND org_id=$3 AND id=$4",[actor.userId,actor.tenantId,org,expense.id]);
            await notify(sql,actor,String(expense.recorded_by),`Group expense "${expense.title}" was declined by the president.`);
            return {id:expense.id,status:'declined',synthetic:true};
          }
          const t=await treasury(sql,actor.tenantId,org,config);
          if(num(expense.amount)>t.lendingCapacity) throw new Error('Approved expense exceeds available treasury cash after reserve and pending holds');
          await sql.query("UPDATE savings_group_expenses SET status='approved',approved_by=$1,approved_at=now() WHERE tenant_id=$2 AND org_id=$3 AND id=$4",[actor.userId,actor.tenantId,org,expense.id]);
          await notify(sql,actor,String(expense.recorded_by),`Group expense "${expense.title}" was approved by the president. Ready for payment confirmation.`);
          const officers=(await sql.query("SELECT m.user_id FROM memberships m WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.role IN ('president','treasurer')",[actor.tenantId,org])).rows;
          for(const off of officers) await notify(sql,actor,String(off.user_id),`Approved expense "${expense.title}" (${num(expense.amount).toLocaleString()} RWF) is ready for MoMo payment confirmation.`);
          return {id:expense.id,status:'approved',synthetic:true};
        }
        const expense=await required(sql,'finance_expenses',actor,org,input.expenseId);
        if(expense.requested_by===actor.userId) throw new Error('An expense requires approval by a different authorized person');
        if(expense.status!=='requested') return {id:expense.id,status:expense.status,duplicate:true};
        const amount=num(expense.amount),totals=await campaignTotals(sql,actor.tenantId,org,String(expense.campaign_id));
        if(amount>difference(totals.raised,totals.spent,totals.held) || amount>difference(await balance(sql,actor.tenantId,org,'cash'),await pending(sql,actor.tenantId,org))) throw new Error('Insufficient uncommitted campaign funds');
        await sql.query("UPDATE finance_expenses SET status='pending',approved_by=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4",[actor.userId,actor.tenantId,org,expense.id]);
        return createPayment(sql,actor,org,'expense',amount,'pending',`expense-${expense.id}`,{campaignId:String(expense.campaign_id),expenseId:String(expense.id)});
      }
      case 'createProposal': {
        const proposalId=id('proposal'),amount=money(input.amount),t=await treasury(sql,actor.tenantId,org,config);
        if(amount>t.lendingCapacity) throw new Error('Proposal exceeds cooperative cash after reserve');
        await sql.query('INSERT INTO finance_proposals(id,tenant_id,org_id,title,amount,created_by) VALUES($1,$2,$3,$4,$5,$6)',[proposalId,actor.tenantId,org,str(input.title,'Proposal title'),amount,actor.userId]);
        return {id:proposalId,status:'proposed',synthetic:true};
      }
      case 'vote': {
        const proposal=await required(sql,'finance_proposals',actor,org,input.proposalId);
        if(proposal.status!=='proposed') throw new Error('Proposal is not open for voting');
        await sql.query('INSERT INTO finance_votes(tenant_id,org_id,proposal_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[actor.tenantId,org,proposal.id,actor.userId]);
        return {id:proposal.id,voted:true,synthetic:true};
      }
      case 'recordCoop': {
        const amount=money(input.amount),title=str(input.title,'Record title');
        if(!['revenue','expense','capital'].includes(String(input.kind))) throw new Error('Invalid cooperative record type');
        const isExpense=input.kind==='expense';
        if(isExpense && amount>(await treasury(sql,actor.tenantId,org,config)).lendingCapacity) throw new Error('Cooperative expense would breach cash reserve');
        const entryId=await journal(sql,actor.tenantId,org,title,id('coop-record'),isExpense?[{account:'expenses',debit:amount},{account:'cash',credit:amount}]:[{account:'cash',debit:amount},{account:input.kind==='capital'?'capital':'revenue',credit:amount}]);
        return {id:entryId,synthetic:true};
      }
      case 'configureGroup': {
        const reserve=integer(input.reserveBps,0,10000,'Reserve basis points'),limit=integer(input.loanLimitBps,0,10000,'Loan limit basis points');
        const cash=await balance(sql,actor.tenantId,org,'cash'),held=await pending(sql,actor.tenantId,org);
        if(BigInt(reserveFor(cash,reserve))+BigInt(held)>BigInt(cash)) throw new Error('Reserve configuration conflicts with committed disbursements');
        await sql.query('UPDATE finance_orgs SET reserve_bps=$1,loan_limit_bps=$2 WHERE tenant_id=$3 AND org_id=$4',[reserve,limit,actor.tenantId,org]);
        await sql.query('UPDATE savings_group_policies SET minimum_reserve_bps=$1,loan_limit_bps=$2 WHERE tenant_id=$3 AND org_id=$4',[reserve,limit,actor.tenantId,org]);
        return {reserveBps:reserve,loanLimitBps:limit};
      }
      case 'startRotation': {
        if(config.savings_model!=='ROTATING') throw new Error('Rotation schedules are only available to Ikimina groups');
        if(actor.role!=='president') throw new Error('Only the group president may publish the rotation schedule');
        const policy=await one(sql,'SELECT * FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2 FOR UPDATE',[actor.tenantId,org]);
        if(!policy) throw new Error('Group contribution rules are missing');
        const cycle=await one(sql,"SELECT * FROM savings_cycles WHERE tenant_id=$1 AND org_id=$2 AND status='collecting' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[actor.tenantId,org]);
        if(!cycle) throw new Error('There is no open savings cycle');
        const members=(await sql.query("SELECT u.id,u.name FROM memberships m JOIN app_users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.role IN ('member','president','treasurer') ORDER BY u.name,u.id",[actor.tenantId,org])).rows;
        const expected=num(policy.expected_members);
        if(members.length!==expected) throw new Error(`The agreed schedule requires ${expected} members; ${members.length} have joined.`);
        const prior=await one(sql,'SELECT id FROM savings_rotation_rounds WHERE tenant_id=$1 AND org_id=$2 AND cycle_id=$3 LIMIT 1',[actor.tenantId,org,cycle.id]);
        if(prior) return {status:'scheduled',duplicate:true};
        const order=Array.isArray(policy.rotation_order)?policy.rotation_order as string[]:[];
        const byName=new Map(members.map(m=>[String(m.name).trim().toLowerCase(),String(m.id)]));
        const recipients=order.map(name=>byName.get(name.trim().toLowerCase()));
        if(recipients.length!==expected||recipients.some(x=>!x)||new Set(recipients).size!==expected) throw new Error('Every current member must appear exactly once by their registered account name in the agreed recipient order.');
        const amount=num(policy.contribution_amount),pool=num(BigInt(amount)*BigInt(expected)),first=String(policy.share_out_date??cycle.start_date);
        for(let i=0;i<expected;i++){
          const due=periodDate(first,i,String(policy.contribution_frequency));
          const roundId=id('round');
          await sql.query("INSERT INTO savings_rotation_rounds(id,tenant_id,org_id,cycle_id,round_number,recipient_user_id,due_date,expected_pool) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[roundId,actor.tenantId,org,cycle.id,i+1,recipients[i],due,pool]);
          for(const member of members) await sql.query("INSERT INTO savings_obligations(id,tenant_id,org_id,cycle_id,round_id,user_id,amount_due,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[id('obligation'),actor.tenantId,org,cycle.id,roundId,member.id,amount,due]);
        }
        return {status:'scheduled',rounds:expected};
      }
      case 'payRotation': {
        if(config.savings_model!=='ROTATING'||actor.role!=='president') throw new Error('Only the group president may approve a rotating group payout');
        const round=await required(sql,'savings_rotation_rounds',actor,org,input.roundId);
        if(round.status==='paid') return {id:round.id,status:'paid',duplicate:true};
        if(round.status==='pending'||round.status==='unknown') throw new Error('Resolve the existing synthetic provider attempt before retrying this round');
        const policy=await one(sql,'SELECT partial_policy,missed_policy FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,org]);
        const collected=await one(sql,'SELECT COALESCE(SUM(amount_confirmed),0)::text AS amount FROM savings_obligations WHERE tenant_id=$1 AND org_id=$2 AND round_id=$3',[actor.tenantId,org,round.id]);
        const actual=num(collected?.amount);
        if(actual===0) throw new Error('No confirmed member contributions are available for payout');
        if(actual<num(round.expected_pool)&&policy?.partial_policy!=='allow'){
          await sql.query("UPDATE savings_rotation_rounds SET status='delayed' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,round.id]);
          return {id:round.id,status:'delayed',shortfall:difference(num(round.expected_pool),actual)};
        }
        if(actual<num(round.expected_pool)&&policy?.missed_policy==='delay_round'){
          await sql.query("UPDATE savings_rotation_rounds SET status='delayed' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,round.id]);
          return {id:round.id,status:'delayed',shortfall:difference(num(round.expected_pool),actual)};
        }
        const treasuryNow=await treasury(sql,actor.tenantId,org,config);
        if(actual>difference(treasuryNow.cash,treasuryNow.reserve,treasuryNow.pending)) throw new Error('Confirmed round pool would breach the group reserve');
        const recipient=String(round.recipient_user_id),ref=`rotation-${round.id}-${randomUUID()}`;
        await sql.query("UPDATE savings_rotation_rounds SET status='pending' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,round.id]);
        return createPayment(sql,{...actor,userId:recipient},org,'group-payout',actual,outcome(input.outcome),ref,{rotationRoundId:String(round.id)});
      }
      case 'settleGroupCycle': {
        if(config.savings_model!=='ACCUMULATING'||actor.role!=='president') throw new Error('Only an Itsinda group president can request cycle settlement');
        const cycle=await one(sql,"SELECT * FROM savings_cycles WHERE tenant_id=$1 AND org_id=$2 AND status IN ('collecting','settling') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[actor.tenantId,org]);
        if(!cycle) throw new Error('There is no open accumulation cycle');
        if(cycle.status==='settling') return {id:cycle.id,status:'settling',duplicate:true};
        if(new Date(String(cycle.end_date))>new Date(new Date().toISOString().slice(0,10))) throw new Error('The savings cycle has not reached its agreed end date');
        const t=await treasury(sql,actor.tenantId,org,config);
        if(t.outstandingLoans!==0) throw new Error('Resolve outstanding group loans before share-out');
        if(t.pending!==0) throw new Error('Resolve pending group payments before share-out');
        if(await one(sql,"SELECT id FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND kind='contribution' AND status IN ('pending','unknown') LIMIT 1",[actor.tenantId,org])) throw new Error('Resolve pending contribution payments before share-out');
        const available=difference(t.cash,t.reserve);
        if(available<=0) throw new Error('No cash remains after protecting the required reserve');
        const members=(await sql.query("SELECT m.user_id FROM memberships m WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.role IN ('member','president','treasurer') ORDER BY m.user_id",[actor.tenantId,org])).rows.map(r=>String(r.user_id));
        if(!members.length) throw new Error('No eligible group members are available for settlement');
        const policy=await one(sql,'SELECT distribution_rule FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,org]);
        const weights=new Map<string,number>();for(const user of members)weights.set(user,Math.max(0,-await balance(sql,actor.tenantId,org,'savings',user)));
        const totalWeight=sum([...weights.values()]),distributable=Math.min(available,totalWeight);
        if(distributable<=0) throw new Error('No member savings are available for share-out');
        if(policy?.distribution_rule==='proportional'&&totalWeight===0) throw new Error('Member savings are required for proportional share-out');
        const shares=new Map<string,number>();let allocated=0;
        for(const user of members){const share=policy?.distribution_rule==='equal'?num(BigInt(distributable)/BigInt(members.length)):num(BigInt(distributable)*BigInt(weights.get(user)||0)/BigInt(totalWeight));shares.set(user,share);allocated=sum([allocated,share]);}
        let remainder=difference(distributable,allocated);for(const user of members){if(remainder<=0)break;shares.set(user,sum([shares.get(user)||0,1]));remainder--;}
        if(policy?.distribution_rule==='equal'&&members.some(user=>(shares.get(user)||0)>(weights.get(user)||0))) throw new Error('Equal distribution exceeds a member’s recorded savings; share-out is limited to available individual balances.');
        for(const user of members){const amount=shares.get(user)||0;if(amount>0)await createPayment(sql,{...actor,userId:user},org,'share-out',amount,'pending',`share-${cycle.id}-${user}`,{cycleId:String(cycle.id)});}
        await sql.query("UPDATE savings_cycles SET status='settling' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,cycle.id]);
        return {id:cycle.id,status:'settling',distributable,payments:members.length};
      }
      case 'startSavingsCycle': {
        if(config.kind!=='group'||actor.role!=='president') throw new Error('Only the group president can start a savings cycle');
        const previous=await one(sql,'SELECT * FROM savings_cycles WHERE tenant_id=$1 AND org_id=$2 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',[actor.tenantId,org]);
        if(previous&&previous.status!=='closed') throw new Error('Close the current savings cycle before starting another');
        if(previous&&config.savings_model==='ROTATING'){
          const unpaid=await one(sql,"SELECT id FROM savings_rotation_rounds WHERE tenant_id=$1 AND org_id=$2 AND cycle_id=$3 AND status<>'paid' LIMIT 1",[actor.tenantId,org,previous.id]);
          if(unpaid) throw new Error('Complete every rotation payout before starting a new cycle');
        }
        const start=str(input.startDate,'Cycle start date',10),end=str(input.endDate,'Cycle end date',10),share=str(input.shareOutDate,'First payout or share-out date',10);
        const iso=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
        if(!iso(start)||!iso(end)||!iso(share)||start>=end||share<start||(config.savings_model==='ACCUMULATING'&&share<end)) throw new Error('Cycle dates are invalid or out of order');
        const cycleId=id('cycle');
        await sql.query("INSERT INTO savings_cycles(id,tenant_id,org_id,start_date,end_date) VALUES($1,$2,$3,$4,$5)",[cycleId,actor.tenantId,org,start,end]);
        await sql.query('UPDATE savings_group_policies SET cycle_start=$1,cycle_end=$2,share_out_date=$3 WHERE tenant_id=$4 AND org_id=$5',[start,end,share,actor.tenantId,org]);
        return {id:cycleId,status:'collecting'};
      }
      case 'retryShareOut': {
        if(config.savings_model!=='ACCUMULATING'||actor.role!=='president') throw new Error('Only the Itsinda group president can retry a failed share-out');
        const payment=await required(sql,'finance_payments',actor,org,input.paymentId);
        if(payment.kind!=='share-out'||payment.status!=='failed') throw new Error('Only failed share-out payments can be retried');
        return createPayment(sql,{...actor,userId:String(payment.user_id)},org,'share-out',num(payment.amount),'pending',`share-retry-${payment.id}-${randomUUID()}`,{cycleId:String(payment.cycle_id)});
      }
      case 'createGroupInvite': {
        if(config.kind!=='group'||!['president','treasurer'].includes(actor.role)) throw new Error('Only a group administrator can create an invitation');
        const code=randomUUID().replaceAll('-','').slice(0,24).toUpperCase();
        await sql.query('INSERT INTO savings_group_invites(invite_code,tenant_id,org_id,created_by) VALUES($1,$2,$3,$4)',[code,actor.tenantId,org,actor.userId]);
        return {inviteCode:code};
      }
      case 'setGroupMemberRole': {
        if(config.kind!=='group'||actor.role!=='president') throw new Error('Only the group president can assign member roles');
        const user=str(input.userId,'Member ID',180),role=str(input.memberRole,'Member role',30) as Role;
        const allowedRoles: Role[] = ['president','treasurer','accountant','secretary','member'];
        if(!allowedRoles.includes(role)||user===actor.userId) throw new Error('Choose another member and assign a valid group leadership or member role');
        const targetMembership=await one(sql,'SELECT role FROM memberships WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3',[actor.tenantId,org,user]);
        if(!targetMembership) throw new Error('Member not found in this group');
        const oldRole=String(targetMembership.role) as Role;
        if(oldRole===role) return {userId:user,memberRole:role,duplicate:true};
        await sql.query('UPDATE memberships SET role=$1 WHERE tenant_id=$2 AND org_id=$3 AND user_id=$4',[role,actor.tenantId,org,user]);
        await sql.query('UPDATE app_users SET role=$1 WHERE id=$2',[role,user]);
        if(['president','treasurer','accountant','secretary'].includes(role)){
          const hasWorkspaceCol=(await sql.query("SELECT 1 FROM information_schema.columns WHERE table_name='account_profiles' AND column_name='workspace'")).rows.length>0;
          if(hasWorkspaceCol){
            await sql.query("UPDATE account_profiles SET workspace='groups' WHERE user_id=$1 AND tenant_id=$2",[user,actor.tenantId]);
          }
        }
        await sql.query(
          "INSERT INTO savings_group_role_history(id,tenant_id,org_id,user_id,old_role,new_role,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [id('role-hist'),actor.tenantId,org,user,oldRole,role,actor.userId]
        );
        await notify(sql,actor,user,`Your group role was updated to ${role} by the president.`);
        return {userId:user,oldRole,newRole:role,memberRole:role};
      }
      case 'addGroupMember': {
        if(config.kind!=='group'||!['president','treasurer'].includes(actor.role)) throw new Error('Only a group administrator can add members');
        const name=str(input.name,'Member name',100).trim();
        const rawPhone=str(input.phone,'Telephone number',25).trim();
        const pin=str(input.pin,'PIN number',10).trim();
        const targetRole: Role = ['treasurer','accountant','secretary','member'].includes(String(input.role)) ? String(input.role) as Role : 'member';
        const {normalizeRwandanPhone,hashPhonePin,phoneToEmail}=await import('@/server/phone-auth');
        const phone=normalizeRwandanPhone(rawPhone);
        const pinHash=hashPhonePin(pin);
        const email=phoneToEmail(phone);
        const userId=`user-${phone}`;
        await sql.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash",[userId,name,email,pinHash,targetRole]);
        const hasWorkspaceCol=(await sql.query("SELECT 1 FROM information_schema.columns WHERE table_name='account_profiles' AND column_name='workspace'")).rows.length>0;
        if(hasWorkspaceCol){
          await sql.query("INSERT INTO account_profiles(user_id,tenant_id,status,workspace) VALUES($1,$2,'active','groups') ON CONFLICT (user_id) DO UPDATE SET status='active',workspace='groups'",[userId,actor.tenantId]);
        }else{
          await sql.query("INSERT INTO account_profiles(user_id,tenant_id,status) VALUES($1,$2,'active') ON CONFLICT (user_id) DO UPDATE SET status='active'",[userId,actor.tenantId]);
        }
        const existing=await one(sql,'SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3',[actor.tenantId,userId,org]);
        if(!existing){
          await sql.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,$4)",[actor.tenantId,userId,org,targetRole]);
          await sql.query('UPDATE finance_orgs SET member_count=member_count+1 WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,org]);
          const hasHistoryTable=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_group_role_history'")).rows.length>0;
          if(hasHistoryTable){
            await sql.query(
              "INSERT INTO savings_group_role_history(id,tenant_id,org_id,user_id,old_role,new_role,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [id('role-hist'),actor.tenantId,org,userId,'member',targetRole,actor.userId]
            );
          }
        }else{
          await sql.query('UPDATE memberships SET role=$1 WHERE tenant_id=$2 AND user_id=$3 AND org_id=$4',[targetRole,actor.tenantId,userId,org]);
        }
        if(config.savings_model==='ROTATING'){
          const policy=await one(sql,'SELECT rotation_order,expected_members FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,org]);
          if(policy){
            const currentOrder=Array.isArray(policy.rotation_order)?policy.rotation_order as string[]:[];
            if(!currentOrder.some(n=>n.trim().toLowerCase()===name.toLowerCase())){
              const updatedOrder=[...currentOrder,name];
              const newExpected=Math.max(num(policy.expected_members),updatedOrder.length);
              await sql.query('UPDATE savings_group_policies SET rotation_order=$1::jsonb,expected_members=$2 WHERE tenant_id=$3 AND org_id=$4',[JSON.stringify(updatedOrder),newExpected,actor.tenantId,org]);
            }
          }
        }
        await notify(sql,actor,userId,`Welcome to ${config.name}! Your phone ${phone} is registered as ${targetRole}.`);
        return {ok:true,userId,name,phone,role:targetRole};
      }
      case 'recordExpense': {
        if(config.kind!=='group') throw new Error('Action requires a savings group');
        if(!['accountant','president','treasurer'].includes(actor.role)) throw new Error('Only the accountant, president or treasurer may record group expenses');
        const amount=money(input.amount);
        const category=str(input.category,'Expense category',80);
        const title=str(input.title,'Expense title',120);
        const description=typeof input.description==='string'?input.description.trim().slice(0,500):'';
        const receiptAttachment=typeof input.receiptAttachment==='string'&&input.receiptAttachment.trim()?input.receiptAttachment.trim().slice(0,500):null;
        const expenseId=id('exp');
        await sql.query(
          "INSERT INTO savings_group_expenses(id,tenant_id,org_id,category,title,description,amount,receipt_attachment,status,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'recorded',$9)",
          [expenseId,actor.tenantId,org,category,title,description,amount,receiptAttachment,actor.userId]
        );
        const presidents=(await sql.query("SELECT m.user_id FROM memberships m WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.role='president'",[actor.tenantId,org])).rows;
        for(const p of presidents) await notify(sql,actor,String(p.user_id),`New group expense recorded: ${title} (${amount.toLocaleString()} RWF). Awaiting president approval.`);
        return {id:expenseId,status:'recorded',amount,category,title,synthetic:true};
      }
      case 'confirmExpensePayment': {
        if(config.kind!=='group') throw new Error('Action requires a savings group');
        if(!['president','treasurer'].includes(actor.role)) throw new Error('Only the group president or treasurer may confirm expense payments');
        const expense=await required(sql,'savings_group_expenses',actor,org,input.expenseId);
        if(expense.status==='paid') return {id:expense.id,status:'paid',duplicate:true,synthetic:true};
        if(expense.status!=='approved') throw new Error('Expense must be approved before payment can be confirmed');
        const outcomeVal=outcome(input.outcome??'success');
        if(outcomeVal==='failed'){
          await sql.query("UPDATE savings_group_expenses SET status='failed' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,expense.id]);
          await notify(sql,actor,String(expense.recorded_by),`Simulated MoMo payment for "${expense.title}" failed.`);
          return {id:expense.id,status:'failed',synthetic:true};
        }
        const t=await treasury(sql,actor.tenantId,org,config);
        if(num(expense.amount)>t.lendingCapacity) throw new Error('Expense payment would breach required cash reserve');
        const ref=typeof input.reference==='string'&&input.reference.trim()?input.reference.trim():`exp-momo-${expense.id}-${randomUUID().slice(0,8)}`;
        const paymentResult=await createPayment(sql,actor,org,'expense',num(expense.amount),outcomeVal,ref,{expenseId:String(expense.id)});
        await sql.query(
          "UPDATE savings_group_expenses SET status='paid', payment_reference=$1, journal_id=(SELECT journal_id FROM finance_payments WHERE id=$2) WHERE tenant_id=$3 AND org_id=$4 AND id=$5",
          [ref,paymentResult.id,actor.tenantId,org,expense.id]
        );
        await notify(sql,actor,String(expense.recorded_by),`Payment of ${num(expense.amount).toLocaleString()} RWF for "${expense.title}" confirmed via MoMo.`);
        return {id:expense.id,status:'paid',paymentId:paymentResult.id,reference:ref,synthetic:true};
      }
      case 'recordIncome': {
        if(config.kind!=='group') throw new Error('Action requires a savings group');
        if(!['accountant','president','treasurer'].includes(actor.role)) throw new Error('Only the accountant, president or treasurer may record group income');
        const amount=money(input.amount);
        const source=str(input.source,'Income source',80);
        const description=typeof input.description==='string'?input.description.trim().slice(0,500):'';
        const ref=typeof input.reference==='string'&&input.reference.trim()?input.reference.trim():`income-${randomUUID().slice(0,8)}`;
        const journalId=await journal(sql,actor.tenantId,org,`Group income: ${source} · ${description}`,ref,[
          {account:'cash',debit:amount},
          {account:'revenue',credit:amount}
        ]);
        const payId=id('pay');
        await sql.query(
          "INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,journal_id) VALUES($1,$2,$3,$4,'income',$5,'success',$6,$7)",
          [payId,actor.tenantId,org,actor.userId,amount,ref,journalId]
        );
        const officers=(await sql.query("SELECT m.user_id FROM memberships m WHERE m.tenant_id=$1 AND m.org_id=$2 AND m.role IN ('president','treasurer','accountant')",[actor.tenantId,org])).rows;
        for(const o of officers){
          if(String(o.user_id)!==actor.userId){
            await notify(sql,actor,String(o.user_id),`Group income of ${amount.toLocaleString()} RWF recorded: ${source}.`);
          }
        }
        return {id:payId,journalId,amount,source,status:'success',synthetic:true};
      }
      case 'createExpenseCategory': {
        if(config.kind!=='group') throw new Error('Action requires a savings group');
        if(!['accountant','president','treasurer'].includes(actor.role)) throw new Error('Only the accountant, president or treasurer may create expense categories');
        const name=str(input.name,'Category name',80);
        const description=typeof input.description==='string'?input.description.trim().slice(0,300):'';
        const catId=id('cat');
        await sql.query(
          "INSERT INTO savings_group_expense_categories(id,tenant_id,org_id,name,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,org_id,name) DO UPDATE SET description=EXCLUDED.description",
          [catId,actor.tenantId,org,name,description]
        );
        return {id:catId,name,description,synthetic:true};
      }
      case 'sendPaymentReminder': {
        if(config.kind!=='group'||!['president','treasurer'].includes(actor.role)) throw new Error('Only a group administrator can send payment reminders');
        const memberId=str(input.memberId,'Member ID',180);
        const note=typeof input.note==='string'&&input.note.trim()?input.note.trim():'Your group contribution is due. Please pay via MoMo (*182#).';
        await notify(sql,actor,memberId,`[MOMO-REMINDER] ${note}`);
        return {ok:true,memberId};
      }
      case 'subscribeCoopShares': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const shares = integer(input.shares, 1, 100000, 'Share count');
        const targetUser = typeof input.userId === 'string' && input.userId.trim() ? input.userId.trim() : actor.userId;
        const profile = await one(sql, 'SELECT nominal_share_value, min_shares_per_member, max_shares_per_member FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, org]);
        const nominal = num(profile?.nominal_share_value ?? 10000);
        const amount = num(BigInt(shares) * BigInt(nominal));
        const existing = await one(sql, 'SELECT * FROM cooperative_share_accounts WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3 FOR UPDATE', [actor.tenantId, org, targetUser]);
        if(existing) {
          const newSub = num(existing.shares_subscribed) + shares;
          const maxShares = num(profile?.max_shares_per_member ?? 10000);
          if(newSub > maxShares) throw new Error(`Subscription exceeds bylaw maximum of ${maxShares} shares per member`);
          await sql.query(
            "UPDATE cooperative_share_accounts SET shares_subscribed=shares_subscribed+$1, amount_subscribed=amount_subscribed+$2, amount_outstanding=amount_outstanding+$2 WHERE tenant_id=$3 AND org_id=$4 AND user_id=$5",
            [shares, amount, actor.tenantId, org, targetUser]
          );
        } else {
          await sql.query(
            "INSERT INTO cooperative_share_accounts(id,tenant_id,org_id,user_id,shares_subscribed,shares_paid,amount_subscribed,amount_paid,amount_outstanding,status) VALUES($1,$2,$3,$4,$5,0,$6,0,$6,'active')",
            [id('share-acc'), actor.tenantId, org, targetUser, shares, amount]
          );
        }
        await sql.query(
          "INSERT INTO cooperative_share_transactions(id,tenant_id,org_id,user_id,kind,shares,amount,status) VALUES($1,$2,$3,$4,'subscription',$5,$6,'confirmed')",
          [id('share-tx'), actor.tenantId, org, targetUser, shares, amount]
        );
        return { userId: targetUser, shares, amount, status: 'subscribed', synthetic: true };
      }
      case 'payCoopShares': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const shares = integer(input.shares, 1, 100000, 'Share count');
        const targetUser = typeof input.userId === 'string' && input.userId.trim() ? input.userId.trim() : actor.userId;
        const profile = await one(sql, 'SELECT nominal_share_value FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, org]);
        const nominal = num(profile?.nominal_share_value ?? 10000);
        const amount = num(BigInt(shares) * BigInt(nominal));
        const account = await one(sql, 'SELECT * FROM cooperative_share_accounts WHERE tenant_id=$1 AND org_id=$2 AND user_id=$3 FOR UPDATE', [actor.tenantId, org, targetUser]);
        if(!account) throw new Error('No share subscription found. Please subscribe for shares first.');
        if(num(account.amount_outstanding) < amount) throw new Error('Payment exceeds outstanding share subscription amount');
        const ref = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim() : `share-pay-${randomUUID().slice(0,8)}`;
        const entryId = await journal(sql, actor.tenantId, org, `Member share capital payment: ${shares} shares (${amount.toLocaleString()} RWF)`, ref, [
          { account: 'cash', debit: amount },
          { account: 'capital', credit: amount, user: targetUser }
        ]);
        const payId = id('pay');
        await sql.query(
          "INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,journal_id) VALUES($1,$2,$3,$4,'contribution',$5,'success',$6,$7)",
          [payId, actor.tenantId, org, targetUser, amount, ref, entryId]
        );
        await sql.query(
          "UPDATE cooperative_share_accounts SET shares_paid=shares_paid+$1, amount_paid=amount_paid+$2, amount_outstanding=amount_outstanding-$2 WHERE tenant_id=$3 AND org_id=$4 AND user_id=$5",
          [shares, amount, actor.tenantId, org, targetUser]
        );
        await sql.query(
          "INSERT INTO cooperative_share_transactions(id,tenant_id,org_id,user_id,kind,shares,amount,payment_reference,journal_id,status) VALUES($1,$2,$3,$4,'payment',$5,$6,$7,$8,'confirmed')",
          [id('share-tx'), actor.tenantId, org, targetUser, shares, amount, ref, entryId]
        );
        return { userId: targetUser, shares, amount, status: 'paid', reference: ref, synthetic: true };
      }
      case 'recordCoopDelivery': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const targetUser = typeof input.userId === 'string' && input.userId.trim() ? input.userId.trim() : actor.userId;
        const productName = str(input.productName, 'Product name', 80);
        const category = typeof input.category === 'string' && ['grain','horticulture','coffee','dairy','tea','other'].includes(input.category) ? input.category : 'grain';
        const quantity = integer(input.quantity, 1, 10000000, 'Quantity');
        const unit = typeof input.unit === 'string' && ['kg','liter','bag','crate','ton'].includes(input.unit) ? input.unit : 'kg';
        const grade = typeof input.grade === 'string' && ['Grade A','Grade B','Standard'].includes(input.grade) ? input.grade : 'Grade A';
        const unitPrice = integer(input.unitPrice, 1, 10000000, 'Unit price');
        const totalValue = num(BigInt(quantity) * BigInt(unitPrice));
        const deliveryDate = typeof input.deliveryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate) ? input.deliveryDate : new Date().toISOString().slice(0,10);
        const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 300) : '';
        const deliveryId = id('deliv');
        await sql.query(
          `INSERT INTO cooperative_deliveries(id,tenant_id,org_id,user_id,product_name,category,quantity,unit,grade,unit_price,total_value,payment_status,delivery_date,notes)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13)`,
          [deliveryId, actor.tenantId, org, targetUser, productName, category, quantity, unit, grade, unitPrice, totalValue, deliveryDate, notes]
        );
        return { id: deliveryId, productName, quantity, unit, totalValue, paymentStatus: 'pending', synthetic: true };
      }
      case 'confirmDeliveryPayment': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        if(!['president','treasurer','cooperative'].includes(actor.role)) throw new Error('Only the treasurer, president or cooperative manager can confirm delivery payouts');
        const deliveryId = str(input.deliveryId, 'Delivery ID', 80);
        const delivery = await one(sql, 'SELECT * FROM cooperative_deliveries WHERE tenant_id=$1 AND org_id=$2 AND id=$3 FOR UPDATE', [actor.tenantId, org, deliveryId]);
        if(!delivery) throw new Error('Delivery record not found');
        if(delivery.payment_status === 'paid') return { id: delivery.id, status: 'paid', duplicate: true };
        const amount = num(delivery.total_value);
        const t = await treasury(sql, actor.tenantId, org, config);
        if(amount > t.cash) throw new Error('Insufficient cash in treasury to settle member delivery payout');
        const ref = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim() : `deliv-pay-${randomUUID().slice(0,8)}`;
        const entryId = await journal(sql, actor.tenantId, org, `Member delivery payout: ${delivery.product_name} (${delivery.quantity} ${delivery.unit})`, ref, [
          { account: 'expenses', debit: amount },
          { account: 'cash', credit: amount }
        ]);
        const payId = id('pay');
        await sql.query(
          "INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,journal_id) VALUES($1,$2,$3,$4,'expense',$5,'success',$6,$7)",
          [payId, actor.tenantId, org, String(delivery.user_id), amount, ref, entryId]
        );
        await sql.query(
          "UPDATE cooperative_deliveries SET payment_status='paid', payment_reference=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4",
          [ref, actor.tenantId, org, deliveryId]
        );
        await notify(sql, actor, String(delivery.user_id), `Your delivery payment of ${amount.toLocaleString()} RWF for ${delivery.product_name} has been confirmed.`);
        return { id: deliveryId, amount, status: 'paid', reference: ref, synthetic: true };
      }
      case 'recordCoopSale': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const buyerName = str(input.buyerName, 'Buyer name', 100);
        const productName = str(input.productName, 'Product name', 80);
        const quantity = integer(input.quantity, 1, 100000000, 'Quantity');
        const unit = typeof input.unit === 'string' ? input.unit.trim().slice(0, 20) : 'kg';
        const unitPrice = integer(input.unitPrice, 1, 10000000, 'Unit price');
        const totalAmount = num(BigInt(quantity) * BigInt(unitPrice));
        const saleDate = typeof input.saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.saleDate) ? input.saleDate : new Date().toISOString().slice(0,10);
        const ref = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim() : `sale-${randomUUID().slice(0,8)}`;
        const entryId = await journal(sql, actor.tenantId, org, `Produce commercial sale: ${productName} (${quantity} ${unit}) to ${buyerName}`, ref, [
          { account: 'cash', debit: totalAmount },
          { account: 'revenue', credit: totalAmount }
        ]);
        const payId = id('pay');
        await sql.query(
          "INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,journal_id) VALUES($1,$2,$3,$4,'income',$5,'success',$6,$7)",
          [payId, actor.tenantId, org, actor.userId, totalAmount, ref, entryId]
        );
        const saleId = id('sale');
        await sql.query(
          `INSERT INTO cooperative_sales(id,tenant_id,org_id,buyer_name,product_name,quantity,unit,unit_price,total_amount,payment_status,payment_reference,sale_date,journal_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid',$10,$11,$12)`,
          [saleId, actor.tenantId, org, buyerName, productName, quantity, unit, unitPrice, totalAmount, ref, saleDate, entryId]
        );
        return { id: saleId, buyerName, productName, totalAmount, status: 'paid', reference: ref, synthetic: true };
      }
      case 'recordCoopExpense': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const title = str(input.title, 'Expense title', 100);
        const amount = money(input.amount);
        const category = typeof input.category === 'string' && input.category.trim() ? input.category.trim() : 'Operational';
        const description = typeof input.description === 'string' ? input.description.trim().slice(0, 500) : '';
        const receipt = typeof input.receiptAttachment === 'string' ? input.receiptAttachment.trim().slice(0, 200) : null;
        const expId = id('exp');
        await sql.query(
          `INSERT INTO savings_group_expenses(id,tenant_id,org_id,category,title,description,amount,receipt_attachment,status,recorded_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,'recorded',$9)`,
          [expId, actor.tenantId, org, category, title, description, amount, receipt, actor.userId]
        );
        return { id: expId, title, amount, status: 'recorded', synthetic: true };
      }
      case 'approveCoopExpense': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        if(!['president','cooperative'].includes(actor.role)) throw new Error('Only the cooperative president or chairperson may approve expenses');
        const expenseId = str(input.expenseId, 'Expense ID', 80);
        const decision = input.decision === 'decline' ? 'declined' : 'approved';
        const expense = await one(sql, 'SELECT * FROM savings_group_expenses WHERE tenant_id=$1 AND org_id=$2 AND id=$3 FOR UPDATE', [actor.tenantId, org, expenseId]);
        if(!expense) throw new Error('Expense record not found');
        if(expense.status !== 'recorded') return { id: expense.id, status: expense.status, duplicate: true };
        await sql.query(
          "UPDATE savings_group_expenses SET status=$1, approved_by=$2, approved_at=now() WHERE tenant_id=$3 AND org_id=$4 AND id=$5",
          [decision, actor.userId, actor.tenantId, org, expenseId]
        );
        return { id: expenseId, status: decision, synthetic: true };
      }
      case 'confirmCoopExpensePayment': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        if(!['president','treasurer','cooperative'].includes(actor.role)) throw new Error('Only the treasurer or president may confirm expense payments');
        const expenseId = str(input.expenseId, 'Expense ID', 80);
        const expense = await one(sql, 'SELECT * FROM savings_group_expenses WHERE tenant_id=$1 AND org_id=$2 AND id=$3 FOR UPDATE', [actor.tenantId, org, expenseId]);
        if(!expense) throw new Error('Expense record not found');
        if(expense.status !== 'approved') throw new Error('Only approved expenses can be paid');
        const amount = num(expense.amount);
        const t = await treasury(sql, actor.tenantId, org, config);
        if(amount > t.cash) throw new Error('Expense payment exceeds available cash');
        const ref = typeof input.reference === 'string' && input.reference.trim() ? input.reference.trim() : `exp-momo-${expense.id}-${randomUUID().slice(0,8)}`;
        const entryId = await journal(sql, actor.tenantId, org, `Cooperative expense payment: ${expense.title}`, ref, [
          { account: 'expenses', debit: amount },
          { account: 'cash', credit: amount }
        ]);
        const payId = id('pay');
        await sql.query(
          "INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,journal_id) VALUES($1,$2,$3,$4,'expense',$5,'success',$6,$7)",
          [payId, actor.tenantId, org, actor.userId, amount, ref, entryId]
        );
        await sql.query(
          "UPDATE savings_group_expenses SET status='paid', payment_reference=$1, journal_id=$2 WHERE tenant_id=$3 AND org_id=$4 AND id=$5",
          [ref, entryId, actor.tenantId, org, expenseId]
        );
        return { id: expenseId, amount, status: 'paid', reference: ref, synthetic: true };
      }
      case 'calculateSurplusAllocation': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const periodLabel = str(input.periodLabel, 'Period label', 80);
        const rev = -await balance(sql, actor.tenantId, org, 'revenue');
        const exp = await balance(sql, actor.tenantId, org, 'expenses');
        const netSurplus = difference(rev, exp);
        if(netSurplus <= 0) throw new Error('No net surplus available for distribution in this period');
        const profile = await one(sql, 'SELECT statutory_reserve_bps, social_fund_bps, dividend_pool_bps, bonus_pool_bps FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, org]);
        const statRate = num(profile?.statutory_reserve_bps ?? 2000);
        const socRate = num(profile?.social_fund_bps ?? 1000);
        const divRate = num(profile?.dividend_pool_bps ?? 4000);
        const bonRate = num(profile?.bonus_pool_bps ?? 6000);
        const statutoryReserveAmount = num(BigInt(netSurplus) * BigInt(statRate) / 10000n);
        const socialFundAmount = num(BigInt(netSurplus) * BigInt(socRate) / 10000n);
        const distributableSurplus = Math.max(0, difference(netSurplus, statutoryReserveAmount, socialFundAmount));
        const dividendPool = num(BigInt(distributableSurplus) * BigInt(divRate) / 10000n);
        const bonusPool = num(BigInt(distributableSurplus) * BigInt(bonRate) / 10000n);

        const allocationId = id('surplus');
        await sql.query(
          `INSERT INTO cooperative_surplus_allocations(id,tenant_id,org_id,period_label,gross_revenue,total_expenses,net_surplus,statutory_reserve_amount,social_fund_amount,distributable_surplus,dividend_pool,bonus_pool,status)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'calculated')`,
          [allocationId, actor.tenantId, org, periodLabel, rev, exp, netSurplus, statutoryReserveAmount, socialFundAmount, distributableSurplus, dividendPool, bonusPool]
        );

        // Fetch share holdings
        const shareRows = (await sql.query('SELECT user_id, shares_paid FROM cooperative_share_accounts WHERE tenant_id=$1 AND org_id=$2 AND shares_paid > 0', [actor.tenantId, org])).rows;
        const totalPaidShares = sum(shareRows.map(r => num(r.shares_paid)));

        // Fetch deliverers
        const delivRows = (await sql.query('SELECT user_id, SUM(total_value)::text as val FROM cooperative_deliveries WHERE tenant_id=$1 AND org_id=$2 AND payment_status=$3 GROUP BY user_id', [actor.tenantId, org, 'paid'])).rows;
        const totalDeliveryVal = sum(delivRows.map(r => num(r.val)));

        // Set of all eligible users
        const eligibleUsers = new Set<string>();
        shareRows.forEach(r => eligibleUsers.add(String(r.user_id)));
        delivRows.forEach(r => eligibleUsers.add(String(r.user_id)));

        for(const uId of eligibleUsers) {
          const userShares = num(shareRows.find(r => String(r.user_id) === uId)?.shares_paid ?? 0);
          const userDeliv = num(delivRows.find(r => String(r.user_id) === uId)?.val ?? 0);
          const shareRatioBps = totalPaidShares > 0 ? num(BigInt(userShares) * 10000n / BigInt(totalPaidShares)) : 0;
          const partRatioBps = totalDeliveryVal > 0 ? num(BigInt(userDeliv) * 10000n / BigInt(totalDeliveryVal)) : 0;
          const divAmt = num(BigInt(dividendPool) * BigInt(shareRatioBps) / 10000n);
          const bonAmt = num(BigInt(bonusPool) * BigInt(partRatioBps) / 10000n);
          const totEnt = sum([divAmt, bonAmt]);

          await sql.query(
            `INSERT INTO cooperative_member_distributions(id,tenant_id,org_id,allocation_id,user_id,shares_held,share_ratio_bps,dividend_amount,participation_units,participation_ratio_bps,bonus_amount,total_entitlement,payout_status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'entitled')`,
            [id('dist'), actor.tenantId, org, allocationId, uId, userShares, shareRatioBps, divAmt, userDeliv, partRatioBps, bonAmt, totEnt]
          );
        }

        return { id: allocationId, netSurplus, distributableSurplus, dividendPool, bonusPool, status: 'calculated', synthetic: true };
      }
      case 'approveSurplusAllocation': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        if(!['president','cooperative'].includes(actor.role)) throw new Error('Only the cooperative chairperson or president may record assembly approval');
        const allocationId = str(input.allocationId, 'Allocation ID', 80);
        const resolutionRef = str(input.resolutionRef, 'General Assembly Resolution', 80);
        await sql.query(
          "UPDATE cooperative_surplus_allocations SET status='approved_by_assembly', resolution_ref=$1, approved_by=$2, approved_at=now() WHERE tenant_id=$3 AND org_id=$4 AND id=$5",
          [resolutionRef, actor.userId, actor.tenantId, org, allocationId]
        );
        return { id: allocationId, status: 'approved_by_assembly', resolutionRef, synthetic: true };
      }
      case 'distributeMemberSurplus': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        if(!['president','treasurer','cooperative'].includes(actor.role)) throw new Error('Only the treasurer or president may execute surplus payouts');
        const allocationId = str(input.allocationId, 'Allocation ID', 80);
        const alloc = await one(sql, 'SELECT * FROM cooperative_surplus_allocations WHERE tenant_id=$1 AND org_id=$2 AND id=$3 FOR UPDATE', [actor.tenantId, org, allocationId]);
        if(!alloc) throw new Error('Allocation record not found');
        if(alloc.status === 'distributed') return { id: alloc.id, status: 'distributed', duplicate: true };
        if(alloc.status !== 'approved_by_assembly') throw new Error('Surplus allocation must be approved by the General Assembly before distribution');
        const distributions = (await sql.query('SELECT * FROM cooperative_member_distributions WHERE tenant_id=$1 AND org_id=$2 AND allocation_id=$3 AND payout_status=$4', [actor.tenantId, org, allocationId, 'entitled'])).rows;
        const totalPayout = sum(distributions.map(d => num(d.total_entitlement)));
        const t = await treasury(sql, actor.tenantId, org, config);
        if(totalPayout > t.cash) throw new Error('Insufficient cash in treasury to execute surplus distributions');

        for(const dist of distributions) {
          const amt = num(dist.total_entitlement);
          if(amt <= 0) continue;
          const ref = `dist-pay-${dist.id}-${randomUUID().slice(0,6)}`;
          const entryId = await journal(sql, actor.tenantId, org, `Member surplus benefit distribution (Dividend: ${num(dist.dividend_amount).toLocaleString()} RWF · Bonus: ${num(dist.bonus_amount).toLocaleString()} RWF)`, ref, [
            { account: 'capital', debit: amt },
            { account: 'cash', credit: amt }
          ]);
          await sql.query(
            "INSERT INTO finance_payments(id,tenant_id,org_id,user_id,kind,amount,status,reference,journal_id) VALUES($1,$2,$3,$4,'share-out',$5,'success',$6,$7)",
            [id('pay'), actor.tenantId, org, String(dist.user_id), amt, ref, entryId]
          );
          await sql.query(
            "UPDATE cooperative_member_distributions SET payout_status='paid', payout_reference=$1, paid_at=now() WHERE id=$2",
            [ref, dist.id]
          );
          await notify(sql, actor, String(dist.user_id), `Your annual cooperative benefit of ${amt.toLocaleString()} RWF has been paid to your registered MoMo account.`);
        }
        await sql.query("UPDATE cooperative_surplus_allocations SET status='distributed' WHERE id=$1", [allocationId]);
        return { allocationId, totalPayout, status: 'distributed', paymentsCount: distributions.length, synthetic: true };
      }
      case 'simulateInvestmentProposal': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const title = str(input.title, 'Proposal title', 100);
        const category = typeof input.category === 'string' && ['processing','logistics','storage','equipment','energy','infrastructure'].includes(input.category) ? input.category : 'equipment';
        const capitalCost = integer(input.capitalCost, 10000, 1000000000, 'Capital cost');
        const monthlyOperatingCost = integer(input.monthlyOperatingCost ?? 0, 0, 100000000, 'Monthly operating cost');
        const expectedMonthlyBenefit = integer(input.expectedMonthlyBenefit ?? 0, 0, 100000000, 'Expected monthly benefit');
        const usefulLifeMonths = integer(input.usefulLifeMonths ?? 60, 1, 600, 'Useful life months');
        const financingSource = typeof input.financingSource === 'string' && ['cash_reserve','member_levy','commercial_loan'].includes(input.financingSource) ? input.financingSource : 'cash_reserve';

        const cash = await balance(sql, actor.tenantId, org, 'cash');
        const profile = await one(sql, 'SELECT statutory_reserve_bps FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, org]);
        const minReserve = bps(cash, num(profile?.statutory_reserve_bps ?? 2000));
        const remainingCash = difference(cash, capitalCost);
        const netMonthlyGain = difference(expectedMonthlyBenefit, monthlyOperatingCost);
        const paybackMonths = netMonthlyGain > 0 ? Math.ceil(capitalCost / netMonthlyGain) : 999;
        const verdict = remainingCash < minReserve ? 'critical_liquidity' : (paybackMonths > usefulLifeMonths ? 'caution' : 'sustainable');

        const invId = id('inv');
        await sql.query(
          `INSERT INTO cooperative_investments(id,tenant_id,org_id,title,category,capital_cost,monthly_operating_cost,expected_monthly_benefit,useful_life_months,financing_source,status,guardian_verdict,payback_months,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'simulated',$11,$12,$13)`,
          [invId, actor.tenantId, org, title, category, capitalCost, monthlyOperatingCost, expectedMonthlyBenefit, usefulLifeMonths, financingSource, verdict, paybackMonths, actor.userId]
        );
        return {
          id: invId,
          title,
          capitalCost,
          remainingCashAfterPurchase: remainingCash,
          liquidityBuffer: difference(remainingCash, minReserve),
          paybackMonths,
          netMonthlyGain,
          guardianVerdict: verdict,
          synthetic: true
        };
      }
      case 'recordGovernanceEvent': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        const eventType = typeof input.eventType === 'string' && ['board_meeting','general_assembly','supervisory_audit'].includes(input.eventType) ? input.eventType : 'board_meeting';
        const title = str(input.title, 'Meeting title', 100);
        const meetingDate = typeof input.meetingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.meetingDate) ? input.meetingDate : new Date().toISOString().slice(0,10);
        const agenda = str(input.agenda, 'Agenda', 500);
        const resolutions = str(input.resolutions, 'Resolutions', 1000);
        const govId = id('gov');
        await sql.query(
          `INSERT INTO cooperative_governance_events(id,tenant_id,org_id,event_type,title,meeting_date,agenda,resolutions,recorded_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [govId, actor.tenantId, org, eventType, title, meetingDate, agenda, resolutions, actor.userId]
        );
        return { id: govId, title, eventType, recorded: true, synthetic: true };
      }
      case 'assignStaffAppointment': {
        if(config.kind !== 'cooperative') throw new Error('Action requires a cooperative');
        if(!['president','cooperative'].includes(actor.role)) throw new Error('Only the chairperson or president can appoint staff');
        const targetUser = str(input.userId, 'Member ID', 180);
        const title = str(input.title, 'Staff title', 80);
        const department = typeof input.department === 'string' && input.department.trim() ? input.department.trim() : 'Administration';
        const staffId = id('staff');
        await sql.query(
          `INSERT INTO cooperative_staff_appointments(id,tenant_id,org_id,user_id,title,department,appointed_at,status)
           VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'active')`,
          [staffId, actor.tenantId, org, targetUser, title, department]
        );
        return { id: staffId, userId: targetUser, title, department, status: 'active', synthetic: true };
      }
      case 'reverseEntry': {
        const entry=await required(sql,'finance_entries',actor,org,input.entryId);
        if(entry.reversal_of) throw new Error('Cannot reverse a reversal');
        const prior=await one(sql,'SELECT id FROM finance_entries WHERE tenant_id=$1 AND org_id=$2 AND reversal_of=$3',[actor.tenantId,org,entry.id]);
        if(prior) return {id:prior.id,duplicate:true};
        const lines=(await sql.query('SELECT * FROM finance_lines WHERE tenant_id=$1 AND org_id=$2 AND entry_id=$3',[actor.tenantId,org,entry.id])).rows;
        const payment=await one(sql,'SELECT * FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND journal_id=$3',[actor.tenantId,org,entry.id]);
        if(payment?.kind==='loan') {
          const outstanding=await loanOutstanding(sql,actor.tenantId,org,String(payment.loan_id));
          if(outstanding!==num(payment.amount)) throw new Error('Reverse repayments before reversing this loan disbursement');
          const unresolved=await one(sql,"SELECT id FROM finance_payments WHERE tenant_id=$1 AND org_id=$2 AND loan_id=$3 AND kind='repayment' AND status IN ('pending','unknown') LIMIT 1",[actor.tenantId,org,payment.loan_id]);
          if(unresolved) throw new Error('Resolve pending repayments before reversing this loan disbursement');
        }
        if(payment?.kind==='donation') {
          const totals=await campaignTotals(sql,actor.tenantId,org,String(payment.campaign_id));
          if(num(payment.amount)>difference(totals.raised,totals.spent,totals.held)) throw new Error('Donation is committed to campaign expenses and cannot be reversed');
        }
        // Reversal must not make cash, receivables, or member savings negative or consume committed cash.
        for(const l of lines) {
          const account=String(l.account);
          const delta=BigInt(String(l.credit))-BigInt(String(l.debit));
          if(['cash','loans'].includes(account)) {
            const current=await balance(sql,actor.tenantId,org,account,account==='loans'?String(l.user_id):undefined);
            if(BigInt(current)+delta<0n) throw new Error('Reversal would create a negative asset balance');
            if(account==='cash') {
              const afterCash=num(BigInt(current)+delta),requiredReserve=config.kind==='fund'?0:reserveFor(afterCash,num(config.reserve_bps));
              if(difference(afterCash,requiredReserve)<await pending(sql,actor.tenantId,org)) throw new Error('Reversal would consume cash reserve or pending disbursement holds');
            }
          }
          if(account==='savings'&&BigInt(await balance(sql,actor.tenantId,org,'savings',String(l.user_id)))+delta>0n) throw new Error('Reversal exceeds member savings');
        }
        const entryId=await journal(sql,actor.tenantId,org,`Reversal of ${entry.reference}`,`reversal-${entry.id}`,lines.map(l=>({account:String(l.account),debit:num(l.credit),credit:num(l.debit),...(l.user_id?{user:String(l.user_id)}:{})})),String(entry.id));
        if(payment?.kind==='loan') await sql.query("UPDATE finance_loans SET status='reversed' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,payment.loan_id]);
        if(payment?.kind==='repayment') await sql.query("UPDATE finance_loans SET status='active' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,payment.loan_id]);
        if(payment?.kind==='donation') {
          const hasContribTable=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fundraising_contributions'")).rows.length>0;
          if(hasContribTable) await sql.query("UPDATE fundraising_contributions SET status='reversed' WHERE tenant_id=$1 AND org_id=$2 AND payment_id=$3",[actor.tenantId,org,payment.id]);
        }
        return {id:entryId,reversalOf:entry.id,synthetic:true};
      }
      case 'updateCampaign': {
        const {campaign,profile}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer']);
        const cId=String(campaign.id);
        if(typeof input.title==='string'&&input.title.trim()){
          await sql.query('UPDATE finance_campaigns SET title=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[sanitizeCampaignText(input.title.slice(0,140)),actor.tenantId,org,cId]);
        }
        if(typeof input.description==='string'&&input.description.trim()){
          await sql.query('UPDATE finance_campaigns SET description=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[sanitizeCampaignText(input.description.slice(0,2000)),actor.tenantId,org,cId]);
        }
        if(input.target!==undefined){
          const nextTarget=money(input.target);
          await sql.query('UPDATE finance_campaigns SET target=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[nextTarget,actor.tenantId,org,cId]);
        }
        if(typeof input.status==='string'&&['active','paused','completed','archived'].includes(input.status)){
          await sql.query('UPDATE finance_campaigns SET status=$1 WHERE tenant_id=$2 AND org_id=$3 AND id=$4',[input.status,actor.tenantId,org,cId]);
        }
        if(profile){
          const vis=typeof input.visibility==='string'&&['public','unlisted','private'].includes(input.visibility)?input.visibility:String(profile.visibility);
          const statsVis=typeof input.statsVisibility==='string'&&['everyone','contributors_only','selected_contributors','team_only'].includes(input.statsVisibility)?input.statsVisibility:String(profile.stats_visibility);
          const goalVis=typeof input.goalVisibility==='string'&&['everyone','contributors_only','selected_contributors','team_only'].includes(input.goalVisibility)?input.goalVisibility:String(profile.goal_visibility);
          const raisedVis=typeof input.raisedVisibility==='string'&&['everyone','contributors_only','selected_contributors','team_only'].includes(input.raisedVisibility)?input.raisedVisibility:String(profile.raised_visibility);
          const contribVis=typeof input.contributorsVisibility==='string'&&['everyone','contributors_only','selected_contributors','team_only'].includes(input.contributorsVisibility)?input.contributorsVisibility:String(profile.contributors_visibility);
          const spendVis=typeof input.spendingVisibility==='string'&&['everyone','contributors_only','selected_contributors','team_only'].includes(input.spendingVisibility)?input.spendingVisibility:String(profile.spending_visibility);
          const theme=typeof input.theme==='string'&&['classic_blue','wedding_elegant','birthday_celebration','charity_warm','community_impact','medical_trust'].includes(input.theme)?input.theme:String(profile.theme);
          const story=typeof input.story==='string'&&input.story.trim()?sanitizeCampaignText(input.story.slice(0,8000)):String(profile.story);
          const cover=typeof input.coverImageUrl==='string'?input.coverImageUrl.trim().slice(0,500):String(profile.cover_image_url);
          const allowComments=typeof input.allowComments==='boolean'?input.allowComments:Boolean(profile.allow_comments);
          const allowAnon=typeof input.allowAnonymous==='boolean'?input.allowAnonymous:Boolean(profile.allow_anonymous);
          const allowRsvp=typeof input.allowRsvp==='boolean'?input.allowRsvp:Boolean(profile.allow_rsvp);
          await sql.query(
            `UPDATE fundraising_campaign_profiles
             SET visibility=$1,stats_visibility=$2,goal_visibility=$3,raised_visibility=$4,
                 contributors_visibility=$5,spending_visibility=$6,theme=$7,story=$8,
                 cover_image_url=$9,allow_comments=$10,allow_anonymous=$11,allow_rsvp=$12,
                 updated_at=now()
             WHERE tenant_id=$13 AND org_id=$14 AND campaign_id=$15`,
            [vis,statsVis,goalVis,raisedVis,contribVis,spendVis,theme,story,cover,allowComments,allowAnon,allowRsvp,actor.tenantId,org,cId]
          );
        }
        return {id:cId,updated:true,synthetic:true};
      }
      case 'grantCampaignAccess': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer']);
        const cId=String(campaign.id);
        const targetUser=str(input.userId,'Target user ID',180);
        const rawGrant=typeof input.grantType==='string'?input.grantType:'selected_stats';
        const grantType=rawGrant==='private_view'||rawGrant==='campaign_view'?'campaign_view':rawGrant==='full_transparency'?'full_transparency':'selected_stats';
        const uRow=await one(sql,'SELECT name FROM app_users WHERE id=$1',[targetUser]);
        const targetName=typeof input.userName==='string'&&input.userName.trim()?sanitizeCampaignText(input.userName.slice(0,120)):String(uRow?.name||targetUser);
        const gId=id('fgrant');
        await sql.query(
          `INSERT INTO fundraising_access_grants(id,tenant_id,org_id,campaign_id,user_id,user_name,grant_type,status,granted_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,'active',$8)
           ON CONFLICT (tenant_id,org_id,campaign_id,user_id,grant_type)
           DO UPDATE SET status='active',granted_by=$8`,
          [gId,actor.tenantId,org,cId,targetUser,targetName,grantType,actor.userId]
        );
        return {campaignId:cId,userId:targetUser,grantType,status:'active',synthetic:true};
      }
      case 'revokeCampaignAccess': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer']);
        const cId=String(campaign.id);
        const targetUser=str(input.userId,'Target user ID',180);
        const rawGrant=typeof input.grantType==='string'?input.grantType:null;
        const grantType=rawGrant==='private_view'||rawGrant==='campaign_view'?'campaign_view':rawGrant==='full_transparency'?'full_transparency':rawGrant==='selected_stats'?'selected_stats':null;
        if(grantType){
          await sql.query(
            `UPDATE fundraising_access_grants SET status='revoked'
             WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4 AND grant_type=$5`,
            [actor.tenantId,org,cId,targetUser,grantType]
          );
        } else {
          await sql.query(
            `UPDATE fundraising_access_grants SET status='revoked'
             WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4`,
            [actor.tenantId,org,cId,targetUser]
          );
        }
        return {campaignId:cId,userId:targetUser,status:'revoked',synthetic:true};
      }
      case 'postCampaignUpdate': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer','accountant','moderator']);
        const cId=String(campaign.id);
        const rawUType=typeof input.updateType==='string'?input.updateType:'progress';
        const uType=['progress','milestone','thank_you','announcement','spending','photo'].includes(rawUType)?rawUType:'announcement';
        const title=sanitizeCampaignText(str(input.title,'Update title',160));
        const body=sanitizeCampaignText(str(input.body,'Update body',4000));
        const mediaUrl=typeof input.mediaUrl==='string'?input.mediaUrl.trim().slice(0,500):'';
        const uRow=await one(sql,'SELECT name FROM app_users WHERE id=$1',[actor.userId]);
        const authorName=String(uRow?.name||actor.userId);
        const updId=id('fupd');
        await sql.query(
          `INSERT INTO fundraising_campaign_updates(id,tenant_id,org_id,campaign_id,update_type,title,body,media_url,author_id,author_name)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [updId,actor.tenantId,org,cId,uType,title,body,mediaUrl,actor.userId,authorName]
        );
        const followers=(await sql.query('SELECT user_id FROM fundraising_followers WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3',[actor.tenantId,org,cId])).rows;
        for(const f of followers){
          await notify(sql,actor,String(f.user_id),`Campaign update on "${campaign.title}": ${title}`);
        }
        return {id:updId,campaignId:cId,title,synthetic:true};
      }
      case 'addCampaignComment': {
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId);
        const cId=String(campaign.id);
        const profile=await one(sql,'SELECT allow_comments FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND campaign_id=$2',[actor.tenantId,cId]);
        if(profile && !profile.allow_comments) throw new Error('Comments are disabled for this campaign');
        const msg=sanitizeCampaignText(str(input.message,'Message',1000));
        const isAnon=Boolean(input.isAnonymous);
        const rawCType=typeof input.commentType==='string'?input.commentType:'comment';
        const cType=['comment','guestbook','congratulation','dedication'].includes(rawCType)?rawCType:'comment';
        const reaction=typeof input.reaction==='string'&&['heart','celebrate','pray','clap','support','star'].includes(input.reaction)?input.reaction:'heart';
        const uRow=await one(sql,'SELECT name FROM app_users WHERE id=$1',[actor.userId]);
        const authorName=isAnon?'Anonymous Supporter':(typeof input.authorName==='string'&&input.authorName.trim()?sanitizeCampaignText(input.authorName.slice(0,120)):String(uRow?.name||'Community Member'));
        const commId=id('fcomm');
        await sql.query(
          `INSERT INTO fundraising_comments(id,tenant_id,org_id,campaign_id,author_id,author_name,is_anonymous,comment_type,message,reaction)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [commId,actor.tenantId,org,cId,actor.userId,authorName,isAnon,cType,msg,reaction]
        );
        return {id:commId,campaignId:cId,authorName,synthetic:true};
      }
      case 'moderateCampaignComment': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','moderator']);
        const cId=String(campaign.id);
        const commentId=str(input.commentId,'Comment ID',80);
        const status=input.status==='visible'?'visible':'hidden';
        await sql.query('UPDATE fundraising_comments SET status=$1 WHERE tenant_id=$2 AND org_id=$3 AND campaign_id=$4 AND id=$5',[status,actor.tenantId,org,cId,commentId]);
        return {id:commentId,status,synthetic:true};
      }
      case 'toggleCampaignReaction': {
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId);
        const cId=String(campaign.id);
        const rawReaction=typeof input.reaction==='string'?input.reaction:'heart';
        const reaction=['heart','celebrate','pray','clap','star'].includes(rawReaction)?rawReaction:'star';
        const existing=await one(sql,"SELECT id FROM fundraising_reactions WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND target_type='campaign' AND target_id=$3 AND user_id=$4",[actor.tenantId,org,cId,actor.userId]);
        if(existing){
          await sql.query('DELETE FROM fundraising_reactions WHERE id=$1',[existing.id]);
          return {campaignId:cId,reaction,active:false,synthetic:true};
        }
        await sql.query("INSERT INTO fundraising_reactions(id,tenant_id,org_id,campaign_id,target_type,target_id,user_id,reaction_type) VALUES($1,$2,$3,$4,'campaign',$4,$5,$6) ON CONFLICT DO NOTHING",[id('freact'),actor.tenantId,org,cId,actor.userId,reaction]);
        return {campaignId:cId,reaction,active:true,synthetic:true};
      }
      case 'toggleCampaignFollow': {
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId);
        const cId=String(campaign.id);
        const existing=await one(sql,'SELECT 1 FROM fundraising_followers WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4',[actor.tenantId,org,cId,actor.userId]);
        if(existing){
          await sql.query('DELETE FROM fundraising_followers WHERE tenant_id=$1 AND org_id=$2 AND campaign_id=$3 AND user_id=$4',[actor.tenantId,org,cId,actor.userId]);
          return {campaignId:cId,following:false,synthetic:true};
        }
        await sql.query('INSERT INTO fundraising_followers(tenant_id,org_id,campaign_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[actor.tenantId,org,cId,actor.userId]);
        return {campaignId:cId,following:true,synthetic:true};
      }
      case 'addCampaignMedia': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','moderator']);
        const cId=String(campaign.id);
        const url=str(input.url,'Media URL',500);
        const rawMType=typeof input.mediaType==='string'?input.mediaType:'gallery';
        const mediaType=['cover','gallery','video','document'].includes(rawMType)?rawMType:'gallery';
        const caption=typeof input.caption==='string'?sanitizeCampaignText(input.caption.slice(0,240)):'';
        const mediaId=id('fmedia');
        await sql.query(
          `INSERT INTO fundraising_campaign_media(id,tenant_id,org_id,campaign_id,media_type,url,caption,uploaded_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [mediaId,actor.tenantId,org,cId,mediaType,url,caption,actor.userId]
        );
        if(mediaType==='cover'){
          await sql.query('UPDATE fundraising_campaign_profiles SET cover_image_url=$1,updated_at=now() WHERE tenant_id=$2 AND campaign_id=$3',[url,actor.tenantId,cId]);
        }
        return {id:mediaId,campaignId:cId,url,mediaType,synthetic:true};
      }
      case 'createCampaignMilestone': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer','accountant']);
        const cId=String(campaign.id);
        const title=sanitizeCampaignText(str(input.title,'Milestone title',140));
        const desc=typeof input.description==='string'?sanitizeCampaignText(input.description.slice(0,400)):'';
        const targetAmount=money(input.targetAmount);
        const mId=id('fmile');
        await sql.query(
          `INSERT INTO fundraising_milestones(id,tenant_id,org_id,campaign_id,title,description,target_amount)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [mId,actor.tenantId,org,cId,title,desc,targetAmount]
        );
        return {id:mId,campaignId:cId,title,targetAmount,synthetic:true};
      }
      case 'updateCampaignMilestone': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer','accountant']);
        const cId=String(campaign.id);
        const milestoneId=str(input.milestoneId,'Milestone ID',80);
        const oStatus=typeof input.outcomeStatus==='string'&&['planned','in_progress','funded_pending_execution','completed_verified'].includes(input.outcomeStatus)?input.outcomeStatus:'in_progress';
        const outcomeEvidence=typeof input.outcomeEvidence==='string'?sanitizeCampaignText(input.outcomeEvidence.slice(0,400)):typeof input.proofNote==='string'?sanitizeCampaignText(input.proofNote.slice(0,400)):'';
        await sql.query(
          `UPDATE fundraising_milestones SET outcome_status=$1,outcome_evidence=$2
           WHERE tenant_id=$3 AND org_id=$4 AND campaign_id=$5 AND id=$6`,
          [oStatus,outcomeEvidence,actor.tenantId,org,cId,milestoneId]
        );
        return {id:milestoneId,outcomeStatus:oStatus,synthetic:true};
      }
      case 'submitCampaignRsvp': {
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId);
        const cId=String(campaign.id);
        const profile=await one(sql,'SELECT allow_rsvp FROM fundraising_campaign_profiles WHERE tenant_id=$1 AND campaign_id=$2',[actor.tenantId,cId]);
        if(profile && !profile.allow_rsvp) throw new Error('RSVPs are not enabled for this campaign');
        const uRow=await one(sql,'SELECT name FROM app_users WHERE id=$1',[actor.userId]);
        const guestName=typeof input.guestName==='string'&&input.guestName.trim()?sanitizeCampaignText(input.guestName.slice(0,120)):String(uRow?.name||'Invited Guest');
        const attendanceStatus=typeof input.attendanceStatus==='string'&&['attending','maybe','declined'].includes(input.attendanceStatus)?input.attendanceStatus:'attending';
        const guestsCount=integer(input.guestsCount??1,1,10,'Guests count');
        const dietaryOrNote=typeof input.dietaryOrNote==='string'?sanitizeCampaignText(input.dietaryOrNote.slice(0,300)):'';
        const rsvpId=id('frsvp');
        await sql.query(
          `INSERT INTO fundraising_rsvps(id,tenant_id,org_id,campaign_id,user_id,guest_name,attendance_status,guests_count,dietary_or_note)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (tenant_id,org_id,campaign_id,user_id)
           DO UPDATE SET guest_name=$6,attendance_status=$7,guests_count=$8,dietary_or_note=$9`,
          [rsvpId,actor.tenantId,org,cId,actor.userId,guestName,attendanceStatus,guestsCount,dietaryOrNote]
        );
        return {campaignId:cId,attendanceStatus,guestsCount,synthetic:true};
      }
      case 'addCampaignGiftItem': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer']);
        const cId=String(campaign.id);
        const title=sanitizeCampaignText(str(input.title,'Gift item title',120));
        const desc=typeof input.description==='string'?sanitizeCampaignText(input.description.slice(0,300)):'';
        const targetAmount=money(input.targetAmount);
        const imageUrl=typeof input.imageUrl==='string'?input.imageUrl.trim().slice(0,500):'';
        const gId=id('fgift');
        await sql.query(
          `INSERT INTO fundraising_gift_items(id,tenant_id,org_id,campaign_id,title,description,target_amount,image_url)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [gId,actor.tenantId,org,cId,title,desc,targetAmount,imageUrl]
        );
        return {id:gId,campaignId:cId,title,targetAmount,synthetic:true};
      }
      case 'createMatchingPledge': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer','treasurer']);
        const cId=String(campaign.id);
        const sponsorName=sanitizeCampaignText(str(input.sponsorName,'Sponsor name',140));
        const pledgedAmount=money(input.pledgedAmount);
        const matchRatioBps=integer(input.matchRatioBps??10000,1000,10000,'Match ratio bps');
        const mId=id('fmatch');
        await sql.query(
          `INSERT INTO fundraising_matching_pledges(id,tenant_id,org_id,campaign_id,sponsor_name,pledged_amount,match_ratio_bps)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [mId,actor.tenantId,org,cId,sponsorName,pledgedAmount,matchRatioBps]
        );
        return {id:mId,campaignId:cId,sponsorName,pledgedAmount,synthetic:true};
      }
      case 'assignCampaignTeamMember': {
        const {campaign}=await requireCampaignTeamRole(sql,actor,org,input.campaignId,['owner','co_organizer']);
        const cId=String(campaign.id);
        const targetUser=str(input.userId,'User ID',180);
        const rawRole=typeof input.campaignRole==='string'?input.campaignRole:'co_organizer';
        const campaignRole=['owner','co_organizer','accountant','treasurer','approver','content_manager','team_captain'].includes(rawRole)?rawRole:'content_manager';
        const uRow=await one(sql,'SELECT name FROM app_users WHERE id=$1',[targetUser]);
        const userName=typeof input.userName==='string'&&input.userName.trim()?sanitizeCampaignText(input.userName.slice(0,120)):String(uRow?.name||targetUser);
        const tId=id('fteam');
        await sql.query(
          `INSERT INTO fundraising_team_members(id,tenant_id,org_id,campaign_id,user_id,user_name,campaign_role,assigned_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (tenant_id,org_id,campaign_id,user_id)
           DO UPDATE SET campaign_role=$7,user_name=$6,assigned_by=$8`,
          [tId,actor.tenantId,org,cId,targetUser,userName,campaignRole,actor.userId]
        );
        return {campaignId:cId,userId:targetUser,campaignRole,synthetic:true};
      }
      case 'moderateCampaign': {
        if(!['president','treasurer','ngo'].includes(actor.role)) throw new DomainError('Only authorized platform officers can moderate campaign verification status.',403);
        const campaign=await required(sql,'finance_campaigns',actor,org,input.campaignId);
        const cId=String(campaign.id);
        const verificationStatus=typeof input.verificationStatus==='string'&&['unverified','pending_review','verified_demo','requires_review','suspended'].includes(input.verificationStatus)?input.verificationStatus:'verified_demo';
        const reason=typeof input.reason==='string'?sanitizeCampaignText(input.reason.slice(0,400)):'Reviewed in HURIZA demo governance.';
        await sql.query(
          `UPDATE fundraising_campaign_profiles SET verification_status=$1,verification_notes=$2,updated_at=now()
           WHERE tenant_id=$3 AND org_id=$4 AND campaign_id=$5`,
          [verificationStatus,reason,actor.tenantId,org,cId]
        );
        if(verificationStatus==='suspended'){
          await sql.query("UPDATE finance_campaigns SET status='paused' WHERE tenant_id=$1 AND org_id=$2 AND id=$3",[actor.tenantId,org,cId]);
        }
        const evType=verificationStatus==='suspended'?'campaign_suspended':'verification_updated';
        await sql.query(
          `INSERT INTO fundraising_moderation_events(id,tenant_id,org_id,campaign_id,event_type,reason,actor_id)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [id('fmod'),actor.tenantId,org,cId,evType,reason,actor.userId]
        );
        return {campaignId:cId,verificationStatus,synthetic:true};
      }
      case 'reconcile': {
        const payment=await required(sql,'finance_payments',actor,org,input.paymentId);
        return {id:payment.id,status:payment.status,posted:Boolean(payment.journal_id),synthetic:true,message:payment.status==='unknown'||payment.status==='pending'?'Awaiting a trusted simulated provider result; no automatic success assumed.':'Terminal simulated provider result is recorded.'};
      }
      default: throw new Error('Unsupported financial action');
    }};
    const result=await run();
    await audit(sql,actor,org,action,input,result);
    return result;
  });
}

export type NewSavingsGroup={model:'ACCUMULATING'|'ROTATING';name:string;description:string;location:string;contact:string;administratorLabel?:string;expectedMembers:number;contributionAmount:number;frequency:'weekly'|'monthly';startDate:string;endDate:string;shareOutDate:string;rotationOrder:string[];reserveBps:number;accepted:boolean};
export async function createSavingsGroup(db:Database,actor:Actor,input:NewSavingsGroup){
 const administratorLabel=input.administratorLabel===undefined?'':input.administratorLabel;
 if(typeof administratorLabel!=='string'||administratorLabel.length>120)throw new Error('Administrator label must be text of at most 120 characters');
 if(!input.accepted) throw new Error('Group rules must be accepted');
 if(input.model==='ROTATING'&&(input.rotationOrder.length!==input.expectedMembers||new Set(input.rotationOrder.map(x=>x.trim().toLowerCase())).size!==input.expectedMembers)) throw new Error('The agreed rotation order must list every expected member exactly once.');
 const org=`group-${randomUUID()}`;
  const inviteCode=randomUUID().replaceAll('-','').slice(0,24).toUpperCase();
 return db.transaction(async sql=>{
  const tenant=(await sql.query('SELECT id FROM demo_tenants WHERE id=$1 FOR SHARE',[actor.tenantId])).rows[0];
  if(!tenant) throw new Error('Demo tenant not found');
  await sql.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count,savings_model,loan_limit_bps,reserve_bps) VALUES($1,$2,$3,'group',$4,1,$5,$6,$7)",[actor.tenantId,org,input.name,input.location,input.model,input.model==='ROTATING'?0:5000,input.reserveBps]);
  const endDate=input.model==='ROTATING'?(()=>{const d=new Date(`${input.shareOutDate}T00:00:00Z`);if(input.frequency==='weekly')d.setUTCDate(d.getUTCDate()+7*(input.expectedMembers-1));else d.setUTCMonth(d.getUTCMonth()+input.expectedMembers-1);return d.toISOString().slice(0,10)})():input.endDate;
  if(input.startDate>=endDate||input.shareOutDate<input.startDate||input.model==='ACCUMULATING'&&input.shareOutDate<input.endDate) throw new Error('Cycle dates must follow the start date and share-out must follow the savings cycle');
  await sql.query(`INSERT INTO savings_group_policies(tenant_id,org_id,description,location,contact,expected_members,contribution_amount,contribution_frequency,cycle_start,cycle_end,share_out_date,rotation_order,minimum_reserve_bps,emergency_lending,accepted_by,administrator_label)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,false,$14,$15)`,[actor.tenantId,org,input.description,input.location,input.contact,input.expectedMembers,input.contributionAmount,input.frequency,input.startDate,endDate,input.shareOutDate,JSON.stringify(input.rotationOrder),input.reserveBps,actor.userId,administratorLabel]);
  const cycle=`cycle-${randomUUID()}`;
  await sql.query("INSERT INTO savings_cycles(id,tenant_id,org_id,start_date,end_date) VALUES($1,$2,$3,$4,$5)",[cycle,actor.tenantId,org,input.startDate,endDate]);
  await sql.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'president')",[actor.tenantId,actor.userId,org]);
  const priorUser = await one(sql, 'SELECT role FROM app_users WHERE id=$1', [actor.userId]);
  const priorRole = (priorUser?.role as string) ?? 'member';
  await sql.query("UPDATE app_users SET role='president' WHERE id=$1", [actor.userId]);
  const hasWorkspaceCol=(await sql.query("SELECT 1 FROM information_schema.columns WHERE table_name='account_profiles' AND column_name='workspace'")).rows.length>0;
  if(hasWorkspaceCol){
    await sql.query("UPDATE account_profiles SET workspace='groups' WHERE user_id=$1 AND tenant_id=$2", [actor.userId, actor.tenantId]);
  }
  const hasHistoryTable=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_group_role_history'")).rows.length>0;
  if(hasHistoryTable){
    await sql.query("INSERT INTO savings_group_role_history(id,tenant_id,org_id,user_id,old_role,new_role,assigned_by) VALUES($1,$2,$3,$4,$5,'president',$6)", [id('role-hist'), actor.tenantId, org, actor.userId, priorRole, actor.userId]);
  }
  await sql.query('INSERT INTO savings_group_invites(invite_code,tenant_id,org_id,created_by) VALUES($1,$2,$3,$4)',[inviteCode,actor.tenantId,org,actor.userId]);
  const hasCatTable=(await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_group_expense_categories'")).rows.length>0;
  if(hasCatTable){
    for(const [cName, cDesc] of [
      ['Office & Administration', 'Stationery, record books, administrative supplies'],
      ['Meeting Refreshments', 'Tea, water and refreshments for member assemblies'],
      ['Bank & MoMo Fees', 'Transaction fees and mobile money charges'],
      ['Emergency Support', 'Community solidarity and social fund disbursements'],
      ['Transport & Logistics', 'Travel and transport for group activities'],
      ['Other Operating Expenses', 'Miscellaneous operational expenses']
    ]) {
      await sql.query("INSERT INTO savings_group_expense_categories(id,tenant_id,org_id,name,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,org_id,name) DO NOTHING", [id('cat'), actor.tenantId, org, cName, cDesc]);
    }
  }
  return {orgId:org,inviteCode,model:input.model};
 });
}
export async function joinSavingsGroup(db:Database,actor:Actor,inviteCode:string){
 return db.transaction(async sql=>{
  const invite=await one(sql,'SELECT tenant_id,org_id FROM savings_group_invites WHERE invite_code=$1 FOR SHARE',[inviteCode]);
  if(!invite||invite.tenant_id!==actor.tenantId) throw new Error('Invitation is invalid or belongs to another demo account.');
  const exists=await one(sql,'SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3 FOR UPDATE',[actor.tenantId,actor.userId,invite.org_id]);
  if(exists) return {orgId:String(invite.org_id),duplicate:true};
  const org=await orgRow(sql,actor.tenantId,String(invite.org_id));
  if(org.kind!=='group') throw new Error('Invitation does not point to a savings group');
  const count=await one(sql,'SELECT COUNT(*)::int AS n FROM memberships WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,invite.org_id]);
  const policy=await one(sql,'SELECT expected_members FROM savings_group_policies WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,invite.org_id]);
  if(num(count?.n)>=num(policy?.expected_members)) throw new Error('This group has reached its expected membership limit.');
  await sql.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'member')",[actor.tenantId,actor.userId,invite.org_id]);
  await sql.query('UPDATE finance_orgs SET member_count=member_count+1 WHERE tenant_id=$1 AND org_id=$2',[actor.tenantId,invite.org_id]);
  return {orgId:String(invite.org_id),duplicate:false};
 });
}

export type NewCooperative = {
  name: string;
  category: 'agriculture'|'processing'|'service'|'commercial'|'multipurpose';
  district: string;
  sector: string;
  description: string;
  contact: string;
  registrationNumber?: string;
  nominalShareValue: number;
  minSharesPerMember: number;
  statutoryReserveBps: number;
  socialFundBps: number;
  dividendPoolBps: number;
  bonusPoolBps: number;
};

export async function createCooperative(db: Database, actor: Actor, input: NewCooperative) {
  const org = `coop-${randomUUID()}`;
  return db.transaction(async sql => {
    const tenant = (await sql.query('SELECT id FROM demo_tenants WHERE id=$1 FOR SHARE', [actor.tenantId])).rows[0];
    if (!tenant) throw new Error('Demo tenant not found');

    // 1. Insert into finance_orgs
    await sql.query(
      "INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count,reserve_bps,loan_limit_bps) VALUES($1,$2,$3,'cooperative',$4,1,$5,0)",
      [actor.tenantId, org, input.name, input.district, input.statutoryReserveBps]
    );

    // 2. Insert into cooperative_profiles
    const hasCoopProfiles = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cooperative_profiles'")).rows.length > 0;
    if (hasCoopProfiles) {
      await sql.query(
        `INSERT INTO cooperative_profiles(tenant_id,org_id,category,sector,registration_number,nominal_share_value,min_shares_per_member,statutory_reserve_bps,social_fund_bps,dividend_pool_bps,bonus_pool_bps)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [actor.tenantId, org, input.category, input.sector, input.registrationNumber || null, input.nominalShareValue, input.minSharesPerMember, input.statutoryReserveBps, input.socialFundBps, input.dividendPoolBps, input.bonusPoolBps]
      );
    }

    // 3. Add creator membership as 'cooperative'
    await sql.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'cooperative') ON CONFLICT (tenant_id,user_id,org_id) DO UPDATE SET role='cooperative'", [actor.tenantId, actor.userId, org]);

    // 4. Update user role and workspace
    await sql.query("UPDATE app_users SET role='cooperative' WHERE id=$1", [actor.userId]);
    const hasWorkspaceCol = (await sql.query("SELECT 1 FROM information_schema.columns WHERE table_name='account_profiles' AND column_name='workspace'")).rows.length > 0;
    if (hasWorkspaceCol) {
      await sql.query("UPDATE account_profiles SET workspace='cooperative' WHERE user_id=$1 AND tenant_id=$2", [actor.userId, actor.tenantId]);
    }

    // 5. Appoint creator as Chairperson
    const hasStaffTable = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cooperative_staff_appointments'")).rows.length > 0;
    if (hasStaffTable) {
      await sql.query(
        "INSERT INTO cooperative_staff_appointments(id,tenant_id,org_id,user_id,title,department,appointed_at,status) VALUES($1,$2,$3,$4,'Chairperson / President','Executive Board',CURRENT_DATE,'active')",
        [id('staff'), actor.tenantId, org, actor.userId]
      );
    }

    // 6. Seed creator share account with minimum required shares
    const hasShareAccounts = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cooperative_share_accounts'")).rows.length > 0;
    if (hasShareAccounts) {
      const minShares = input.minSharesPerMember;
      const subAmount = BigInt(minShares) * BigInt(input.nominalShareValue);
      await sql.query(
        "INSERT INTO cooperative_share_accounts(id,tenant_id,org_id,user_id,shares_subscribed,shares_paid,amount_subscribed,amount_paid,amount_outstanding,status) VALUES($1,$2,$3,$4,$5,0,$6,0,$6,'active')",
        [id('share-acc'), actor.tenantId, org, actor.userId, minShares, num(subAmount)]
      );
    }

    return { orgId: org, name: input.name, category: input.category };
  });
}

export async function joinCooperative(db: Database, actor: Actor, orgId: string) {
  return db.transaction(async sql => {
    const org = await orgRow(sql, actor.tenantId, orgId);
    if (org.kind !== 'cooperative') throw new Error('Organization is not a cooperative');
    const existing = await one(sql, 'SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND org_id=$3', [actor.tenantId, actor.userId, orgId]);
    if (existing) return { orgId, duplicate: true };

    await sql.query("INSERT INTO memberships(tenant_id,user_id,org_id,role) VALUES($1,$2,$3,'member')", [actor.tenantId, actor.userId, orgId]);
    await sql.query('UPDATE finance_orgs SET member_count=member_count+1 WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, orgId]);

    const profile = await one(sql, 'SELECT nominal_share_value,min_shares_per_member FROM cooperative_profiles WHERE tenant_id=$1 AND org_id=$2', [actor.tenantId, orgId]);
    const nominal = num(profile?.nominal_share_value ?? 10000);
    const minShares = num(profile?.min_shares_per_member ?? 5);
    const subAmount = num(BigInt(minShares) * BigInt(nominal));

    const hasShareAccounts = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cooperative_share_accounts'")).rows.length > 0;
    if (hasShareAccounts) {
      await sql.query(
        "INSERT INTO cooperative_share_accounts(id,tenant_id,org_id,user_id,shares_subscribed,shares_paid,amount_subscribed,amount_paid,amount_outstanding,status) VALUES($1,$2,$3,$4,$5,0,$6,0,$6,'active') ON CONFLICT (tenant_id,org_id,user_id) DO NOTHING",
        [id('share-acc'), actor.tenantId, orgId, actor.userId, minShares, subAmount]
      );
    }

    return { orgId, duplicate: false };
  });
}

export async function seedFinance(db: Database, tenantId: string): Promise<void> {
  await db.transaction(async sql=>{
    await sql.query('SELECT id FROM demo_tenants WHERE id=$1 FOR UPDATE',[tenantId]);
    const existing=await one(sql,'SELECT 1 FROM finance_orgs WHERE tenant_id=$1 LIMIT 1',[tenantId]);
    if(existing) return;
    for(const org of [
      [GROUP,'Ubumwe Savings Group','group','Gasabo',24],
      ['group-hope','Hope Savings Group','group','Kicukiro',18],
      [FUND,'School Futures Fund','fund','Gasabo',24],
      [COOP,'Imena Cooperative','cooperative','Rulindo',38],
    ]) await sql.query("INSERT INTO finance_orgs(tenant_id,org_id,name,kind,district,member_count,savings_model) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4='group' THEN 'ACCUMULATING' ELSE NULL END)",[tenantId,...org]);
    for(const groupId of [GROUP,'group-hope']){
      const cycle=`${tenantId}-${groupId}-cycle`;
      await sql.query("INSERT INTO savings_group_policies(tenant_id,org_id,expected_members,contribution_amount,cycle_start,cycle_end,accepted_by) VALUES($1,$2,5,10000,CURRENT_DATE,(CURRENT_DATE+interval '1 year')::date,'system-seed')",[tenantId,groupId]);
      await sql.query("INSERT INTO savings_cycles(id,tenant_id,org_id,start_date,end_date) VALUES($1,$2,$3,CURRENT_DATE,(CURRENT_DATE+interval '1 year')::date)",[cycle,tenantId,groupId]);
    }
    await journal(sql,tenantId,GROUP,'Opening group capital','seed-opening',[{account:'cash',debit:4350000},{account:'capital',credit:4350000}]);
    const member: Actor={tenantId,userId:'member',role:'member'};
    await createPayment(sql,member,GROUP,'contribution',400000,'success','seed-member-savings');
    const president: Actor={tenantId,userId:'president',role:'president'};
    await createPayment(sql,president,GROUP,'contribution',400000,'success','seed-president-savings');
    await sql.query("INSERT INTO finance_loans(id,tenant_id,org_id,user_id,amount,months,status,approved_by,created_at) VALUES($1,$2,$3,'president',150000,6,'disbursing','synthetic-seed',now()-interval '1 month')",[`${tenantId}-seed-loan`,tenantId,GROUP]);
    await createPayment(sql,president,GROUP,'loan',150000,'success','seed-loan-disbursement',{loanId:`${tenantId}-seed-loan`});
    await journal(sql,tenantId,'group-hope','Opening group capital and member savings','seed-opening',[{account:'cash',debit:2400000},{account:'savings',credit:1200000,user:'synthetic-members'},{account:'capital',credit:1200000}]);
    await journal(sql,tenantId,COOP,'Opening cooperative assets and capital','seed-opening',[{account:'cash',debit:3200000},{account:'equipment',debit:1800000},{account:'capital',credit:5000000}]);
    await journal(sql,tenantId,COOP,'Processing service revenue','seed-revenue',[{account:'cash',debit:450000},{account:'revenue',credit:450000}]);
    await journal(sql,tenantId,COOP,'Operating inputs','seed-expense',[{account:'expenses',debit:120000},{account:'cash',credit:120000}]);
    const campaignId=`${tenantId}-school-campaign`;
    await sql.query("INSERT INTO finance_campaigns(id,tenant_id,org_id,title,category,description,target) VALUES($1,$2,$3,'SIMULATED · School materials','Education','Fictional pooled donations for learning materials. No real funds are collected.',2000000)",[campaignId,tenantId,FUND]);
    await createPayment(sql,member,FUND,'donation',850000,'success','seed-school-donation',{campaignId});
    await seedFundraisingDemoCampaigns(sql,tenantId,FUND,campaignId,async (uId,uRole,cId,amt,ref)=>{const r=await createPayment(sql,{tenantId,userId:uId,role:uRole},FUND,'donation',amt,'success',ref,{campaignId:cId});return {id:String(r.id)};});
    await sql.query("INSERT INTO finance_proposals(id,tenant_id,org_id,title,amount,created_by) VALUES($1,$2,$3,'SIMULATED · Expand processing equipment',600000,'cooperative')",[`${tenantId}-coop-proposal`,tenantId,COOP]);
    const hasExpenseTables = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_group_expenses'")).rows.length > 0;
    if(hasExpenseTables) {
      for(const groupId of [GROUP,'group-hope']){
        for(const [cName, cDesc] of [
          ['Office & Administration', 'Stationery, record books, administrative supplies'],
          ['Meeting Refreshments', 'Tea, water and refreshments for member assemblies'],
          ['Bank & MoMo Fees', 'Transaction fees and mobile money charges'],
          ['Emergency Support', 'Community solidarity and social fund disbursements'],
          ['Transport & Logistics', 'Travel and transport for group activities'],
          ['Other Operating Expenses', 'Miscellaneous operational expenses']
        ]) {
          await sql.query("INSERT INTO savings_group_expense_categories(id,tenant_id,org_id,name,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,org_id,name) DO NOTHING", [`${tenantId}-${groupId}-${cName.toLowerCase().replace(/[^a-z0-9]/g,'-')}`, tenantId, groupId, cName, cDesc]);
        }
      }
      await sql.query("INSERT INTO savings_group_role_history(id,tenant_id,org_id,user_id,old_role,new_role,assigned_by) VALUES($1,$2,$3,'president','member','president','president') ON CONFLICT DO NOTHING",[`${tenantId}-seed-hist-1`,tenantId,GROUP]);
      await sql.query("INSERT INTO savings_group_expenses(id,tenant_id,org_id,category,title,description,amount,receipt_attachment,status,recorded_by) VALUES($1,$2,$3,'Office & Administration','Group registers & passbooks','25 printed passbooks and hard-cover register',25000,'receipt-stationery-01.pdf','recorded','president') ON CONFLICT DO NOTHING",[`${tenantId}-seed-exp-1`,tenantId,GROUP]);
    }
    const hasCoopProfiles = (await sql.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cooperative_profiles'")).rows.length > 0;
    if(hasCoopProfiles) {
      await sql.query(
        `INSERT INTO cooperative_profiles(tenant_id,org_id,category,sector,registration_number,nominal_share_value,min_shares_per_member,max_shares_per_member,statutory_reserve_bps,social_fund_bps,dividend_pool_bps,bonus_pool_bps)
         VALUES($1,$2,'agriculture','Buyoga','RCA/0428/2021',10000,5,1000,2000,1000,4000,6000)
         ON CONFLICT (tenant_id,org_id) DO NOTHING`,
        [tenantId, COOP]
      );
      const staffMembers = [
        ['cooperative', 'Chairperson / President', 'Executive Board'],
        ['member', 'Member Relations Officer', 'Administration'],
        ['president', 'Vice Chairperson', 'Executive Board'],
        ['treasurer', 'Treasurer & Cashier', 'Finance & Treasury']
      ];
      for(const [sUser, sTitle, sDept] of staffMembers) {
        await sql.query(
          "INSERT INTO cooperative_staff_appointments(id,tenant_id,org_id,user_id,title,department,appointed_at,status) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'active') ON CONFLICT DO NOTHING",
          [`${tenantId}-staff-${sUser}`, tenantId, COOP, sUser, sTitle, sDept]
        );
      }
      const shareHolders = [
        ['cooperative', 50, 50, 500000, 500000, 0],
        ['member', 20, 20, 200000, 200000, 0],
        ['president', 30, 25, 300000, 250000, 50000]
      ];
      for(const [uId, subS, paidS, subA, paidA, outA] of shareHolders) {
        await sql.query(
          "INSERT INTO cooperative_share_accounts(id,tenant_id,org_id,user_id,shares_subscribed,shares_paid,amount_subscribed,amount_paid,amount_outstanding,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'active') ON CONFLICT (tenant_id,org_id,user_id) DO NOTHING",
          [`${tenantId}-share-${uId}`, tenantId, COOP, uId, subS, paidS, subA, paidA, outA]
        );
      }
      await sql.query(
        `INSERT INTO cooperative_deliveries(id,tenant_id,org_id,user_id,product_name,category,quantity,unit,grade,unit_price,total_value,payment_status,payment_reference,delivery_date,notes)
         VALUES($1,$2,$3,'member','Maize (Ibigori)','grain',1200,'kg','Grade A',450,540000,'paid','momo-deliv-01',CURRENT_DATE-interval '14 days','Clean dry grain delivery')
         ON CONFLICT DO NOTHING`,
        [`${tenantId}-deliv-1`, tenantId, COOP]
      );
      await sql.query(
        `INSERT INTO cooperative_deliveries(id,tenant_id,org_id,user_id,product_name,category,quantity,unit,grade,unit_price,total_value,payment_status,payment_reference,delivery_date,notes)
         VALUES($1,$2,$3,'member','Irish Potatoes (Ibirayi)','horticulture',800,'kg','Grade A',350,280000,'pending',null,CURRENT_DATE-interval '2 days','Kinigi variety harvest')
         ON CONFLICT DO NOTHING`,
        [`${tenantId}-deliv-2`, tenantId, COOP]
      );
      await sql.query(
        `INSERT INTO cooperative_sales(id,tenant_id,org_id,buyer_name,product_name,quantity,unit,unit_price,total_amount,payment_status,payment_reference,sale_date)
         VALUES($1,$2,$3,'Rwanda Grains Processing Ltd','Maize Grade A',8000,'kg',550,4400000,'paid','sale-rgp-01',CURRENT_DATE-interval '10 days')
         ON CONFLICT DO NOTHING`,
        [`${tenantId}-sale-1`, tenantId, COOP]
      );
      await sql.query(
        `INSERT INTO cooperative_investments(id,tenant_id,org_id,title,category,capital_cost,monthly_operating_cost,expected_monthly_benefit,useful_life_months,financing_source,status,guardian_verdict,payback_months,created_by)
         VALUES($1,$2,$3,'Commercial Grain Dryer & Solar Storage Facility','processing',3000000,50000,300000,60,'cash_reserve','simulated','sustainable',12,'cooperative')
         ON CONFLICT DO NOTHING`,
        [`${tenantId}-inv-1`, tenantId, COOP]
      );
      await sql.query(
        `INSERT INTO cooperative_governance_events(id,tenant_id,org_id,event_type,title,meeting_date,agenda,resolutions,recorded_by)
         VALUES($1,$2,$3,'general_assembly','Annual General Assembly 2026',CURRENT_DATE-interval '30 days','Review of financial statements, approval of 20% statutory reserve allocation, and Member Value distributions.','General Assembly unanimously passed Resolution GA-RES-2026-01 approving the Member Value distribution pool.','cooperative')
         ON CONFLICT DO NOTHING`,
        [`${tenantId}-gov-1`, tenantId, COOP]
      );
      const allocId = `${tenantId}-alloc-1`;
      await sql.query(
        `INSERT INTO cooperative_surplus_allocations(id,tenant_id,org_id,period_label,gross_revenue,total_expenses,net_surplus,statutory_reserve_amount,social_fund_amount,distributable_surplus,dividend_pool,bonus_pool,status,resolution_ref,approved_by,approved_at)
         VALUES($1,$2,$3,'2025/2026 Agricultural Season',5000000,3000000,2000000,400000,200000,1400000,1000000,400000,'approved_by_assembly','GA-RES-2026-01','cooperative',now())
         ON CONFLICT DO NOTHING`,
        [allocId, tenantId, COOP]
      );
      await sql.query(
        `INSERT INTO cooperative_member_distributions(id,tenant_id,org_id,allocation_id,user_id,shares_held,share_ratio_bps,dividend_amount,participation_units,participation_ratio_bps,bonus_amount,total_entitlement,payout_status)
         VALUES($1,$2,$3,$4,'member',20,2000,200000,1200,2500,100000,300000,'entitled')
         ON CONFLICT DO NOTHING`,
        [`${tenantId}-dist-member`, tenantId, COOP, allocId]
      );
    }
  });
}
