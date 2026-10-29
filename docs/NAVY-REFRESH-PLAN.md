# Navy interface refresh — 27 October 2026

## Design direction

Use the existing HURIZA blue, supported by deep navy (`#10243f` / `#14283f`), restrained medium blue, warm white and muted slate. Create contrast through selective dark sections, structured cards and good spacing. Keep text readable, controls accessible and mobile layouts intentional. Use visible designed image placeholders so the founder can add their own photography.

## Six bounded Luna assignments

1. **Homepage composition:** `src/app/page.tsx` and `src/app/landing.module.css`. Replace the current photo with a placeholder, reduce repeated dashboard mockups to one or two genuinely useful previews, and redesign the five solutions as clear, varied cards. Preserve the real links, Guardian, savings models, evidence and USSD disclosure.
2. **Navigation and public information:** `src/components/landing-navigation.*`, `src/components/public-information.module.css`, and `src/app/info.module.css`. Refine navigation, footer-adjacent and evidence page styling using the same navy hierarchy; preserve routes and accessible drawer behavior.
3. **Finance and savings planner:** new `src/components/finance-planning.tsx` and `finance-planning.module.css`. Export a default interactive component with no required props for the homepage. It provides a clearly labeled local-only savings projection using the existing `savingsPlan` integer calculation; no account, ledger, provider or financial mutation. Validate safe integer RWF and periods. Include links to the real personal workspace and group model flow.
4. **Dashboard visual polish:** `src/app/workspace-theme.css` and `src/components/workspace-access.module.css` only. Introduce restrained navy accents and polished surfaces, keeping semantics, responsive layouts and existing selectors intact.
5. **Account and group setup polish:** `src/components/auth-screen.module.css` and `src/components/savings-groups-setup.module.css` only. Improve navy composition, card hierarchy and mobile legibility without changing authentication or group logic.
6. **Independent quality review:** read-only review of the combined interface and components for accessibility, small-screen overflow, misleading claims, broken routes, and privacy/security regressions. Report actionable issues to Sol; do not edit financial/auth/server code.

## Integration contract

Sol owns overall composition, `src/lib`, financial services, APIs, security and final testing. The homepage agent may import `FinancePlanning` from `@/components/finance-planning` while the component is created. Existing ProductPreview and UssdDemo public APIs stay unchanged. Synthetic figures must be labeled; group models remain distinct; no actual money, new privilege grants, or invented NISR findings. Work in two waves because the session has three concurrent subagent slots. Run financial/security tests, typecheck, build, and representative browser checks after integrating.
