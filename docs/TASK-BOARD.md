# HURIZA delivery board — 24 October 2026

This board describes the implemented local prototype, not completion of every feature in the master vision.

| Gate | Status | Evidence |
|---|---|---|
| 1 · Foundation | Verified locally | Next app, PostgreSQL migrations, Firebase-backed account sessions, verified-email onboarding, workspace route guards |
| 2 · Financial core | Verified locally | Immutable balanced posting, contributions, lending/approval/holds, simulated provider, repayment, personal projections, finance test coverage |
| 3 · Connected ecosystem | Verified at prototype depth | Personal goals; group lending; campaign donation/spending; cooperative records/votes; authorized NGO aggregates/interventions; Guardian and simulated USSD |
| 4 · Account security | Verified against local emulator | 41 unit/database tests, 17 Firebase Emulator HTTP checks, server-side workspace authorization and personal-account privacy |
| 5 · Competition preparation | In progress | Published-source indicators and methodology are present; production build and browser QA remain pending |
| 6 · Submission | Pending external steps | No live Firebase project, external deployment, public repository or actual screen recording yet |

## Completed ownership

- Root Sol: Firebase account/session implementation, account provisioning, workspace permissions, routes, integration and documentation.
- Finance Sol: accounting, lending, payment/fund/cooperative services, database protections, audit chain, and finance tests.
- UI Luna: workspace account-aware navigation and landing experience under the agreed interfaces.
- Evidence Luna: official-source research, reproducible aggregate dataset and competition/demonstration disclosures.

## Next delivery work

1. Receive the actual Firebase project ID and configuration from the project owner; complete hosted account setup only after the approved project is available.
2. Run the production build and browser QA for sign-up, email verification, sign-in, recovery, authorized workspaces, personal-account empty state and sign-out.
3. Select and authorize external hosting and a public repository destination, supply service/database access, validate PostgreSQL and deploy; then run HTTP verification against the actual URL.
4. Create the actual demonstration recording, verify definitive event format requirements, and complete the submission package.
5. Obtain written IP clarification before making post-submission commercial ownership claims.

## Broader product work retained

Self-service organization setup, invitations, per-organization custom roles, multi-group selection, meeting records, expanded cooperative budgets and governance, program/field-officer setup, reviewed Kinyarwanda, uploads and advanced reports remain outside the current connected prototype. No real financial activity or impact is claimed. See `KNOWN_LIMITATIONS.md`.
