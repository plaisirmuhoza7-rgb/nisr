# Deployment

No external deployment or public repository has been created. No live Firebase project ID/configuration has been supplied. This document describes the local emulator setup and the configuration required for a future reviewed deployment; it does not claim production readiness.

## Local Authentication Emulator

Copy `.env.example` to ignored `.env.local`, then set the local values shown in the README (`demo-huriza`, `127.0.0.1:9099`, and `COOKIE_SECURE=false`). Never add real Firebase credentials to the emulator configuration. The emulator must use a `demo-` project ID and loopback host.

Start the emulator in one terminal, then seed the accounts/database and start the app in the next terminal:

```powershell
npm run auth:emulator
```

```powershell
npm run auth:seed
npm run dev
```

The seed script writes test credentials to ignored `.local/firebase-test-accounts.json`. It creates five separate emulator users and a shared synthetic financial tenant. Seed before starting Next.js: PGlite is single-process embedded PostgreSQL and only one process can own its directory. Do not run account seeding, tests, or verification against that same directory while the application server is using it. Use a separate `HURIZA_DB_PATH` for separate local jobs.

## Future hosted deployment requirements

- A real Firebase project and approved Authentication setup. The client values are `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`. Server Admin uses `FIREBASE_PROJECT_ID` plus a server-only service identity (`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`) or hosting Application Default Credentials. Obtain values from the project owner; never invent or commit them.
- A dedicated PostgreSQL database configured through `DATABASE_URL`, HTTPS, secret storage, backups, monitoring, and an operationally reviewed migration process.
- `COOKIE_SECURE=true` behind HTTPS. Do not set `FIREBASE_AUTH_EMULATOR_HOST` or `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` in a live environment. The emulator is disabled in production unless an explicit local-only override is set; that override must not be used for a public deployment.
- Do not set `ALLOW_EMBEDDED_DB=true` for autoscaling/serverless hosting. PGlite is for a single-process local preview only.
- Provision organization roles and memberships through the trusted local admin process after identity verification; public registration always creates an empty personal account.

## Build and run

Once the real project settings and external database are supplied, run the full release checks before deployment:

```powershell
npm ci --legacy-peer-deps
npm run typecheck
npm test
npm run build
```

The Dockerfile uses Next standalone output and a non-root user; `compose.yaml` includes PostgreSQL 17 and localhost-only web access. Docker/compose and production build have not been verified for this Firebase upgrade. External PostgreSQL concurrency and hosted Firebase configuration also remain unverified.

## Release verification

Before any authorized publication, verify the deployed URL, verified-email account lifecycle, workspace isolation, personal and organization financial flows, source links, mobile layout and exports. Use the actual supplied project and URL; do not substitute fabricated deployment values. A public recording and competition submission also remain outstanding.
