# Authentication troubleshooting

## What was corrected

The server now creates and verifies Firebase session cookies consistently. It does not store a short-lived ID token as an eight-hour session, retry rejected tokens without revocation checks, or recreate deleted sessions when a database row is missing. Emulator initialization ignores inherited live credentials without altering them.

Existing cookies created by the old ID-token fallback are rejected. Sign in again after restarting the updated server.

## Hosted error: credentials file does not exist

This error means the server was configured with a credential file path that is absent on its host. Creating and verifying an account in Firebase does not supply the Admin credentials required by HURIZA's server.

In the Vercel project's environment settings, replace the stale `GOOGLE_APPLICATION_CREDENTIALS` path with one server-only credential source: `FIREBASE_SERVICE_ACCOUNT_JSON` containing the owner-supplied service-account JSON (raw JSON or base64), or `FIREBASE_CLIENT_EMAIL` plus `FIREBASE_PRIVATE_KEY`. Select the environment serving the site and redeploy after updating configuration. Never add these credentials to the repository or browser variables.

Firebase login also accepts the existing Sheets credential aliases `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_APPLICATION_CREDENTIALS_JSON` and `GOOGLE_CLIENT_EMAIL` plus `GOOGLE_PRIVATE_KEY`. Valid explicit inline or paired credentials take precedence over a stale file path. A path alone still fails when the file is missing; removing it without supplying credentials does not configure Vercel automatically.

## Email verification returns to login

The verification button reloads the Firebase user and checks the current verified status. An unverified user stays on the verification screen with a useful message. A verified user is signed out of browser Firebase and sent to `/login` with the intended destination preserved. The server session is created only after the subsequent login; the signup purpose remains tied to that user's UID until login succeeds.

## Check the failing step

1. A Firebase error before `POST /api/session` points to browser identity configuration, email/password credentials, email verification, network access or provider settings.
2. A `503` from `POST /api/session` points to server Firebase configuration or session-cookie creation. Check server logs and supply valid Admin credentials; do not fall back to accepting an ID token as a session cookie.
3. A successful session exchange followed by a guest response points to cookie delivery, a disabled/revoked identity, an inactive account, or missing database session state. The session database must be durable and shared by application instances.

The November 1, 2026 read-only configuration check found email/password enabled, a browser API key matching the configured app's project number, and `localhost` plus `nisr-three.vercel.app` in authorized domains. This does not verify a live user's password or the deployed server's private credentials.

## Local and hosted configuration

- Keep `.env.local` private. Restart Next.js after changing configuration; `NEXT_PUBLIC_*` values also require rebuilding the browser bundle for hosted use.
- Local emulator settings must use a `demo-` project and loopback hosts. The emulator and the app are separate processes.
- A local `GOOGLE_APPLICATION_CREDENTIALS` file path works only on a machine containing that file. A Windows path does not supply credentials to Vercel. Hosted environments can use server-only `FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON or base64), `FIREBASE_CLIENT_EMAIL` plus `FIREBASE_PRIVATE_KEY`, or the platform's Application Default Credentials.
- Use matching Firebase project IDs and owner-supplied credentials. Remove emulator settings from live deployments and use secure cookies over HTTPS.
- Production instances need shared durable PostgreSQL through `DATABASE_URL`. An in-memory PGlite database is instance-local, so session rows disappear or differ across instances. Sheets-primary remains a single-writer demo mode and does not make multiple serverless writers safe.

## Isolated authentication verification

The new verifier does not load `.env.local`. Use an isolated app server configured for the local emulator, with Sheets connections disabled and a separate `HURIZA_DB_PATH`. Never point this check at live accounts or the normal application database.

With that server running at port 3101 and the Authentication Emulator at port 9099:

```powershell
$env:FIREBASE_PROJECT_ID='demo-huriza'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:HURIZA_BASE_URL='http://127.0.0.1:3101'
npx tsx scripts/verify-auth-session.ts
```

The verifier creates emulator-only accounts and removes them afterwards. Its eleven checks include a real Firebase client reload and sign-out after email verification, a real eight-hour session cookie, unverified-email rejection, CSRF rejection, personal state, logout replay, disabled-account rejection and forged-token rejection.

Application checks:

```powershell
npm run typecheck
npm test
npm run build -- --webpack
```

Firebase's [session-cookie guide](https://firebase.google.com/docs/auth/admin/manage-cookies) describes the ID-token exchange, session lifetime and revocation checks used here.
