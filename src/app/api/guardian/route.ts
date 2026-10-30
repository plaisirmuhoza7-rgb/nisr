import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAccount } from '@/server/auth';
import { getDb } from '@/server/db';
import { apiError, checkMutation } from '@/server/http';
import { DomainError } from '@/server/permissions';
import { buildMemberGuardianContext, buildOfficerGuardianContext } from '@/server/guardian/context';
import { evaluateAffordability } from '@/lib/guardian/affordability';
import { evaluateMissedPayment } from '@/lib/guardian/missed-payment';
import { compareSavingsPlans } from '@/lib/guardian/plan-compare';
import { evaluatePayoutFit } from '@/lib/guardian/payout-fit';
import { evaluateCycleHealth } from '@/lib/guardian/cycle-health';
import { explainGuardianResult } from '@/server/guardian/explain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const n = z.number().int().min(0).max(1_000_000_000_000);

const questionSchema = z.discriminatedUnion('question', [
  z.object({
    question: z.literal('contribution_affordability'),
    proposedContribution: z.number().int().min(1).max(1_000_000_000_000),
    householdBuffer: n.default(0),
    goalId: z.string().optional(),
    lang: z.enum(['en', 'rw']).default('en')
  }),
  z.object({
    question: z.literal('missed_payment'),
    obligationId: z.string().min(1),
    lang: z.enum(['en', 'rw']).default('en')
  }),
  z.object({
    question: z.literal('plan_compare'),
    target: z.number().int().min(1).max(1_000_000_000_000),
    saved: n.default(0),
    goalName: z.string().max(100).optional(),
    periodsList: z.array(z.number().int().min(1).max(120)).max(6).optional(),
    discretionaryPerPeriod: n.optional(),
    lang: z.enum(['en', 'rw']).default('en')
  }),
  z.object({
    question: z.literal('payout_fit'),
    orgId: z.string().min(1),
    proposedPayoutAmount: z.number().int().min(1).max(1_000_000_000_000),
    recipientName: z.string().min(1).max(100),
    lang: z.enum(['en', 'rw']).default('en')
  }),
  z.object({
    question: z.literal('cycle_health'),
    orgId: z.string().min(1),
    repaymentDelayBps: z.number().int().min(0).max(10000).optional(),
    plannedLoanRequests: z.number().int().min(0).max(1000).optional(),
    plannedLoanAmount: n.optional(),
    plannedExpenditure: n.optional(),
    lang: z.enum(['en', 'rw']).default('en')
  })
]);

export async function GET(request: Request) {
  try {
    const user = await requireAccount();
    const actor = { tenantId: user.tenantId, userId: user.id, role: user.role };
    const db = await getDb();

    const memberContext = await buildMemberGuardianContext(db, actor);

    const isOfficer = ['president', 'treasurer', 'accountant', 'secretary', 'cooperative'].includes(user.role) ||
      user.memberships.some(m => ['president', 'treasurer', 'accountant', 'secretary'].includes(m.role));

    const url = new URL(request.url);
    const requestedOrg = url.searchParams.get('orgId') || user.memberships.find(m => m.orgId.startsWith('group-') || m.orgId.startsWith('coop-'))?.orgId;

    let officerContext = null;
    if (isOfficer && requestedOrg) {
      try {
        officerContext = await buildOfficerGuardianContext(db, actor, requestedOrg);
      } catch (err) {
        // If actor has no access to this specific org, leave officerContext null
        officerContext = null;
      }
    }

    return NextResponse.json(
      {
        memberContext,
        officerContext,
        isOfficer,
        user: { id: user.id, role: user.role, name: user.name }
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    checkMutation(request);
    const user = await requireAccount();
    const actor = { tenantId: user.tenantId, userId: user.id, role: user.role };
    const db = await getDb();

    const body = questionSchema.parse(await request.json());
    const lang = body.lang || 'en';

    let rawResult;

    switch (body.question) {
      case 'contribution_affordability': {
        const ctx = await buildMemberGuardianContext(db, actor);
        let goalImpact: { name: string; target: number; saved: number; deadlineMonths: number } | undefined;
        if (body.goalId) {
          const matched = ctx.goals.find(g => g.id === body.goalId);
          if (matched) {
            goalImpact = {
              name: matched.name,
              target: matched.target,
              saved: matched.saved,
              deadlineMonths: 6
            };
          }
        }
        rawResult = evaluateAffordability({
          walletCash: ctx.totalWalletBalance,
          upcomingObligations: ctx.totalUpcomingObligations,
          activeDebtDue: ctx.totalDebtOwed,
          householdBuffer: body.householdBuffer,
          proposedContribution: body.proposedContribution,
          goalImpact
        });
        break;
      }

      case 'missed_payment': {
        const ctx = await buildMemberGuardianContext(db, actor);
        const obligation = ctx.obligations.find(o => o.id === body.obligationId);
        if (!obligation) {
          throw new DomainError('Obligation not found for this account.', 404);
        }
        rawResult = evaluateMissedPayment({
          obligationAmount: obligation.amountDue - obligation.amountConfirmed,
          dueDate: obligation.dueDate,
          groupName: obligation.groupName,
          groupModel: obligation.orgId.startsWith('group-') ? 'ROTATING' : 'ACCUMULATING',
          latePenalty: obligation.latePenalty,
          missedPolicy: obligation.missedPolicy,
          hasExplicitLatePenalty: obligation.latePenalty > 0
        });
        break;
      }

      case 'plan_compare': {
        const ctx = await buildMemberGuardianContext(db, actor);
        // Estimate discretionary surplus from wallet cash minus debts
        const calculatedDiscretionary = body.discretionaryPerPeriod !== undefined
          ? body.discretionaryPerPeriod
          : Math.max(0, ctx.totalWalletBalance - ctx.totalUpcomingObligations - ctx.totalDebtOwed);

        rawResult = compareSavingsPlans({
          target: body.target,
          saved: body.saved,
          goalName: body.goalName,
          periodsList: body.periodsList,
          discretionaryPerPeriod: calculatedDiscretionary
        });
        break;
      }

      case 'payout_fit': {
        const ctx = await buildOfficerGuardianContext(db, actor, body.orgId);
        rawResult = evaluatePayoutFit({
          groupModel: ctx.model,
          groupName: ctx.groupName,
          currentCash: ctx.cash,
          reserveBps: ctx.reserveBps,
          proposedPayoutAmount: body.proposedPayoutAmount,
          recipientName: body.recipientName,
          confirmedObligationsPool: ctx.confirmedInflows,
          hasOutstandingLoans: ctx.outstandingLoans > 0
        });
        break;
      }

      case 'cycle_health': {
        const ctx = await buildOfficerGuardianContext(db, actor, body.orgId);
        rawResult = evaluateCycleHealth({
          groupName: ctx.groupName,
          cash: ctx.cash,
          reserveBps: ctx.reserveBps,
          confirmedContributions: ctx.confirmedInflows,
          confirmedRepayments: 0,
          outstandingLoans: ctx.outstandingLoans,
          repaymentDelayBps: body.repaymentDelayBps,
          plannedLoanRequests: body.plannedLoanRequests,
          plannedLoanAmount: body.plannedLoanAmount,
          plannedExpenditure: body.plannedExpenditure
        });
        break;
      }
    }

    const explained = await explainGuardianResult(rawResult, lang);
    return NextResponse.json(explained, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
