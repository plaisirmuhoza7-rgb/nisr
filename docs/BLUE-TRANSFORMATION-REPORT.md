# HURIZA blue transformation report

25 October 2026. Implemented in the existing repository with Sol integrating three Luna agents. No external publication or deployment.

## Delivered surfaces

- **Homepage:** new blue identity, sticky accessible navigation, community photography, personal-device preview, five workspace sections, Itsinda/Ikimina diagrams, deterministic Guardian example, interactive USSD device, sourced NISR indicators, trust content and complete footer.
- **Guided demo `/demo`:** switch among all five synthetic product previews; change a proposed loan and see the real scenario engine respond; navigate a local USSD menu. `?workspace=personal|groups|fundraising|cooperative|impact` selects the initial preview.
- **Accounts:** five signup purposes, personal details, password validation, Firebase email verification, safe continuation, recovery and error states. Purpose is a navigation hint and never a privileged role.
- **Savings groups:** model selection and the existing create/join services remain connected. The browser walkthrough created a fictional Itsinda with an empty treasury. Join input now accepts the API's full 24-character invitation code. Review amounts distinguish contributions per period from full-cycle savings.
- **Organization onboarding `/app/onboarding`:** verified accounts can save a Fundraising, Cooperative or NGO request. New migration 005 and `/api/onboarding` store requests under the server-derived tenant and user. Input cannot specify a user, tenant or role; requests never create memberships.
- **Application:** shared blue tokens, authorized workspace switcher, refreshed cards/tables/forms, usable mobile drawer, focus restoration, scoped role badges, Guardian scenario calculator and readable state colors.
- **Public evidence and information:** consistent Insights, Methodology and Solutions styles; real About, Contact, Privacy and Terms destinations. Contact details and operational policies are not invented.

## Main implementation files

| Workstream | Files |
| --- | --- |
| Luna landing | `src/app/page.tsx`, `src/app/landing.module.css`, `src/components/landing-navigation.*` |
| Luna accounts | `src/components/auth-screen.*`, `src/app/signup/page.tsx`, `src/components/savings-groups-setup.*`, `src/app/info.module.css` |
| Luna previews and information | `src/components/product-preview.*`, `src/components/ussd-demo.*`, `src/components/public-information.*`, four public information routes |
| Sol integration | `src/app/workspace-theme.css`, root layout, `huriza-app.tsx`, `guided-demo.*`, `/demo`, verified continuation, group-entry shell, onboarding request page/component/API/service/migration, access and onboarding security tests |

The exact shared palette is primary `#4A90E2`, deep `#2463A6`, navy `#14283F`, light `#EAF3FE`, pale `#F5F9FF`, canvas `#F8FAFC`, text `#162437`, muted `#64748B`, and border `#E3EBF4`. Small white-text primary buttons use deep blue for readable contrast.

## Verification

- **46 automated tests passed:** financial posting invariants, provider outcomes/idempotency, tenant and member privacy, role permissions, both savings models, integer Guardian calculations, safe onboarding redirects and request authorization.
- **18 Firebase emulator integration checks passed:** separate accounts, verified email, role-spoof rejection, personal privacy, organization authorization, independent officer approvals, logout, disabled users, synthetic financial flows and public routes.
- TypeScript and an optimized Webpack production build passed. The isolated build command is `$env:HURIZA_NEXT_DIST='.next-blue-verified'; npm run build -- --webpack`. Initial sandbox runs hit generated-directory permissions; the verified run completed outside that sandbox.
- All twelve public destinations returned HTTP 200: `/`, `/signup`, `/login`, `/forgot-password`, `/demo`, `/insights`, `/methodology`, `/solutions`, `/about`, `/contact`, `/privacy`, and `/terms`.
- Homepage overflow checks passed at **375, 430, 768 and 1440 pixels**. Representative authentication, group setup, request receipt, dashboard and navigation screens were visually inspected.
- Browser signup rejected mismatched passwords and unverified email, retained the selected group destination, completed verification against a fictional emulator account, and reached group onboarding.
- Browser group creation saved a fictional Itsinda and opened its zero-balance treasury. Native date controls were committed before submission. Both model choices and the full invitation-code input were checked.
- A submitted NGO onboarding request persisted after reload. Visiting Impact afterward returned the user to their authorized personal workspace rather than granting access.
- Public demo workspace switching and Guardian comfortable/reserve-breach examples worked. USSD savings, loan simulation, repayment simulation, invalid choice, back, exit and restart were exercised. All public phone interactions remain local to the page.
- Mobile navigation Escape handling, focus restoration and body-scroll restoration worked on public and authenticated drawers.

## Screenshots

Saved under `artifacts/blue-transformation/`:

- `home-desktop-1440.jpg` and `home-full-1440.jpg`
- `home-mobile-375.jpg` and `home-tablet-768.jpg`
- `signup-purposes-375.jpg` and `signup-verification-375.jpg`
- `group-models-430.jpg`
- `organization-request-768.jpg`
- `personal-dashboard-1440.jpg`
- `mobile-navigation-375.jpg` and `workspace-navigation-375.jpg`

## Photography

The local hero image is **Itsinda**, by **Endikuemmy**, published under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The [source file page](https://commons.wikimedia.org/wiki/File:Itsinda.jpg) describes a Rwandan beadwork cooperative. It is used as community context, not as a photograph of HURIZA users, a savings transaction, or a partner. Visible credits, a local license notice and [asset provenance](VISUAL-ASSETS.md) document resizing/cropping and the license. The optimized WebP is 152,542 bytes and is served through Next Image.

## Remaining operational limits

- Organization requests are saved as submitted. An active reviewer queue, approval timeline and production organization-provisioning workflow are not implemented.
- Group invitations remain limited to the same demo environment/tenant under the existing financial architecture.
- Kinyarwanda financial wording requires review. English remains the implemented language; greeting examples are explicitly marked for review.
- *700# is proposed and not a live registered shortcode. USSD/MoMo transactions remain simulated; no real money is sent.
- Verification used the local Firebase Authentication Emulator. Live credentials, production PostgreSQL, provider integration, final operational policies and deployment authorization remain separate production work.
