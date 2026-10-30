# Known limitations

- This is a local fictional prototype, not a complete production financial institution. There is no live MoMo, telecom, banking, payment-provider or real customer integration.
- A live Firebase project has not been supplied or configured. Account and email verification flows are implemented, but only the local Firebase Authentication Emulator has been verified. Production build, browser QA, Docker and hosted configuration checks are still pending.
- Public deployment, public repository publication, video recording and final submission are pending.
- Public signup creates a verified-email account with an empty personal tenant. Organization role provisioning is trusted-admin work; self-service organization creation, invitations, custom roles, MFA and advanced organization management are not implemented.
- The interface offers personal goals, group finance, fundraising, cooperative and impact workspaces, but not every screen or function in the master vision is complete. The task board distinguishes the connected prototype from future depth.
- Financial operations currently use one principal group for member operations; another group supplies seeded program aggregates. Full multi-group membership selection and per-group policy UI remain future work.
- Cooperative voting records one vote per configured member. It does not execute a binding governance resolution or investment. Advanced budgets, asset lifecycles, subscriptions vs. paid shares, and configurable voting thresholds need expansion.
- NGO programs, participation and reporting-completeness baselines are seeded. Field-officer reassignment, program creation, comparative baseline studies, district choropleths and small-cell policy configuration are not implemented. Member private records remain inaccessible.
- Fundraising supports donations, spending requests, independent approval and confirmed expense posting. Public campaign sharing, supporting-document uploads and verified outcomes are not implemented.
- Journal summary UI displays balanced entries; complete account-oriented statements and arbitrary reporting filters remain limited. Posted entries cannot be ordinarily edited or deleted; corrections require reversal.
- Reconciliation returns stored simulated provider status. External settlement statements and automated settlement processing remain future work.
- USSD is a browser simulator. Kinyarwanda strings await reviewed translations and are not presented as vetted localization.
- Guardian AI is a decision-support guide grounded in deterministic rules, safe integer RWF math, and permissioned database records. Any generative AI layer is restricted to plain-language explanation of verified facts with strict numerical validation; Guardian never executes transactions, moves funds, or approves loans.
- The data pipeline validates curated published aggregates. It does not download or analyze restricted microdata, infer district estimates, or join FinScope and EICV respondent samples.
- Local PGlite has a single process owner. External PostgreSQL concurrency and Docker deployment need environment-specific testing.
- Long-running operation needs data-retention quotas, durable rate limits, monitoring, backups and incident response.
- Commercial rights remain uncertain under the published competition IP assignment; written clarification is needed.
