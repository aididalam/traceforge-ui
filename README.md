# TraceForge UI

Next.js App Router + TypeScript product tracking interface for TraceForge v0.30.

## Parent project

This repository is the `ui/` submodule of
[TraceForge](https://github.com/aididalam/traceforge).
See the parent repository for all components, architecture and setup.
The separate UI repository is [traceforge-ui](https://github.com/aididalam/traceforge-ui).

## Public product tracking

- `/`: one lookup input accepting a short/full Tracking ID or exact business
  product/batch ID search, with optional originating-business code and bounded
  duplicate-result selection.
- `/s/:shortCode`: shareable 12-character product link, with copyable code/link;
  uses the same product details and supply history without redirecting.
- `/track/:trackingId`: full single-ID product tracking; resolves the
  global public ID before fetching current state and history.
- `/trace/:tenantId/:entityId`: current public state, custodian organization ID,
  recorded dates, ordered history and copyable provenance hashes.
- Explicit cursor pagination preserves decimal IDs above `2^53` using strings
  and BigInt. Nullable labels and empty/closed records are supported.
- Loading, invalid, missing/unpublished, rate-limited and unavailable states.
  Publication revocation clears loaded data. Returning to a hidden/restored
  page revalidates; a known `Retry-After` blocks immediate requests.
- Responsive layout, semantic controls, keyboard focus, skip link and
  reduced-motion support. Automated axe checks cover core public states.

The business dashboard implements signup, product creation, QR generation/scanning,
source selection, quantity receipt and owned-stock removal with a reason.
Only explicitly published public API data is displayed. There is no production
demo fallback: an unpublished or nonexistent entity stays unavailable.

## Public wording

Consumer screens use product tracking, current status, current holder and
product history. Known technical event labels are translated into familiar
phrases, and CamelCase business labels are spaced for reading. Labels remain
plain text; the API data and meaning of custom business labels are preserved.

The Tracking ID stays visible. Internal identifiers and supporting-information
references are available inside closed “Reference details” and “Update
references” sections. Displayed update numbers indicate their position in the
shared history; full saved IDs remain in the expanded references. Missing names
and out-of-range dates are described plainly, with original values preserved
under references. No holder names, document contents or verification claims
are invented from IDs. Public sharing boundaries remain explicit.

## Local development

Use Node 22.13+ within the Node 22 release line, or Node 24+. CI uses Node 22.
From this repository:

```bash
npm ci
cp .env.example .env.local
NEXT_TELEMETRY_DISABLED=1 npm run dev
```

Open `http://127.0.0.1:3100`. The public gateway defaults to an existing API at
`http://127.0.0.1:3000` in development. Start/configure that API separately; this
app does not start MySQL, the indexer, Besu, or an operator signer. A real local
record must be explicitly published through the existing API publication CLI
before it can appear. Publication is an operator action, not part of UI startup.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Empty uses the app's fixed same-origin public GET handlers. An external HTTPS API origin requires its own explicit CORS policy. |
| `NEXT_PUBLIC_SITE_ORIGIN` | Optional canonical HTTPS site origin for QR generation. Empty uses the current page origin. |
| `TRACEFORGE_PUBLIC_API_ORIGIN` | Credential-free server API origin for the GET gateway. Required in production. Development defaults to `http://127.0.0.1:3000`. |

All origins reject credentials, path prefixes, queries and fragments. Public
configuration permits loopback HTTP in development only. The server upstream
permits HTTP loopback for a colocated private API, and requires HTTPS otherwise.
Public variables are embedded at build time; rebuild after changing them.
Never put operator credentials in public environment variables or browser storage.
Operator login credentials are handled only by the separate session gateway.

Production build and local production server:

```bash
NEXT_TELEMETRY_DISABLED=1 npm run build
TRACEFORGE_PUBLIC_API_ORIGIN=http://127.0.0.1:3000 NEXT_TELEMETRY_DISABLED=1 npm start
```

The server binds loopback port 3100. Hosting/HTTPS, CSP, deployment automation
and a measured proxy rate-limit strategy are later delivery work. The current
Fastify rate limiter sees requests through this gateway as one source IP and
shares its 120/minute budget. Do not static-export this app: its public GET
handlers need a Next Node runtime.

## Request and privacy boundary

The browser uses only:

```text
GET /public/v1/products/search?id=...&businessCode=...&after=0&limit=50
GET /public/v1/products/:trackingId/quantity
GET /public/v1/products/:trackingId/routes?after=0&limit=50
GET /public/v1/products/:trackingId/holders?after=0x...&limit=50
GET /public/v1/tracking/:trackingId
GET /public/v1/short-links/:shortCode
GET /public/v1/tenants/:tenantId/entities/:entityId
GET /public/v1/tenants/:tenantId/entities/:entityId/history?afterEventId=0&limit=50
```

Requests omit cookies and Authorization, disable caching/redirects, and have
abort signals and ten-second timeouts. By default, Next's fixed public GET handlers
forward these requests to the public API with no incoming cookies, credentials
or forwarding headers. Client and gateway both validate strict response
allowlists and identity/cursor consistency. Unexpected fields fail closed;
upstream error bodies and Set-Cookie headers never pass through the gateway.

A short-code lookup resolves the global ID and internal pair in one request,
then uses the existing public detail/history endpoints: three initial GETs,
the same as a full-ID lookup for legacy records. Batch views add a bounded
holder read; available receipt pages load after the user chooses to inspect them.
Codes are case-insensitive on input and displayed
in lowercase. The short page keeps the full Tracking ID in Reference details.
Copy tracking link uses this page's origin and validated `/s/<code>` path.
Refresh resolves again and hides unavailable/revoked records. Migration 007 is applied to the fresh local database. See
[short-link design](https://github.com/aididalam/traceforge/blob/main/docs/public-short-links.md).

The public tracking flow has no document/operator/write/RPC calls, SQL connections, private keys,
wallets, session/token storage, service workers or persistent provenance caches.
Provenance is loaded in browser memory, never in a cached server-component
payload. Entity publication does not make metadata/evidence documents public.
Hashes and recorded claims do not independently verify physical authenticity.

The main view presents separately shared product details, the current business
name and dated supply history. Event dates come from recorded Unix seconds and
include UTC; missing/out-of-range dates and missing names have plain-language
fallbacks. IDs remain available in expandable references. Product/business
display details are a reviewed API projection, not complete document bodies.
They are suppressed when their indexed metadata references change. See the
parent project's [public-details contract and activation](https://github.com/aididalam/traceforge/blob/main/docs/public-product-details.md).

## Verification

```bash
npm run typecheck
npm run build
npm test
npx playwright install chromium
TRACEFORGE_BROADCAST_ENABLED=false npm run test:e2e
npm run audit:production
```

Unit tests exercise URL validation, privacy allowlists, decimal cursor
precision, errors, cancellation and the GET gateway. Playwright runs desktop
Chromium and a Pixel 7 Chromium profile against a production Next server on
port 4178 plus an owned synthetic HTTP fixture server on port 4202. Tests
cover real gateway round trips, keyboard/clipboard/axe behavior, pagination,
revocation, visibility refresh, rate limits, invalid inputs and private-field
rejection, public product fields, business names, transfer participants and
event dates. They use no live API, DB rows, tokens, keys or blockchain writes.
Short-link checks also cover code input/copying, exact cursors, separate
workspaces, revocation, strict response validation and forbidden redirect targets.
Keep ports 4178 and 4202 free. Screenshots/traces are generated in ignored
`test-results/`; servers shut down when the suite ends.

Run `npm run verify` for typecheck, build, unit and browser checks together
after Chromium is installed. Root CI installs Chromium and runs these checks
with synthetic fixtures; no MySQL/Besu credentials are needed.

The root project maintains `docs/roadmap.md` and `docs/ui-architecture.md` for
the delivery phases and public/operator boundaries.

## Business dashboard

`/operator` opens the authenticated overview. `/operator/sign-in` supports
independent business registration and email/password sign-in. The form does not
require or offer invitations. Product inventory and history span products your
business created, currently holds or previously handled across producers.

Business type uses a searchable React Select Creatable picker. Choose a predefined
type, or enter your own type (1–120 characters) and select “Use”. Custom types such
as customs brokers, repair workshops and recyclers are supported. Selection is
required, and clearing the picker requires choosing a type again. The gateway
and API both accept custom types and reject blank, oversized or invalid input. Business type is descriptive and
does not restrict receiving products from other registered businesses.

Public tracking and dashboard pages use locally bundled Bootstrap 5.3.8 CSS,
standard form controls, buttons and checkboxes. React handles interactions;
Bootstrap JavaScript and CDN requests are not needed. The shared stylesheet
uses a neutral palette, system font, visible focus indicators and readable
labels across desktop and mobile.

Businesses add products in their own production workspace, explicitly choose
public sharing and download a QR. `/operator/receive` accepts a Tracking ID,
short code, approved tracking URL or camera QR. Scanning only previews the
product. Confirm physical receipt to immediately change its current holder;
there is no sender proposal or receiving workspace role. Current holders remove
products from the supply chain when delivered to a customer, lost, damaged or
disposed. Removed products stay readable. Status badges use **In supply chain**
(success) and **Out of supply chain** (info).

Overview shows business statistics and product summaries. The Products page has
an Add product link opening the separate `/operator/products/new` form.
The business sidebar is fixed on desktop and collapses behind a menu button on
mobile. Duplicate business/workspace names are shown once. Product information
displays decoded metadata as labeled rows. Histories show each physical action
once, while the API preserves all raw audit logs.

The Add product form supports dynamic additional details: add/remove fields,
choose each label and text value, and save them with the product as JSON. Up to
32 unique fields are supported. Product details show the saved values exactly;
public sharing explicitly includes the additional fields. Duplicate/blank names,
blank values, unexpected properties and oversized input are rejected by both
the gateway and API. Add a Description field when needed; there is no separate
description textarea. Existing product descriptions remain readable.

This client is separate from public tracking. Its fixed `/operator/api/*`
handlers call the API's `/operator/v1/*` routes. API session credentials stay in
server memory; the browser gets an opaque HttpOnly, SameSite=Strict cookie
(Secure and `__Host-` prefix on HTTPS). State-changing requests require the
configured site's exact Origin. Responses and browser fetches use no-store.
The API checks active account and business identity on every read and restricts
product/history access to products that business has handled. Production
workspace roles protect creating and editing; receipt and close use global
business identity, current holder and terminal-state checks.
There is no unrestricted service credential or browser signing.

| Server variable | Purpose |
| --- | --- |
| `TRACEFORGE_OPERATOR_API_ORIGIN` | Fixed credential-free API origin; required in production. Loopback HTTP is supported for a colocated API, HTTPS elsewhere. |
| `TRACEFORGE_OPERATOR_SITE_ORIGIN` | Exact browser HTTPS origin for Origin/CSRF checks; local loopback HTTP is supported. Required for a deployed non-loopback site. |

The session store currently supports a single Next Node process and at most
1,000 active browser sessions. Restarting Next signs users out. A shared session
store, HTTPS deployment and proxy rate-limit/load checks are required before
multi-instance hosting. Sessions expire after 30 minutes; restored/hidden views
revalidate and clear revoked records. No passwords, API credentials or private
records are persisted in localStorage/sessionStorage.

API migrations 008–009 are applied locally. The API registers business wallets
and production workspaces on chain; wallet keys remain in its owner-only server
directory and never reach this app. See the parent project's
[business dashboard guide](https://github.com/aididalam/traceforge/blob/main/docs/operator-dashboard.md).


## Batch UI addition — 2026-10-06

The product form requires the business's product/batch ID, offers a Batch product
checkbox and quantity, and preserves dynamic JSON details. Optional signup
business codes appear in the profile and can be applied to printed references
through an explicit suggestion. External-ID search handles duplicates; receipts
select an exact available source and amount, while removal uses only owned
stock and records Sold/Lost/Damaged/Spoiled/Disposed/Other with an explanation.
Global, per-business and owned availability remain separate. Public tracking
shows quantity totals, consented holders, available receipt paths and reasons.
Pending writes reuse the same frozen payload/key; confirmed creation prints the
returned short-code QR. Legacy whole-item records remain readable.

The new fixed operator GET routes cover product search/routes/holders, and POST
`/operator/api/products/:id/remove` handles versioned quantity removal. Public
product routes remain token-free. All responses use strict allowlists and
pagination checks. See the parent project's
[Phase 4 implementation and evidence](https://github.com/aididalam/traceforge/blob/main/docs/batch-ui-phase4.md).

43 unit tests and 104 desktop/mobile fixture checks pass. The additional
[Phase 5 acceptance](https://github.com/aididalam/traceforge/blob/main/docs/batch-integration-phase5.md)
uses real desktop/mobile browsers against a disposable contract, MySQL
projection and API; it verifies complete single/batch flows, returns, reasons,
private lookup and large-cursor history pagination. Run it through
`TRACEFORGE_TEST_UI=true npm run test:direct-claim` in the parent API submodule
after building contracts, indexer, API and UI and installing Chromium. The
integration configuration uses `integration-results/`, separate from fixture
artifacts, and requires the API runner's synthetic manifest. Phase 6
deployment/migration remains pending; the running
Pi services retain the previous whole-product deployment until activation.
To verify alongside an existing UI server, set `TRACEFORGE_UI_DIST_DIR=.next-phase4`
for both `npm run build` and `npm run test:e2e`; default builds use `.next`.
