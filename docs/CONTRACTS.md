# Implementation contracts — 24 October 2026

## Google Sheets preparation (27 October 2026)

Migration `006-google-sheets-bindings.sql` records a trusted local administrator's association between one tenant organization and one spreadsheet. A spreadsheet cannot be assigned to another organization, and the binding command does not reassign existing bindings. A signed-in group president or treasurer can manually send a scoped simulated aggregate to the dedicated setup tab; the service rechecks the exact tenant, active profile, membership and binding inside the financial snapshot transaction. PostgreSQL remains the app's database. Spreadsheet sharing must be reviewed for each organization. See [GOOGLE_SHEETS.md](GOOGLE_SHEETS.md).

## Google Sheets automatic delivery (27 October 2026)

Migrations 007–011 add a transactional per-organization outbox, an explicit owner-selected destination for personal records, persisted retry metadata, the submitted administrator label, and NGO-only sheet binding. A long-lived Node worker, enabled with `HURIZA_SHEETS_AUTO_SYNC=true`, writes scoped snapshots to a marked `HURIZA data` tab; financial transactions are labeled synthetic. PostgreSQL delivery uses a separate advisory lock, while local PGlite serializes transactions and can delay other operations during a Sheets request. NGO snapshots contain intervention notes only. Spreadsheet access exposes its copied records to its viewers. Firebase and PostgreSQL remain authoritative; delivery requires a running worker. See [GOOGLE_SHEETS.md](GOOGLE_SHEETS.md).

> **Superseded identity and browser contract:** This document records the original demo-auth implementation and is retained for historical financial interfaces only. Its identity schema, role-as-user-ID assumptions, session API, role-switch behavior, reset action, and route/UI access guidance are obsolete. Use [FIREBASE-CONTRACTS.md](FIREBASE-CONTRACTS.md) as the current account, authentication, workspace and server-access contract. Firebase UID is the account ID; roles and memberships are server-owned; public registration creates an empty personal account; role selection and `resetDemo` are not supported.

This file retains historical implementation contracts for the financial service and schema. The current identity/authentication/workspace contract is in [FIREBASE-CONTRACTS.md](FIREBASE-CONTRACTS.md). HURIZA is a Next.js App Router modular monolith with versioned PostgreSQL migrations; PGlite is for single-process local use and `DATABASE_URL` selects external PostgreSQL. No external publication has occurred.

## Ownership
- Root Sol: application configuration, database connection/migrations, identity/session/permissions, API routes, seed orchestration, integration.
- Finance Sol agent: `src/server/finance/**`, `migrations/002-finance.sql`, `tests/finance.test.ts`. No auth/config/UI edits.
- UI Luna: `src/components/**`, `src/app/globals.css`, `src/app/page.tsx`. No API/server/config edits.
- Evidence Luna: `data/**`, `docs/DATA*`, `docs/COMPETITION*`. No implementation edits.

## Database interface
`src/server/db.ts` exports `Sql` { query<T extends Record<string,unknown> = Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>; exec(sql:string):Promise<unknown> } and `Database extends Sql` adds `transaction<T>(fn:(tx:Sql)=>Promise<T>):Promise<T>`. `getDb():Promise<Database>` applies migrations 001-identity.sql, 002-finance.sql, and 003-firebase-accounts.sql. `ensureSeed(db)` in seed.ts initializes fictional finance records for a tenant.

Every financial request uses `Actor {tenantId:string,userId:string,role:Role}` derived from the verified Firebase session and server-managed account profile. User IDs are Firebase UIDs; local emulator fixture UIDs happen to be `member`, `president`, `treasurer`, `cooperative`, and `ngo`. Those fixture accounts share a synthetic tenant for demonstration. Newly registered users receive their own empty personal tenant. Organization IDs include group-ubumwe, group-hope, coop-imena, fund-school, and ngo-imizi. API checks trusted membership for organization records. Personal data belongs to actor.userId. NGO sees authorized aggregates only. Organization relationship does not grant member access.

**Superseded identity schema:** The original `demo_tenants`, `app_users`, `memberships`, `goals`, `interventions` and `notifications` summary below predates migration 003. Current account profiles and Firebase sessions are described in [FIREBASE-CONTRACTS.md](FIREBASE-CONTRACTS.md). Finance tables continue to use tenant and organization scope. NGO sees authorized aggregates only; organization relationships do not grant access to member records.

## Finance exports (finance/service.ts)
`seedFinance(db:Database,tenantId:string):Promise<void>`; `financeState(db:Database,actor:Actor,options?:{personal?:boolean}):Promise<FinanceState>`; `financeAction(db:Database,actor:Actor,input:ActionInput):Promise<unknown>`.
Types in src/lib/contracts.ts are authoritative. Queries return UI camelCase. Monetary values in JSON safe integer RWF.

FinanceState: treasury {cash,reserve,pending,lendingCapacity,outstandingLoans,contributions}; member {eligibleSavings,loanLimit,outstanding}; contributions [{id,member,amount,status,date}]; loans [{id,member,userId,amount,months,status,reasons:string[],schedule:[{dueDate,amount,paid}]}]; ledger [{id,date,description,debit,credit,reference}]; payments [{id,kind,amount,status,reference,loanId?}]; campaigns [{id,title,category,description,target,raised,spent,status}]; cooperative {cash,reserve,shareCapital,revenue,expenses,assets:[{name,value}],proposals:[{id,title,amount,status,votes}]} ; impact {groups,members,savings,loans,reportingCompleteness,organizations:[{id,name,district,members,savings,outstanding,reportingStatus}]} ; alerts [{id,kind,message}]. Return only authorized arrays. Never expose group member records to ngo/cooperative actors. Personal member sees own contributions/loans; president/treasurer sees group.

## Current browser/API notes
The old role-based endpoints and `resetDemo` action are removed. Current auth endpoints, the strict `{idToken}` session exchange, active-workspace query, and authorization behavior are specified in [FIREBASE-CONTRACTS.md](FIREBASE-CONTRACTS.md).

`POST /api/actions` accepts the financial action schema with the actor derived from the Firebase session; same-origin validation and server membership/permission checks apply. Supported financial actions include contribute, requestLoan, approveLoan, confirmPayment, repay, donate, requestExpense, approveExpense, createCampaign, createProposal, vote, recordCoop, configureGroup, reverseEntry, reconcile, createGoal, addGoalSavings and addIntervention. No reset operation is supported. `GET /api/export?type=personal|group|impact` returns an authorized CSV attachment.

The interface refreshes state after mutations and displays errors. Scenario calculations use pure `calculateScenario` from `src/lib/guardian.ts` and do not mutate the ledger. Public `/insights` and `/methodology` use sourced published evidence; see `DATA_METHODOLOGY.md`.

Screens routes: /, /app/personal, /app/groups, /app/fundraising, /app/cooperative, /app/impact, /app/guardian, /app/simulator, /app/connect, /insights, /methodology, /solutions. Root route wrapper imports default HurizaApp({workspace:string}) from components/huriza-app.tsx. UI can import brand constant from lib/brand.ts and insights from ../../data/insights.json (or use /api/insights).

## Savings groups dual model (25 October 2026)

Migration `004-dual-savings-groups.sql` labels established group ledgers as `ACCUMULATING` and adds immutable model labels, policy, cycle, obligation, rotation-round, invite, and payout links. `financeState` now accepts an optional `orgId`; it returns model-specific group data only after checking the actor's exact tenant and group membership within the transaction. Personal members see their own IDs and obligations; group administrators can see the roster needed for administration.

`createSavingsGroup` creates an Itsinda (`ACCUMULATING`) or Ikimina (`ROTATING`) group, policy, cycle, creator membership, and a 96-bit random invitation code inside the creator's current demo tenant. Invite acceptance currently requires the same demo tenant. The attempted cross-tenant account move was rejected by the permission reviewer because it would move personal goals and notifications without a complete data audit; no cross-tenant move or tenant deletion is implemented.

Ikimina rotation publication requires the expected number of joined members and an exact registered-name recipient order. Each round creates member obligations. Confirmed contributions post to `rotation_payable`; loans are rejected for rotating groups. A payout is capped by confirmed obligations and reserve-protected cash, then requires a separate simulated provider success before posting. Unknown provider outcomes freeze the round until reconciliation.

Itsinda settlement requires an ended cycle, no outstanding loans, and no unresolved payment holds. It calculates shares from recorded member savings, protects the configured reserve, and creates pending synthetic share-outs. An administrator other than each recipient must confirm the payout. Posted journals remain immutable; all values use safe integer RWF and BigInt intermediate arithmetic.

## Cooperative Intelligence & Member Value Engine (29 October 2026)

Migration `014-cooperative-management.sql` adds cooperative profiles, bylaw allocation policies, staff appointments, member share capital accounts, production deliveries, commercial sales, 3-step cooperative expenses, investment digital twin simulations, governance events, surplus allocations, and member distributions. `FinanceState.cooperativeState` provides the authorized cooperative operating state for `/app/cooperative`.

The cooperative dashboard uses Overview, Members, Activity and More. `cooperativeState.members` contains the organization-scoped administrator roster, including members without share accounts; other roles receive an empty roster. `addCoopMember` accepts `orgId`, `name`, `phone` and a 4–8 digit `pin`. Only the cooperative administrator can create a fresh phone member account; an existing phone is rejected without changing its credentials, role or tenant. Membership creation posts no financial transaction. This action requires an online connection and is excluded from the browser offline outbox.

## HURIZA Fund — Operation Community Impact (29 October 2026)

Migration `015-fundraising-platform.sql` extends `finance_campaigns` with 15 domain tables (`fundraising_campaign_profiles`, `fundraising_campaign_media`, `fundraising_campaign_updates`, `fundraising_comments`, `fundraising_reactions`, `fundraising_followers`, `fundraising_contributions`, `fundraising_access_grants`, `fundraising_team_members`, `fundraising_milestones`, `fundraising_expense_details`, `fundraising_gift_items`, `fundraising_rsvps`, `fundraising_matching_pledges`, and `fundraising_moderation_events`).

Routes added:
- `/fund`: Public Campaign Discovery across HURIZA Moments, HURIZA Causes, and HURIZA Community.
- `/fund/campaigns/[slug]`: Dedicated shareable campaign page with dynamic OpenGraph metadata and strict server-side privacy redaction (`public`, `unlisted`, `private` campaign visibility and `everyone`, `contributors_only`, `selected_contributors`, `team_only` statistics visibility).
- `/fund/create`: 9-step Guided Campaign Creation Studio.
- `/fund/manage/[campaignId]`: Organizer & Accountant Management Dashboard (also integrated into `/app/fundraising`).
- `/api/fund/campaigns`, `/api/fund/campaigns/[slug]`, and `/api/fund/media`: Server-authorized endpoints for campaign discovery, mutations, and Cloudinary/validated media handling.

