# HURIZA Impact (NGO Platform) Archive

## Overview
This directory preserves all code, UI components, backend services, tests, and contract types for the **HURIZA Impact / NGO Management** platform module.
This feature was temporarily decoupled from the live product workspace, login, signup, and homepage for the current release phase, but is 100% preserved here for reactivation in the upcoming project phase.

## Contents
- **`src/components/ngo-impact-dashboard.tsx`**: Full React UI dashboard for NGO Impact, including program tracking, MEAL indicators, grant management, field visits, offline syncing, and donor reporting.
- **`src/components/ngo-impact-dashboard.module.css`**: Styling for the NGO Impact dashboard.
- **`src/server/ngo/service.ts`**: Complete backend domain service for NGO management (programs, grants, budgets, field visits, MEAL indicators, data quality, audit trace chains, and report snapshots).
- **`src/lib/ngo-contracts.ts`**: TypeScript definitions and interfaces (`NGORole`, `NGOProfile`, `NGOProgram`, `NGOGrant`, `NGOActivity`, `NGOExpense`, `NGOIndicator`, `NGOState`, etc.).
- **`tests/ngo-impact.test.ts`**: Comprehensive suite of 67 unit/integration tests covering all NGO operations and permissions.
- **`tests/ngo-sheets.test.ts`**: Integration tests verifying Google Sheets synchronization and projections for NGO datasets.
- **`PATCHES.md`**: Detailed snippets and diffs to reconnect the NGO service, routes, API actions, and UI navigation into the core application.

## Database Migrations
Migrations `011-ngo-sheet-bindings.sql` and `016-ngo-impact-platform.sql` remain in `migrations/` and in database migration history to maintain append-only migration integrity and schema compatibility. The database tables (`ngo_profiles`, `ngo_staff_members`, `ngo_programs`, `ngo_grants`, `ngo_indicators`, etc.) are preserved intact in the database schema.

## How to Reactivate HURIZA Impact in Next Phase
1. Copy `archive/huriza-impact/src/components/*` back to `src/components/`.
2. Copy `archive/huriza-impact/src/server/ngo/*` back to `src/server/ngo/`.
3. Copy `archive/huriza-impact/tests/*` back to `tests/`.
4. Re-export or merge `archive/huriza-impact/src/lib/ngo-contracts.ts` back into `src/lib/contracts.ts`.
5. Apply the code snippets in `archive/huriza-impact/PATCHES.md` to:
   - `src/server/finance/service.ts`
   - `src/app/api/export/route.ts`
   - `src/app/api/actions/route.ts`
   - `src/app/api/state/route.ts`
   - `src/lib/access.ts` (re-add `'impact'` to `Workspace` and `WORKSPACES`)
   - `src/components/huriza-app.tsx` (re-add `'impact'` nav item and view)
   - `src/components/auth-screen.tsx` & `src/app/page.tsx`
6. Run `npm run typecheck` and `npm test` to verify.
