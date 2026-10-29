# Architecture

HURIZA is a Next.js 16 App Router and React 19 TypeScript modular monolith. Shared CSS provides the forest, emerald and ivory interface; Lucide supplies icons. Central branding lives in `src/lib/brand.ts`.

```text
Browser workspaces and public Insights
          ↓ same-origin HTTP
Firebase Authentication → verified identity → HttpOnly server session
                                          ↓
                           account + tenant + memberships
                                          ↓
                  workspace authorization and trusted Actor
                                          ↓
         Personal goals | Financial services | NGO interventions
                            ↓
       Integer RWF journals / loans / simulated payments / audits
                            ↓
             PostgreSQL (PGlite locally; pg Pool externally)

Published NISR aggregates → validated JSON → public Insights
Pure Guardian calculations → scenario UI (no ledger mutations)
```

`src/server/firebase-admin.ts` validates Firebase server configuration and initializes Firebase Admin. `src/lib/firebase-client.ts` initializes browser Authentication and, when configured, connects the client to the local emulator. `src/server/auth.ts` validates fresh verified ID tokens, issues and invalidates session cookies, and derives the trusted actor from the session. `src/server/accounts.ts` provisions a new verified Firebase UID into an empty personal account, reads workspace access from memberships, and supports trusted local provisioning for organizational roles. Public registration never assigns organizational authority.

`src/lib/access.ts` maps trusted roles and memberships to authorized workspaces and the default home workspace. App route guards and `/api/state?workspace=<id>` enforce access on the server. The UI filters its menu from the returned account's authorized workspace list; this filter is not the security boundary.

`src/server/db.ts` owns PostgreSQL access and applies versioned SQL migrations. Migrations 001–002 create the original identity and finance schema; migration 003 adds Firebase account profiles and server-session records while preserving existing fictional records. Parameterized SQL services implement financial operations. Drizzle is installed as an optional dependency; the current financial implementation uses its SQL interface directly rather than claiming ORM coverage.

Every financial request derives `Actor {tenantId,userId,role}` from the Firebase-backed session. Finance queries are scoped to tenant and organization, and membership is checked within the relevant transaction. Personal workspace projections include only the account owner's group records and do not expose organization-wide ledger, cooperative or NGO arrays. NGO reporting returns authorized aggregates only. Personal goals are additionally scoped by user ID.

Journal values use safe integer RWF with BigInt intermediate arithmetic. Posted journals are immutable; corrections use reversals. Contributions, loans and campaign operations can create clearly labeled synthetic records. Provider outcomes are simulated, and no public live provider callback is exposed. USSD is a browser simulation that uses the same authorized backend actions and never contacts a mobile network.

Guardian uses deterministic integer calculations and templates, independent of UI and financial authority. NISR evidence is sourced published context; it is not joined with operational records and does not establish product impact. No LLM is connected.

PGlite is embedded PostgreSQL for a single local process owner. Do not share one PGlite directory across app, seed or verification processes. External PostgreSQL uses `DATABASE_URL` and the `pg` pool. Docker configuration packages a standalone Next server and versioned SQL, but the production build and browser QA are still pending.

Unit tests cover database and financial invariants. Firebase integration verification uses the local Authentication Emulator and HTTP routes. No hosted observability service is configured; server errors go to process logs.
