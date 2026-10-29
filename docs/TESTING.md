# Verification record

24 October 2026, local Windows environment, Node 24 / Next 16 / PostgreSQL through PGlite and the Firebase Authentication Emulator.

## Completed checks

- `npm run typecheck`: passed.
- `npm test`: 41 unit and database integration tests passed, including financial invariants, membership authorization, privacy projections, personal account behavior and Guardian calculations.
- `npm run verify:auth`: 17 Firebase Emulator-backed HTTP checks passed. Coverage includes anonymous access, CSRF and role-spoof rejection, verified-email onboarding, empty personal-account defaults, workspace and export denial, goal privacy, separate user identities, officer approval and simulated provider flows, NGO/cooperative access, sign-out, disabled accounts and public routes.
- `python data/build_indicators.py`: validates curated published aggregates and regenerates `data/insights.json`.

The authentication HTTP verification runs against the local Firebase Authentication Emulator and a local Huriza server. It uses ignored fixture credentials at `.local/firebase-test-accounts.json` and creates synthetic emulator accounts. It does not configure or contact a live Firebase project.

## Local authentication test setup

Create `.env.local` from `.env.example` and use the loopback emulator configuration from the README. Start the emulator, seed the accounts/database, and then start the app. The seed command must complete before the server takes ownership of the PGlite directory.

```powershell
npm run auth:emulator
```

```powershell
npm run auth:seed
npm run dev
```

With the app available at `http://127.0.0.1:3000`, run the HTTP verification in another terminal:

```powershell
npm run verify:auth
```

`HURIZA_BASE_URL` can point the verifier at another local Huriza server. Never point the emulator seeder or test verifier at a live Firebase project. PGlite is embedded PostgreSQL with a single process owner: do not start a second server, seed process, or test process against the same database directory while a server is using it. Select a different `HURIZA_DB_PATH` for isolated local work.

## Pending verification

- Production `npm run build` and standalone server verification.
- Browser QA of the Firebase sign-up, email verification, sign-in, password recovery, authorized workspace navigation, personal-account empty state and sign-out flows.
- Docker/compose, external PostgreSQL concurrency, hosted Firebase configuration and deployed URL verification.
- Accessibility certification, penetration testing and regulated financial-service approval are not claimed.
