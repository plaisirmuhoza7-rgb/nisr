# Google Sheets connection preparation

## Shared hackathon demo mode

When `HURIZA_SHEETS_PRIMARY=true`, the encrypted `HURIZA master` snapshot in the configured spreadsheet is the durable store; a single in-memory PGlite instance applies the app's existing transaction and authorization rules. The long-lived worker also replaces `HURIZA data` with a bounded, readable view of all organizations in the shared demo spreadsheet. Every person with access to that file can see every exported organization's records. Account profile details, personal goals, and onboarding requests are included only after their owner selects an organization destination. Passwords, session tokens and invitation codes are excluded. Financial transactions are simulated.

The view is retried if a write fails and is not the authoritative store. If it exceeds its row or byte limits it is not truncated; the app's saved master remains intact and the status shows that the view needs attention. Run only one application process against this master. Back up the separately stored encryption key securely; a lost key makes the master unreadable. See [SHEETS-PRIMARY-DEMO.md](SHEETS-PRIMARY-DEMO.md) for bootstrap and recovery details.

## Legacy per-organization mode

The remaining instructions in this document apply only when `HURIZA_SHEETS_PRIMARY` is not enabled.

HURIZA stores accounts and financial records in PostgreSQL (or local PGlite). Google Sheets receives a separate, eventually consistent copy for each bound organization; it is not the app's transactional database. The connection check below only reads spreadsheet metadata.

1. Enable the Google Sheets API in the Google Cloud project used by the service account.
2. Create or choose a spreadsheet, and share it with the service account's email address. Use Editor access if the app will eventually write to it.
3. Set `GOOGLE_SHEETS_SPREADSHEET_ID` in ignored `.env.local` to the ID between `/d/` and `/edit` in the spreadsheet URL. Configure `GOOGLE_APPLICATION_CREDENTIALS` with the path to the service account JSON, or use server Application Default Credentials. Do not put a private key in a public variable or source control.
4. Run `npm run sheets:check` to verify read access. Run `npm run sheets:prepare` to create the dedicated `HURIZA data` tab if absent. If a tab with that name already exists without HURIZA's marker, the command refuses to overwrite it.

Replacing PostgreSQL requires redesigning the database-backed services and accounting for concurrent edits, authorization, retries, failures and privacy. A Sheets API batch is atomic, but that alone does not provide the transaction isolation and locking currently used by HURIZA's financial operations. No live ledger migration is implemented by this connection check.

## Organization binding

The trusted local administrator can bind a spreadsheet to an existing organization with `npm run sheets:bind -- --tenant <tenant-id> --organization <org-id>`. It uses `GOOGLE_SHEETS_SPREADSHEET_ID` by default; `--spreadsheet <id>` selects another spreadsheet. Each spreadsheet can be bound to only one organization, and bindings cannot be reassigned by this command. This command only records the association; it does not upload or synchronize data. The administrator must establish that the sheet's sharing permissions match the organization's intended audience before binding it. This is a privileged local operation, not a public account action.

For PGlite, stop the application before running the binding command because the embedded database supports only one process owner. A production deployment requires external PostgreSQL.

Set `HURIZA_SHEETS_AUTO_SYNC=true` in the server environment and restart a long-lived Node application process to start background delivery. Each bound organization's committed changes queue a revision in PostgreSQL. The worker serializes deliveries per destination, replaces a bounded app-owned range using RAW values and retries failures; a saved financial change remains saved in PostgreSQL if Google Sheets is unavailable. The queue survives app restarts, but delivery requires a running worker. A personal account may explicitly choose one of its current bound organizations for its own saved goals, profile name/email and organization requests; the choice can be removed. A private account with no connected organization has nowhere to export yet. Changing or removing the choice queues a new snapshot for the old destination, but already copied or independently downloaded data cannot be recalled.

External PostgreSQL uses a separate delivery lock so ordinary financial writes do not wait on the Sheets API. Local PGlite serializes transactions in its single process, so other local operations may wait for a bounded Sheets request to complete.

The complete automatic snapshot is limited to 1,998 projection rows and 1.8 MB of serialized values. If it exceeds these limits, delivery fails without truncating data and remains pending. Users can see a pending or attention status for their chosen organization in their personal workspace. Keep each spreadsheet restricted to people entitled to see its organization records: all spreadsheet viewers can see the copied data, regardless of individual HURIZA roles. Passwords, session tokens, service-account keys and invitation codes are never exported. All operational transactions remain synthetic.

## Manual group summary

After a trusted administrator binds a spreadsheet and prepares its dedicated `HURIZA setup` tab with `HURIZA connection setup` in cell A1, a current group president or treasurer may manually sync a simulated group summary from the group workspace. The server derives the account from its Firebase session, rechecks active membership and the exact tenant/organization binding, and writes only a fixed aggregate range with RAW values. The sheet must be shared only with people entitled to see that group's summary. The existing HURIZA sheet has a setup tab; a different organization needs its own dedicated spreadsheet and setup tab. The account profiles, session data, member names and transaction details are not sent.

This button sends a separate manual aggregate to the setup tab. Automatic delivery writes the dedicated data tab and does not depend on the button. Bindings support savings groups, cooperatives, fundraising organizations and the existing NGO workspace. NGO spreadsheets receive only that NGO's intervention notes, never member or personal records; personal destinations cannot select an NGO sheet. Drafts and simulator assumptions are not persisted or synced. A Sheets failure does not change financial records.
