# Security boundaries

## Account identity and access

- Firebase Authentication supplies identity. The application accepts only a fresh Firebase ID token in `POST /api/session`; the server verifies the token, revocation state and verified email before issuing an eight-hour HttpOnly session cookie.
- The server stores a SHA-256 digest of each session cookie and checks the matching database row and Firebase session on each authenticated request. Sign-out invalidates the server row and clears the cookie. The browser also signs out of Firebase.
- Firebase UID is the account ID. Roles, tenant IDs, organization memberships and workspace access come from server-managed PostgreSQL records. Public registration cannot choose a role, tenant or organization membership; a new account receives an empty personal tenant.
- Organization access is granted only through trusted provisioning. Route guards, workspace state, exports, and financial services verify access server-side and scope queries by tenant and organization. UI filtering is only presentation; it is not an authorization boundary.
- Production Firebase project configuration is not set yet. The local Authentication Emulator requires a `demo-` project ID and loopback host. Never point the emulator seed script at a live project.

## Application and financial protections

- Mutation routes require JSON and a same-origin `Origin` host matching `Host`. This blocks cross-origin forms and fetches; it is not a substitute for a distributed production rate limiter.
- Zod schemas and financial validators reject malformed inputs. SQL parameters prevent interpolation of user values. API errors suppress unexpected database details.
- Financial services check trusted account role, tenant, organization and actual membership in transactional operations. NGO aggregate views do not expose member rows. Personal projections are scoped to the signed-in user.
- Organization row locks, idempotent provider references, immutable journals and cash holds protect monetary operations. Provider outcomes remain simulated; no real provider callback or payment integration is configured.
- Database constraints and triggers protect journal balance and immutability. Audit hash chains can help detect modifications, but they are not externally anchored and database administrators remain trusted.
- All seeded identities, names, program histories, payments and obligations are fictional. No real beneficiary, donor, financial-provider or live Firebase credentials are required for local verification.
- Security headers deny framing and MIME sniffing and restrict camera, microphone and geolocation. No external telemetry or LLM service is configured.

## Before real customer use

Configure and review the live Firebase project, verify account recovery and operational ownership, add durable rate limits and monitoring, define tenant provisioning and data lifecycle, establish backups and incident response, verify authentic provider events and reconcile settlements, and complete privacy, consent, independent security and regulatory reviews. This prototype is not represented as a licensed deposit-taking, lending, payment or credit-bureau service.

Report issues privately to the project owner. There is no published security contact or bounty program yet.
