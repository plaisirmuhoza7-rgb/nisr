# Firebase account upgrade — current implementation contract

User approved Firebase authentication; live project ID/configuration will be supplied AFTER implementation. Use actual Firebase SDKs and local Authentication Emulator for verification; never invent a live project. No external deployment.

## Ownership
- Root Sol: Firebase client/admin modules, server sessions/account provisioning, migration003, permissions, account/identity tests, API routes, server route guards, auth pages/components, scripts/config/dependencies/integration.
- Finance Sol: `src/server/finance/service.ts`, `tests/finance.test.ts` ONLY. Remove demo-only identity assumptions, support empty personal accounts and personal-only projections, verify trusted membership role.
- Workspace Luna: `src/components/huriza-app.tsx`, `src/components/workspace-access.module.css` ONLY. Remove role switching/demo login/reset, filter authorized nav, use real account metadata. No globals or root routes.
- Landing Luna: `src/app/page.tsx`, `src/app/landing.module.css` ONLY. Premium new landing with clear account/organization paths. No shared globals/auth/server.

## Authoritative identities
Firebase UID is `app_users.id` for actual accounts. It is NOT equal to a role. New migration003 adds `account_profiles(user_id pk FK app_users,tenant_id FK demo_tenants,status active|disabled)` and `firebase_sessions(token_hash pk,user_id FK app_users,created_at,expires_at)`. Existing demo accounts/records remain preserved but old cookies and {role} login stop working. User role remains server-owned `app_users.role`; memberships record trusted org assignments. No browser input grants elevated roles or tenant access.

Authenticated user JSON: `{id,name,email,role,tenantId,workspaces:string[],homeWorkspace:string,organizationName:string|null,memberships:{orgId:string,role:Role}[],emailVerified:boolean,isTestAccount:boolean}`. Account registrations default member with a fresh EMPTY personal tenant, zero memberships, zero financial records. Role-based organization accounts are provisioned only by a local trusted admin script, never a public endpoint. Local Firebase emulator fixtures use existing fictional role IDs as Firebase UIDs and a common synthetic tenant, but each account signs in independently with email/password. Do NOT expose a role picker, auto-switch credentials, or privilege registration choice.

## Browser/API
- Firebase client module `src/lib/firebase-client.ts` exports `firebaseAuth()` (throws useful missing-config error if not configured), `firebaseClientConfigured()`.
- Login `/login`, signup `/signup`, forgot password `/forgot-password`, verification `/verify-email`. Root builds these. Public GET `/api/session` -> `{user,authConfigured:boolean,authEmulator:boolean}`. POST `/api/session` accepts ONLY `{idToken:string}` with strict schema; validates fresh signed Firebase ID token and verified email, creates Firebase Admin session cookie in HttpOnly cookie, records SHA256 cookie hash in server session table for signout invalidation. Firebase disabled/revoked account + missing DB session rejects.
- DELETE `/api/session` signs out server session. Client should also sign out Firebase SDK (auth module/login lifecycle handles it).
- Workspace login link `/login?next=/app/<workspace>`. Server redirect is validated against user.workspaces; no open redirects.
- GET `/api/state?workspace=<id>` checks requested workspace allowed, returns root user JSON + FinanceState/goals/interventions/notifications. Root grants personal own goals to every account. No org membership returns empty finance state, not500. Personal-only projection MUST exclude other members' records, even for group officers.
- POST `/api/actions` still financial schema, actor from Firebase session only. `resetDemo` will be REMOVED/denied. Old POST role or email/password payloads must be rejected.
- Finance `financeState(db,actor,options?:{personal?:boolean})` optional third argument preserves old tests. Personal option returns actor's own group contributions/loans only and NO organizational ledger/cooperative/NGO arrays. Empty personal account returns empty state. Normal financeState still role-specific, but no valid membership -> no financial rows; financeAction rejects missing membership.
- Root assertPermission keeps policy mapping but removes userId===role restriction. Finance requireMembership must check actual membership.role===actor.role (role assignment from session is trusted); query using existing SQL transaction, never call outer-db query from inside PGlite transactions.

## Allowed navigation
Every authenticated account: personal, guardian, simulator. Membership group-ubumwe with matching role grants groups/connect. fund-school grants fundraising. coop-imena with cooperative role grants cooperative. ngo-imizi with ngo role grants impact. Group officers home groups; cooperative home cooperative; ngo home impact; default home personal. Workspace switch is navigation to authorized areas, never identity switching. Root exports `accessibleWorkspaces`, `homeWorkspace` and `safeAccountRedirect` in `src/lib/access.ts`.

Workspace UI State user follows JSON above. `refresh` calls `/api/state?workspace=${active}`. On401 show link to login, on403 show authorized home link; do not sign in by role. Nav filters by `user.workspaces`, public insights/methodology stay visible. Sidebar shows organizationName or 'Personal account'. Role shown as badge, not editable. Signout DELETE with JSON then Firebase SDK signOut then location/login. Existing simulated financial operations keep clear simulation disclosure; account authentication itself is actual Firebase (emulator labeled when used).

## Landing
Public homepage uses the founder-approved minimal blue palette (#4A90E2 primary, #2463A6 deep, #14283F navy) with white and pale-blue surfaces. CTAs create account / sign in; five audience cards to `/signup?workspace=personal|groups|fundraising|cooperative|impact`, descriptions accurately distinguish requesting organization access from self-selecting privilege. No fake customers/partners/results; use labeled illustrative financial preview if amounts. Public Insights and methodology. Login's safe return destination is honored only when authorized. No 'Enter demo' role switching.


## Blue transformation onboarding contract — 25 October 2026

Signup purposes are personal, groups, fundraising, cooperative and impact. Purpose is validated UI context only. Verified group signup may continue to the exact `/app/groups/start` onboarding route without existing group membership; membership in an existing group is still required before its financial records can be read. Organization purposes continue to exact `/app/onboarding?purpose=fundraising|cooperative|impact` destinations. Redirects with arbitrary parameters or privileged workspace requests remain rejected unless already authorized.

Migration 005 adds `workspace_onboarding_requests`. `/api/onboarding` requires a verified account; mutations also require the same-origin JSON checks. The service verifies an active profile and derives tenant/user from the server session, validates a strict purpose/name/location/description payload, and scopes every request read/write to its owner. One immutable submitted request per purpose is returned idempotently. Requests create no identity role, membership, financial organization, ledger entry, or external communication. Review and approval workflows remain unimplemented and are disclosed in the UI.

The public `/demo` uses fixed synthetic previews and the same deterministic Guardian scenario engine. Public USSD is local-only; authenticated financial operations retain their existing server services and authorization.
