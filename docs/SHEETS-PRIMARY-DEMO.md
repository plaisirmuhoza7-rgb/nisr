# Google Sheets primary storage: demo integration plan

The local hackathon demo uses an opt-in Sheets-primary mode after bootstrap. Its encrypted master snapshot is the durable store, while an in-memory PGlite instance enforces the application's existing SQL constraints. The original embedded database and its offline copy are preserved. Other environments must be bootstrapped separately; do not point multiple processes or machines at the same master.

## Intended startup

1. Require an explicitly configured spreadsheet ID and a separately stored 32-byte encryption key. Never place the key in the sheet, browser code, logs, or a committed file.
2. Refuse startup if a durable uncertainty marker exists, the encrypted master is missing, or it cannot be authenticated. Do not silently start with an empty database.
3. Authenticate and read the newest valid master snapshot. Initialize an in-memory PGlite instance and apply the known migrations. Validate the snapshot schema and migration history before restoring it; reject mismatches rather than dropping or rewriting data.
4. Run the application against the serialized Sheets-primary adapter. Every mutating transaction must validate deferred constraints, capture and encrypt its logical state, and persist a complete alternate master slot before reporting success.

## Bootstrap and preservation

Bootstrap must be a separate, explicit administrative operation. Stop all application processes before accessing or copying the embedded PGlite directory; it is not a multi-process database. Make and verify a recoverable copy of the existing data without modifying or deleting the original. Apply migrations to a copy where needed, capture a consistent logical snapshot, and verify restoration before initializing an empty, dedicated master tab. Refuse to overwrite any existing master or unrelated sheet contents. Read back and authenticate the initial snapshot before enabling the new mode. Back up the encryption key securely: losing it makes encrypted snapshots unreadable.

The local bootstrap command is `npx tsx scripts/bootstrap-sheets-primary.ts --offline-copy <path-to-copy> --confirm-app-stopped`. Before running it:

1. Stop every running HURIZA server and any other process using its embedded database. The command cannot independently detect a running server using the original database.
2. Copy the entire configured `HURIZA_DB_PATH` directory to a separate location, and keep the original intact. The copy must remain offline throughout bootstrap and cannot contain filesystem links.
3. Configure the spreadsheet ID, service-account access, and a canonical base64 encoding of a randomly generated 32-byte `HURIZA_DEMO_MASTER_KEY` in the ignored `.env.local`. Store a separate secure backup of that key. Do not send it in chat or place it in the spreadsheet.
4. Run the command with the path to the offline copy. It makes a temporary working copy, checks restoration against current migrations, and refuses to overwrite an existing `HURIZA master` tab. It does not set `HURIZA_SHEETS_PRIMARY` or alter the original database.
5. If bootstrap fails after preparing the master tab or creating the uncertainty marker, stop and investigate; do not delete either automatically or retry blindly. Confirm the encrypted data and marker state first. Only enable the flag after a successful bootstrap and verification.

## Crash recovery and single-writer restriction

Before any Sheets write, create and durably flush an uncertainty marker on the host. Clear it only after the local transaction commits. If a write fails, times out, or a process exits before marker clearance, block further access and require explicit reconciliation against the authenticated sheet contents. This is necessary because the outcome of a timed-out request can be unknown. A restart must not automatically clear the marker or silently retry a user action.

Only one application process on one machine may use the master at a time. A local exclusive lock can prevent accidental concurrent processes on that machine, but it cannot prevent a second machine from writing the same sheet. Google Sheets does not offer the conditional write needed to enforce a global single writer in this design. Operators must keep other instances stopped. This restriction and the bounded snapshot and API quotas make the design suitable only for a small hackathon demo.

## Sharing and visible data

Sheet editors can access all visible organization data in that spreadsheet and can alter or delete tabs and encrypted master cells. The shared `HURIZA data` tab is a bounded, automatically refreshed view of all demo organizations; it is not the authoritative master. Hiding the master tab does not make it private. Encryption protects the master snapshot from readers without the key; it does not stop editors from damaging or replaying ciphertext. Personal saved goals must follow the person's selected organization destination. Sheet access should be limited to people who may see everything exported there. Passwords, encryption keys and session data must never be written into visible exports.

## Outstanding work

- Implement an operator reconciliation procedure for interrupted writes.
- Verify account creation, organization roles, personal destination selection, financial transactions and visible organization exports against the live demo.
- Test quota, size, interrupted-write and restart behavior, and run the required financial/security tests, typecheck and build.
- Confirm complete browser signup and group submission with the user; the live encrypted master and readable shared view have been checked. Do not deploy externally without founder authorization.
