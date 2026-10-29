# Financial model and simulation assumptions

## Money and ownership

Amounts are positive safe integer RWF for posted operations. BigInt intermediate arithmetic protects percentage, balance, and schedule math. Member savings are organizational liabilities/entitlements, not automatically withdrawable cash. Donations, cooperative capital, revenue, expenses, cash and loan receivables use distinct accounts.

Each immutable journal belongs to one tenant and organization. Debit equals credit is validated both by posting services and deferred PostgreSQL constraints. Lines cannot be edited/deleted or appended to a committed journal. Corrections post equal opposite entries, link to the original, and preserve it. Reversals validate commitments and negative assets. Audit records form a SHA-256 chain with sequence, predecessor hash, actor/action/details/timestamp; privileged database administration remains a trust boundary.

| Operation | Debit | Credit |
|---|---|---|
| Confirmed contribution | Cash | Member savings entitlement |
| Confirmed loan disbursement | Loan principal receivable, member | Cash |
| Confirmed repayment | Cash | Loan principal receivable, member |
| Confirmed donation | Cash | Donations |
| Confirmed fundraising expense | Expense | Cash |
| Cooperative capital received | Cash | Share capital |
| Cooperative revenue | Cash | Revenue |
| Cooperative expense | Expense | Cash |

The prototype uses zero interest and no fees. It does not infer affordability from the savings cap.

## Lending and provider states

Group default loan cap = floor(eligible member savings × 5,000 / 10,000). Reserve = ceiling(current group cash × reserve basis points / 10,000). Capacity = max(0, cash − reserve − pending/unknown disbursement holds). Percentages are configurable demonstration policies, not legal requirements.

A loan request validates membership, savings cap including existing principal and pending disbursements, reserve and cash. President approval must be independent and repeats validation under an organization row lock. Approval creates a pending simulated provider payment and cash hold; it does not post a disbursement.

Provider outcomes: pending, unknown, success, failed. Only success posts a balanced journal and activates the loan. Terminal outcomes cannot be changed. Repeated reference with identical economic intent returns the same operation; changed economic intent is rejected. Repeated confirmations cannot double-post. Unknown/pending outcomes retain holds; failed disbursements release them. Reconciliation reports known status and never infers success.

Repayment is borrower-authorized, cannot exceed remaining principal less pending repayments, and posts only on success. Schedule installments conserve principal exactly. No compounding, penalty, maturity/default prediction, or automated collection is claimed.

## Scenarios

`calculateScenario` computes reserve from **starting cash**, so comparisons keep a fixed reserve basis within the scenario. The operational ledger recalculates policy reserve from current cash after confirmed transactions. These are different observation points; neither simulation writes to the ledger.

Expected inflows = contributions + floor(expected repayments × (10,000 − delayed basis points)/10,000). Ending cash = starting cash + expected inflows − applicants×loan amount − investment. Shortfall = max(0, reserve−ending cash). Lending capacity = max(0, ending cash−reserve). Status is critical below reserve, warning when remaining capacity is below one quarter of reserve, healthy otherwise. Status is a policy scenario label, not a validated risk prediction.

Expected inflows are assumptions. No causal poverty reduction, market returns, validated default probability, or investment execution is implied. Personal planning computes ceiling(remaining target / chosen periods), based only on entered/recorded savings and without inferring income.
