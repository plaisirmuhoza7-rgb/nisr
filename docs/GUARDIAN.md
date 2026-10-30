# HURIZA Guardian AI — Architecture & Decision Support Guide

## Overview

Guardian AI is HURIZA’s **decision-support guide**, designed to help savings group members and community officers understand financial choices before committing funds.

Unlike free-form chatbots that emit ungrounded financial advice or hallucinatory numbers, Guardian AI is built on three core engineering principles:

1. **Permissioned Scoping**: Guardian operates strictly within the actor’s authenticated context. An individual member accesses only their own confirmed wallet balances, goals, and obligations. Group officers access aggregated reserves, round pools, and policies for their authorized organizations. It fails closed on unauthorized access (HTTP 403) or missing sessions (HTTP 401).
2. **Deterministic Calculation Before Explanation**: All math is performed by pure TypeScript modules using safe integer RWF and BigInt intermediate arithmetic. Numbers are never computed by an LLM. An AI model or template engine only translates the pre-computed mathematical result into plain English or Kinyarwanda.
3. **Transparent Provenance & Safety Validation**: Every figure displayed to the user is labeled with its provenance:
   - `confirmed`: Verified records from posted ledger balances, recorded obligations, or bylaw policies.
   - `estimate`: Calculated outcomes or user-reported buffers (such as household living costs).
   - `assumption`: What-if parameter inputs submitted for evaluation.
   - `missing`: Required data that is not yet recorded in group policy or profile settings.
4. **Actionable Next Steps (Never Moves Money)**: Guardian is purely read-only. It has no write permissions, imports no financial posting services, and cannot disburse funds or approve loans. Guidance points users to standard authorized HURIZA workflows (such as `/app/groups` or `/app/personal`).

---

## Decision Modules

| Module | Audience | Core Question | Math & Governance Rules |
| :--- | :--- | :--- | :--- |
| **Affordability** | Member | *Can I afford this contribution?* | Checks liquid wallet balance − scheduled group obligations − active debt repayments − living buffer. Distinguishes comfortable cushion (`ok`), dipping into living buffer (`caution`), and net deficit (`not_advised`). |
| **Missed Payment** | Member | *What does a missed payment change?* | Evaluates group policy late penalty and round delay policies. If policy omits penalties, reports `insufficient_information` honestly instead of guessing. |
| **Savings Plan Compare** | Member | *Which savings plan fits my goal?* | Side-by-side comparison of 3, 6, and 12-month savings trajectories using ceiling integer RWF rounding. Highlights affordability relative to disposable surplus. |
| **Payout Fit** | Officer | *Does this proposed payout fit group rules?* | Enforces reserve limits and confirmed collections. In rotating groups (Ikimina), payout cannot exceed confirmed member round collections. In accumulating groups (Itsinda), checks that active loans do not block cycle share-outs. |
| **Cycle Health** | Officer | *What is our group health for the next cycle?* | Uses deterministic scenario modeling (`calculateScenario`) to evaluate delayed repayments, member loan volume, and statutory reserve headroom. |

---

## Safety & Numerical Integrity Validation

When an AI model is configured via `HURIZA_GUARDIAN_AI=true`:
- The explainer is given **only** structured, redacted facts (no PII, names, or unverified records).
- `validateExplanationIntegrity(text, result)` checks the generated text:
  1. **Numerical extraction**: Every number in the generated response must match an existing fact or formula in the deterministic result. Any hallucinated or invented number triggers an immediate safety fallback to the deterministic template.
  2. **Forbidden phrase checks**: Statements claiming loan approval, automated money movement, guaranteed returns, or causal NISR findings are blocked immediately.
  3. **Audit logging**: Every evaluation is logged in the explainer audit trail with validation status and reasoning.

---

## API Contract

### `GET /api/guardian`
Returns the authenticated actor's scoped context overview:
- `memberContext`: Liquid balances, upcoming dues, active goals, and debt obligations.
- `officerContext`: (If authorized officer) Group cash, reserve requirements, lending capacity, and policy.
- `isOfficer`: Boolean indicating officer privilege.

### `POST /api/guardian`
Accepts a discriminated union payload on `question`:
- `contribution_affordability`: `{ proposedContribution: number, householdBuffer: number, goalId?: string, lang?: 'en' | 'rw' }`
- `missed_payment`: `{ obligationId: string, lang?: 'en' | 'rw' }`
- `plan_compare`: `{ target: number, saved: number, periodsList?: number[], lang?: 'en' | 'rw' }`
- `payout_fit`: `{ orgId: string, proposedPayoutAmount: number, recipientName: string, lang?: 'en' | 'rw' }`
- `cycle_health`: `{ orgId: string, repaymentDelayBps?: number, plannedLoanRequests?: number, plannedLoanAmount?: number, lang?: 'en' | 'rw' }`

Returns a standard `GuardianResult`:
```json
{
  "mode": "member",
  "question": "contribution_affordability",
  "verdict": "ok",
  "headline": "Contribution is fully affordable within your current finances.",
  "explanation": "Paying 10,000 RWF leaves 25,000 RWF of discretionary cushion...",
  "facts": [...],
  "formulas": [...],
  "assumptions": [...],
  "tradeoffs": [...],
  "nextSteps": [...],
  "synthetic": true,
  "confidence": "high"
}
```

---

## Verification & Testing

Run the dedicated test suites:
```bash
npx tsx --test tests/guardian-advisor.test.ts
npx tsx --test tests/guardian.test.ts
```
