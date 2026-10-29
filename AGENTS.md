# HURIZA engineering instructions
Execute authorized work end-to-end without routine confirmation. Preserve existing work.
Sol owns architecture, financial logic and integration; Luna handles bounded independent tasks.
Use Next.js App Router, TypeScript and PostgreSQL; local PGlite is embedded PostgreSQL, not a production multi-process database.
All money uses safe integer RWF and BigInt intermediate arithmetic. No floating point ledger math.
Authorize in server services, scope every financial query by demo environment and organization.
Never edit posted journal records. Reverse them. Provider success precedes posting; callbacks are idempotent.
All synthetic transactions and USSD/MoMo operations must be labeled. Never send real money.
Never invent NISR findings or imply synthetic records establish impact.
Run meaningful financial/security tests, typecheck and build before reporting verified milestones.
Do not publish or deploy externally under this directive without founder authorization.
See docs/CONTRACTS.md for current shared interfaces and file ownership.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
