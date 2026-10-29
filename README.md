# HURIZA

**Beyond Saving. Toward Financial Intelligence.**

HURIZA is a connected community-finance prototype for Rwanda. Its workspaces cover personal goals, savings groups, fundraising, cooperatives and programme reporting. Guardian explains deterministic calculations, while the savings planner helps people model a personal goal.

## Local account setup

Requirements: Node.js 24 and npm. Install dependencies and create a local environment file:

```powershell
npm ci --legacy-peer-deps
Copy-Item .env.example .env.local
```

For local authentication, configure `.env.local` with the emulator values below. These are local emulator identifiers, not a live Firebase project. Keep the emulator host on loopback.

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=demo-local
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-huriza
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:huriza-local
FIREBASE_PROJECT_ID=demo-huriza
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
COOKIE_SECURE=false
```

Start the local Authentication Emulator in one terminal. In a second terminal, seed the local test accounts and sample financial tenant before starting Next.js:

```powershell
npm run auth:emulator
```

```powershell
npm run auth:seed
npm run dev
```

Open http://127.0.0.1:3000 and sign in with one of the five independent emulator accounts. Fixture email addresses and passwords are written only to ignored `.local/firebase-test-accounts.json`; read them locally when needed. Each fixture has a separate Firebase identity and role. Do not use these test credentials with any live Firebase project. New public registrations must verify email and receive an empty personal account with no organization memberships or financial records. An organization role requires trusted local provisioning with `npm run accounts:provision -- --uid <firebase-uid> --role <role> [--tenant <tenant-id>]`.

PGlite is embedded PostgreSQL and has one process owner. Run `auth:seed` to completion before `dev`, and do not run a second app, seed, test server, or verification process against the same `.local/postgres` directory while the dev server owns it. `HURIZA_DB_PATH` can select a separate local database directory. For an external PostgreSQL server, set `DATABASE_URL` and follow [deployment guidance](docs/DEPLOYMENT.md).

## Authentication and access

Firebase Authentication handles email/password identity. HURIZA creates an eight-hour HttpOnly server session only after verifying the Firebase ID token and verified email. The server owns account roles, organization memberships, workspace access and tenant scope. The browser cannot select a role or switch identity. Workspace navigation shows only areas authorized for the signed-in account. Sign-up always creates a new, empty personal space; trusted organization access is provisioned separately.

No live Firebase project is configured, and this application has not been published or deployed. Live project configuration will be supplied separately; do not invent project IDs or credentials.

## What works

- Firebase-backed accounts, verified-email sign-in, protected workspace routes, server sessions, personal account provisioning, and trusted local organization-role provisioning.
- PostgreSQL migrations, exact integer RWF, balanced append-only journals, reversals, and financial audit hash chains.
- Contributions, configurable eligibility and reserves, independent loan approval, held pending disbursements, simulated provider outcomes, repayments and schedules.
- Private personal savings goals, campaign donations and independent expense approval, cooperative records and proposals, NGO aggregates and interventions, and authorized CSV exports.
- Interactive financial scenarios, deterministic explanations, and browser USSD simulation.
- A local savings planner, deterministic financial scenarios, and a hypothetical institutional subscription calculator.

Financial transactions and USSD are explicitly simulated. The product does not hold or send real funds. Newly registered accounts have no sample financial records. No external LLM API is used or required.

## Verify

```powershell
npm run typecheck
npm test
```

With the emulator running and the sample fixtures seeded before the app server starts, use a separate supported verification setup to run `npm run verify:auth`. It exercises Firebase Authentication Emulator and local HTTP session/workspace boundaries; it creates and changes synthetic local accounts. See [testing](docs/TESTING.md) for current results and prerequisites. Production build and browser QA remain pending.

## Demonstration records

Public examples use fictional records and stated scenario assumptions. They are separate from account activity, and they do not establish real-world program outcomes. The finance planner runs locally in the browser and does not update an account or ledger.

## Engineering and disclosure

[Architecture](docs/ARCHITECTURE.md) · [Financial model](docs/FINANCIAL_MODEL.md) · [Security](docs/SECURITY.md) · [Demo guide](docs/DEMO_GUIDE.md) · [AI disclosure](docs/AI_USAGE_DISCLOSURE.md)

The prototype was developed with AI-assisted work under human direction. Dependencies retain their own licenses; official reports remain attributed to their publishers. No open-source license is asserted for this repository until ownership and competition terms are clarified. The competition’s published IP-assignment clause requires written clarification before asserting commercial rights to submitted assets.
