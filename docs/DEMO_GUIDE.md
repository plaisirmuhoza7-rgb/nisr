# Huriza demo guide

## Before a walkthrough

Use the local Firebase Authentication Emulator and clearly label the financial records as simulated. No live Firebase project, bank, mobile-money provider, USSD gateway or live NISR data service is connected. For local access, follow the setup in the README: start the emulator, run `npm run auth:seed` before `npm run dev`, and read the independent fixture emails and passwords from ignored `.local/firebase-test-accounts.json`. Each fixture is a separate Firebase identity; sign out and sign in with the next fixture to change accounts. There is no role selector or identity switcher.

Newly registered accounts must verify their email and start with an empty personal workspace, no organizational membership and no sample financial records. For a quick walkthrough of the synthetic organizational flows, use the pre-provisioned emulator fixtures.

## Three-minute walkthrough outline

| Time | Screen and action | Suggested narration |
|---|---|---|
| 0:00–0:20 | Sign in as the member fixture and open `/app/personal`. Point out the simulated-financial-records badge. | “Huriza is a prototype for clearer savings-group records and decisions. Every transaction here is synthetic; no payment provider or mobile network is connected.” |
| 0:20–0:45 | Open **NISR insights**. Show the source labels and caveats. | “The national context uses published NISR estimates. These figures describe Rwanda, not Huriza users or product impact.” |
| 0:45–1:10 | Return to the member workspace. Record a simulated RWF 10,000 group contribution, then request a fictional RWF 150,000 loan over three months. | “This member account records a simulated contribution and submits a loan request. The request remains pending group review.” |
| 1:10–1:20 | Sign out. Sign in independently as the president fixture and open **Group treasury**. | “Access follows the signed-in account’s verified organization membership. I’m signing in as a separate pre-provisioned test account.” |
| 1:20–1:45 | Approve the loan request. In **Payments**, confirm the simulated provider outcome as success. | “Approval and simulated provider confirmation are separate steps. The demo does not send funds.” |
| 1:45–2:10 | Open **Ledger** and point out the posted synthetic entry. Sign out; sign in as the NGO fixture and open **Impact reporting**. | “The ledger records the demo event. The NGO workspace shows permitted aggregate sample reporting, not member-level records.” |
| 2:10–2:45 | Open **Scenario lab** and adjust an assumption such as reserve or loan requests. | “The scenario is hypothetical. It shows how cash, reserve and lending capacity could change; it does not alter account records.” |
| 2:45–3:00 | Return to **NISR insights** or show the access boundary from the personal-only fixture if useful. | “Published national evidence and synthetic platform activity remain separate. This prototype does not measure real program impact.” |

If an action fails, do not imply it succeeded. Restart from a clean local setup if needed. Keep the newly created three-month loan identifiable by amount and term; it is separate from any seeded sample loan.

## What this demo does not show

It does not connect to a bank, mobile-money provider, USSD gateway, external identity provider, or live NISR data service. Emulator fixtures and synthetic finance are for local product demonstration only. They are not evidence of deployment, adoption, repayment behavior or poverty impact. The production build, browser QA, public deployment, and recording remain pending.
