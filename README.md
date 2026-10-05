# TraceForge UI

Next.js App Router + TypeScript public provenance viewer for TraceForge v0.30.
This is the separate `traceforge-ui` repository, mounted at `ui/` in the root
project as a Git submodule. The configured remote is
`https://github.com/aididalam/traceforge-ui.git`; remote creation/publication is
pending. The verified implementation and commits currently exist locally.

## Phase 1

- `/`: approved-origin trace-link lookup or validated tenant/entity ID entry.
- `/trace/:tenantId/:entityId`: current public state, custodian organization ID,
  recorded dates, ordered history and copyable provenance hashes.
- Explicit cursor pagination preserves decimal IDs above `2^53` using strings
  and BigInt. Nullable labels and empty/closed records are supported.
- Loading, invalid, missing/unpublished, rate-limited and unavailable states.
  Publication revocation clears loaded data. Returning to a hidden/restored
  page revalidates; a known `Retry-After` blocks immediate requests.
- Responsive layout, semantic controls, keyboard focus, skip link and
  reduced-motion support. Automated axe checks cover core public states.

QR generation/scanning and operator login/write screens are subsequent phases.
Only explicitly published public API data is displayed. There is no production
demo fallback: an unpublished or nonexistent entity stays unavailable.

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
| `NEXT_PUBLIC_API_BASE_URL` | Empty uses the app's two same-origin public GET handlers. An external HTTPS API origin requires its own explicit CORS policy. |
| `NEXT_PUBLIC_SITE_ORIGIN` | Optional approved canonical HTTPS site origin for pasted trace links and future QR generation. Empty uses the current page origin. |
| `TRACEFORGE_PUBLIC_API_ORIGIN` | Credential-free server API origin for the GET gateway. Required in production. Development defaults to `http://127.0.0.1:3000`. |

All origins reject credentials, path prefixes, queries and fragments. Public
configuration permits loopback HTTP in development only. The server upstream
permits HTTP loopback for a colocated private API, and requires HTTPS otherwise.
Public variables are embedded at build time; rebuild after changing them.
Never put operator credentials in this app's environment or browser storage.

Production build and local production server:

```bash
NEXT_TELEMETRY_DISABLED=1 npm run build
TRACEFORGE_PUBLIC_API_ORIGIN=http://127.0.0.1:3000 NEXT_TELEMETRY_DISABLED=1 npm start
```

The server binds loopback port 3100. Hosting/HTTPS, CSP, deployment automation
and a measured proxy rate-limit strategy are later delivery work. The current
Fastify rate limiter sees requests through this gateway as one source IP and
shares its 120/minute budget. Do not static-export this app: its two public GET
handlers need a Next Node runtime.

## Request and privacy boundary

The browser uses only:

```text
GET /public/v1/tenants/:tenantId/entities/:entityId
GET /public/v1/tenants/:tenantId/entities/:entityId/history?afterEventId=0&limit=50
```

Requests omit cookies and Authorization, disable caching/redirects, and have
abort signals and ten-second timeouts. By default, Next's two fixed GET handlers
forward these requests to the public API with no incoming cookies, credentials
or forwarding headers. Client and gateway both validate strict response
allowlists and identity/cursor consistency. Unexpected fields fail closed;
upstream error bodies and Set-Cookie headers never pass through the gateway.

There are no document/operator/write/RPC calls, SQL connections, private keys,
wallets, session/token storage, service workers or persistent provenance caches.
Provenance is loaded in browser memory, never in a cached server-component
payload. Entity publication does not make metadata/evidence documents public.
Hashes and recorded claims do not independently verify physical authenticity.

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
rejection. They use no live API, DB rows, tokens, keys or blockchain writes.
Keep ports 4178 and 4202 free. Screenshots/traces are generated in ignored
`test-results/`; servers shut down when the suite ends.

Run `npm run verify` for typecheck, build, unit and browser checks together
after Chromium is installed. Root CI installs Chromium and runs these checks
with synthetic fixtures; no MySQL/Besu credentials are needed.

The root project maintains `docs/roadmap.md` and `docs/ui-architecture.md` for
the numbered delivery phases and future operator/QR boundaries.
