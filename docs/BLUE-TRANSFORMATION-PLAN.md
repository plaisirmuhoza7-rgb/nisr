# HURIZA blue transformation execution plan

Date: 25 October 2026. Founder request: implement the supplied premium fintech blueprint in the existing application, using Luna agents for bounded UI tasks. No external deployment.

## Shared design contract

Palette: primary #4A90E2, deep #2463A6, navy #14283F, light #EAF3FE, pale #F5F9FF, white #FFFFFF, canvas #F8FAFC, text #162437, muted #64748B, border #E3EBF4. Root owns globals and publishes --blue, --blue-deep, --navy, --blue-soft, --canvas, --ink, --muted, --line. Use local CSS modules for assigned components. Respect reduced motion and keyboard focus. Keep synthetic money and proposed USSD labels visible.

## Parallel ownership

- Sol/root: shared globals, application dashboard, server/auth/access/financial integration, /demo, /about, /privacy, /terms, /contact, build configuration if needed, evidence and final QA. Preserve financial behavior; never delegate ledger changes to visual agents.
- Luna landing: src/app/page.tsx and src/app/landing.module.css only. Full homepage composition, accessible navigation, five solutions, model explanations, deterministic Guardian preview, evidence, trust and footer. May add src/components/landing-navigation.tsx and its CSS module. No shared globals/auth/server edits.
- Luna onboarding: src/components/auth-screen.tsx and auth-screen.module.css; src/app/signup/page.tsx; src/components/savings-groups-setup.tsx and savings-groups-setup.module.css only. Purpose selection before signup, preserve Firebase verification and server authorization, preserve intended destination across verification. Polish existing group model wizard. No financial/server edits.
- Luna previews: src/components/product-preview.tsx and product-preview.module.css; src/components/ussd-demo.tsx and ussd-demo.module.css only. Self-contained reusable previews and public interactive USSD simulation.

## Shared interfaces and destinations

- ProductPreview default export: ({workspace, compact?}: {workspace: 'personal'|'groups'|'fundraising'|'cooperative'|'impact'; compact?: boolean}). Pure presentational component; clearly labeled synthetic examples, no authentication or data reads.
- UssdDemo default export: () => JSX.Element. Client component. Interactive synthetic menu, reply/back/cancel/restart, no real money and no external telecom calls. English; label Kinyarwanda as a review target rather than invent finalized translations.
- Public guided demo /demo. Guardian deep link /demo#guardian; USSD /demo#ussd; group creation /app/groups/start (existing verified sign-in guard). Auth purpose URL /signup?workspace=personal|groups|fundraising|cooperative|impact. Organization choices are intent only, never role grants.
- Homepage may import ProductPreview and UssdDemo from their named component paths while the preview agent builds them.
- Public company destinations /about, /contact, /privacy, /terms are owned by root. Do not invent company contacts, social profiles, registered shortcode, partner logos, or NISR endorsement.
- Evidence comes from data/insights.json and documented source pipeline. Public photos must have documented rights; use a designed and explicitly flagged replacement slot if authentic licensed photography is unavailable.

## Sequence and acceptance

1. Establish interfaces, delegate bounded work, inspect actual supported functionality.
2. Implement shared tokens/dashboard and guided demo while Luna agents implement their owned surfaces.
3. Integrate intended onboarding destinations and verify group model flow against actual APIs. Do not claim model operations exist unless confirmed.
4. Check all CTAs and disclosures. Review at 375, 430, 768 and 1440 pixels using available browser tooling; capture screenshots and fix defects.
5. Run financial/security tests, typecheck and production build. Report exact results and remaining limitations, including Firebase configuration or photography review requirements.

Status: all three Luna implementation workstreams integrated. Financial/security tests, Firebase emulator integration, production build and representative browser QA passed. See BLUE-TRANSFORMATION-REPORT.md for delivered pages, screenshots and explicit operational limits.
