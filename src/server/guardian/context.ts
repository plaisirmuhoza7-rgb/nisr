import type { Actor } from '@/lib/contracts';
import type { Database } from '@/server/db';
import { assertPermission, DomainError } from '@/server/permissions';
import { financeState } from '@/server/finance/service';
import type { MemberGuardianContext, OfficerGuardianContext } from '@/lib/guardian/types';

function formatDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') return val.slice(0, 10);
  return '';
}

export async function buildMemberGuardianContext(
  db: Database,
  actor: Actor
): Promise<MemberGuardianContext> {
  if (!actor.tenantId || !actor.userId) {
    throw new DomainError('Authentication required to build financial context.', 401);
  }

  // Purely read-only queries scoped to tenant_id and user_id
  const [walletsRes, goalsRes, obligationsRes, loansRes] = await Promise.all([
    db.query(
      `SELECT id, institution, account_name, account_type, balance, currency
       FROM personal_wallets
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY institution, account_name`,
      [actor.tenantId, actor.userId]
    ),
    db.query(
      `SELECT id, name, target, saved, deadline
       FROM goals
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY deadline`,
      [actor.tenantId, actor.userId]
    ),
    db.query(
      `SELECT o.id, o.org_id, o.amount_due, o.amount_confirmed, o.due_date, o.status,
              fo.name as group_name, p.late_penalty, p.missed_policy
       FROM savings_obligations o
       JOIN finance_orgs fo ON fo.tenant_id = o.tenant_id AND fo.org_id = o.org_id
       LEFT JOIN savings_group_policies p ON p.tenant_id = o.tenant_id AND p.org_id = o.org_id
       WHERE o.tenant_id = $1 AND o.user_id = $2 AND o.status IN ('due', 'partial', 'missed')
       ORDER BY o.due_date ASC`,
      [actor.tenantId, actor.userId]
    ),
    db.query(
      `SELECT id, counterparty_name, direction, amount, paid_amount, due_date, status
       FROM personal_loans
       WHERE tenant_id = $1 AND user_id = $2 AND status IN ('active', 'partially_paid')
       ORDER BY due_date ASC`,
      [actor.tenantId, actor.userId]
    )
  ]);

  let totalWalletBalance = 0;
  const wallets = walletsRes.rows.map((row: any) => {
    const bal = Number(row.balance);
    totalWalletBalance += bal;
    return {
      id: row.id,
      institution: row.institution,
      accountName: row.account_name,
      accountType: row.account_type,
      balance: bal,
      currency: row.currency || 'RWF'
    };
  });

  const goals = goalsRes.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    target: Number(row.target),
    saved: Number(row.saved),
    deadline: formatDate(row.deadline)
  }));

  let totalUpcomingObligations = 0;
  const obligations = obligationsRes.rows.map((row: any) => {
    const due = Number(row.amount_due);
    const confirmed = Number(row.amount_confirmed);
    const remaining = Math.max(0, due - confirmed);
    totalUpcomingObligations += remaining;
    return {
      id: row.id,
      orgId: row.org_id,
      groupName: row.group_name || row.org_id,
      amountDue: due,
      amountConfirmed: confirmed,
      dueDate: formatDate(row.due_date),
      status: row.status,
      latePenalty: row.late_penalty ? Number(row.late_penalty) : 0,
      missedPolicy: row.missed_policy || 'flag'
    };
  });

  let totalDebtOwed = 0;
  const personalLoans = loansRes.rows.map((row: any) => {
    const amt = Number(row.amount);
    const paid = Number(row.paid_amount);
    const remaining = Math.max(0, amt - paid);
    if (row.direction === 'i_owe') {
      totalDebtOwed += remaining;
    }
    return {
      id: row.id,
      counterpartyName: row.counterparty_name,
      direction: row.direction as 'i_owe' | 'they_owe',
      remainingAmount: remaining,
      dueDate: row.due_date ? formatDate(row.due_date) : undefined,
      status: row.status
    };
  });

  return {
    userId: actor.userId,
    wallets,
    totalWalletBalance,
    obligations,
    totalUpcomingObligations,
    goals,
    personalLoans,
    totalDebtOwed
  };
}

export async function buildOfficerGuardianContext(
  db: Database,
  actor: Actor,
  orgId: string
): Promise<OfficerGuardianContext> {
  if (!actor.tenantId || !actor.userId) {
    throw new DomainError('Authentication required to build officer context.', 401);
  }

  // Ensure actor has officer reporting permissions in this organization
  await assertPermission(actor, orgId, 'report');

  const [orgRes, policyRes, state, pendingObligationsRes] = await Promise.all([
    db.query(
      `SELECT name, kind, savings_model, reserve_bps, loan_limit_bps, member_count
       FROM finance_orgs
       WHERE tenant_id = $1 AND org_id = $2`,
      [actor.tenantId, orgId]
    ),
    db.query(
      `SELECT late_penalty, missed_policy, contribution_amount, contribution_frequency,
              minimum_reserve_bps, loan_limit_bps, due_day
       FROM savings_group_policies
       WHERE tenant_id = $1 AND org_id = $2`,
      [actor.tenantId, orgId]
    ),
    financeState(db, actor, { orgId }),
    db.query(
      `SELECT COALESCE(SUM(amount_due - amount_confirmed), 0) as pending_total
       FROM savings_obligations
       WHERE tenant_id = $1 AND org_id = $2 AND status IN ('due', 'partial', 'missed')`,
      [actor.tenantId, orgId]
    )
  ]);

  const orgRow: any = orgRes.rows[0];
  if (!orgRow) {
    throw new DomainError('Organization not found in this tenant.', 404);
  }

  const polRow: any = policyRes.rows[0];
  const pendingTotal = Number(pendingObligationsRes.rows[0]?.pending_total || 0);

  return {
    orgId,
    groupName: String(orgRow.name || orgId),
    model: (orgRow.savings_model as 'ACCUMULATING' | 'ROTATING') || 'ACCUMULATING',
    cash: state.treasury.cash,
    reserve: state.treasury.reserve,
    reserveBps: Number(orgRow.reserve_bps ?? 2000),
    lendingCapacity: state.treasury.lendingCapacity,
    outstandingLoans: state.treasury.outstandingLoans,
    confirmedInflows: state.treasury.contributions,
    pendingObligationsTotal: pendingTotal,
    policy: {
      contributionAmount: polRow ? Number(polRow.contribution_amount) : 10000,
      contributionFrequency: String(polRow?.contribution_frequency || 'monthly'),
      latePenalty: polRow ? Number(polRow.late_penalty) : 0,
      missedPolicy: String(polRow?.missed_policy || 'flag'),
      minimumReserveBps: polRow ? Number(polRow.minimum_reserve_bps) : Number(orgRow.reserve_bps ?? 2000),
      loanLimitBps: polRow ? Number(polRow.loan_limit_bps) : Number(orgRow.loan_limit_bps ?? 5000),
      dueDay: polRow ? Number(polRow.due_day) : 1,
      hasExplicitLatePenalty: Boolean(polRow && Number(polRow.late_penalty) > 0)
    },
    memberCount: Number(orgRow.member_count || 0)
  };
}
