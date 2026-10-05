import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiPath, entity, entityId, history, makeEvents, tenantId, traceUrl, unknownId, tracking, trackingId, trackingUrl, trackingApiPath, otherTrackingId, otherTenantId } from "./fixtures";

test("lookup offers only Tracking ID and supports keyboard entry", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Every record has a journey." })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await expect(page.getByLabel("Tracking ID", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Tracking ID|Trace link|Entity IDs)$/ })).toHaveCount(0);
  await expect(page.getByLabel("Tenant ID", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Entity ID", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Trace link", { exact: true })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("lookup.png") });
  await page.getByLabel("Tracking ID", { exact: true }).fill("0x" + trackingId.slice(2).toUpperCase());
  await page.getByLabel("Tracking ID", { exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(trackingUrl + "$"));
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
});

test("production Next gateway shows only safe records without cookies or tokens", async ({ page, context, request }, testInfo) => {
  await context.addCookies([{ name: "synthetic_operator_session", value: "fixture-only", domain: "127.0.0.1", path: "/" }]);
  const apiRequests: { method: string; authorization: boolean; cookie: boolean; path: string }[] = [];
  page.on("request", item => {
    const path = new URL(item.url()).pathname;
    if (/^\/(public|v1|rpc)/.test(path)) apiRequests.push({ path, method: item.method(), authorization: Boolean(item.headers().authorization), cookie: Boolean(item.headers().cookie) });
  });
  await page.goto(traceUrl);
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recorded journey" })).toBeVisible();
  await expect(page.locator(".timeline-event")).toHaveCount(4);
  await expect(page.getByText("EVENT 9007199254740993", { exact: true })).toBeVisible();
  expect(apiRequests).toHaveLength(2);
  expect(apiRequests.every(item => item.method === "GET" && !item.authorization && !item.cookie && item.path.startsWith("/public/v1/"))).toBe(true);
  await page.locator(".timeline-event").first().getByText("Record details", { exact: true }).click();
  await expect(page.getByText("EntityCreated · Transaction index 0 · Log 0")).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy Entity ID", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(entityId);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("public-trace.png") });
  const upstream = await (await request.get("http://127.0.0.1:4202/__requests")).json();
  expect(upstream.every((item: { method: string; authorization: boolean; cookie: boolean }) => item.method === "GET" && !item.authorization && !item.cookie)).toBe(true);
});

test("gateway rejects POST and malformed IDs, with matching missing responses", async ({ request }) => {
  expect((await request.post(apiPath)).status()).toBe(405);
  expect((await request.get(apiPath.replace(tenantId, "bad"))).status()).toBe(400);
  const one = await request.get(apiPath.replace(entityId, unknownId));
  const two = await request.get(apiPath.replace(tenantId, unknownId));
  expect(one.status()).toBe(404); expect(two.status()).toBe(404);
  expect(await one.json()).toEqual(await two.json());
  expect(one.headers()["cache-control"]).toBe("no-store");
});

test("cursor pagination remains exact above 2^53 without duplicate events", async ({ page }) => {
  const events = makeEvents(53);
  const cursors: string[] = [];
  await page.route("**/public/**", async route => {
    const url = new URL(route.request().url());
    const after = url.searchParams.get("afterEventId") ?? "0";
    if (url.pathname.endsWith("/history")) cursors.push(after);
    await route.fulfill({ json: url.pathname.endsWith("/history") ? history(events, after) : entity });
  });
  await page.goto(traceUrl);
  await expect(page.locator(".timeline-event")).toHaveCount(50);
  await page.getByRole("button", { name: "Load more events", exact: true }).click();
  await expect(page.locator(".timeline-event")).toHaveCount(53);
  expect(cursors).toEqual(["0", events[49].eventId]);
  await expect(page.getByRole("button", { name: "Load more events", exact: true })).toHaveCount(0);
  await expect(page.getByText("All currently available public events are loaded.")).toBeVisible();
});

test("revocation during load more clears the entire previous record", async ({ page }) => {
  await page.route("**/public/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/history") && url.searchParams.get("afterEventId") !== "0") return route.fulfill({ status: 404, json: { error: { code: "entity_not_found" } } });
    await route.fulfill({ json: url.pathname.endsWith("/history") ? history(makeEvents(53)) : entity });
  });
  await page.goto(traceUrl);
  await expect(page.locator(".timeline-event")).toHaveCount(50);
  await page.getByRole("button", { name: "Load more events", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Public trace unavailable" })).toBeVisible();
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
  await expect(page.getByText(entityId, { exact: true })).toHaveCount(0);
});

test("returning to a hidden page revalidates publication", async ({ page }) => {
  let revoked = false;
  await page.route("**/public/**", async route => route.fulfill(revoked ? { status: 404, json: {} } : { json: route.request().url().includes("/history") ? history() : entity }));
  await page.goto(traceUrl);
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator("[data-public-record]")).toBeHidden();
  revoked = true;
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByRole("heading", { name: "Public trace unavailable" })).toBeVisible();
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
});

test("rate limited reads honor Retry-After and only retry after user action", async ({ page }) => {
  let ready = false;
  let count = 0;
  await page.route("**/public/**", async route => {
    count += 1;
    await route.fulfill(ready ? { json: route.request().url().includes("/history") ? history() : entity } : { status: 429, headers: { "Retry-After": "1" }, json: {} });
  });
  await page.goto(traceUrl);
  await expect(page.getByRole("heading", { name: "A short pause" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeEnabled();
  expect(count).toBe(2);
  ready = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
});

test("pagination rate limits also block refresh and restored-page requests", async ({ page }) => {
  let count = 0;
  await page.route("**/public/**", async route => {
    count += 1;
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/history") && url.searchParams.get("afterEventId") !== "0") {
      return route.fulfill({ status: 429, headers: { "Retry-After": "3" }, json: {} });
    }
    await route.fulfill({ json: url.pathname.endsWith("/history") ? history(makeEvents(53)) : entity });
  });
  await page.goto(traceUrl);
  await expect(page.locator(".timeline-event")).toHaveCount(50);
  await page.getByRole("button", { name: "Load more events", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A short pause" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh record" }).click();
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();
  expect(count).toBe(3);
});

test("empty history and null labels are readable without inferred product data", async ({ page }) => {
  const unknown = { ...entity, entityTypeLabel: null, currentStateLabel: null, closed: true, closedAt: "1790000120" };
  await page.route("**/public/**", async route => route.fulfill({ json: route.request().url().includes("/history") ? { ...history([]), entity: unknown } : unknown }));
  await page.goto(traceUrl);
  await expect(page.getByRole("heading", { name: "Entity provenance" })).toBeVisible();
  await expect(page.getByText("Closed entity", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No public history yet" })).toBeVisible();
});

test("malformed route IDs cause zero API calls and an accessible invalid state", async ({ page }) => {
  let requests = 0;
  await page.route("**/public/**", async route => { requests += 1; await route.abort(); });
  await page.goto(`/trace/bad/${entityId}`);
  await expect(page.getByRole("heading", { name: "This trace link is invalid" })).toBeVisible();
  expect(requests).toBe(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("untrusted long labels remain plain text and reflow at 320px", async ({ page }) => {
  const label = "<img src=x onerror=window.__synthetic_injection=1>" + "A".repeat(160);
  const record = { ...entity, entityTypeLabel: label, currentStateLabel: "S".repeat(255), createdAt: "18446744073709551615" };
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/public/**", async route => route.fulfill({ json: route.request().url().includes("/history") ? { ...history([]), entity: record } : record }));
  await page.goto(traceUrl);
  await expect(page.getByRole("heading", { name: label + " provenance", exact: true })).toBeVisible();
  await expect(page.getByText("Unix seconds 18446744073709551615", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => Reflect.get(window, "__synthetic_injection"))).toBeUndefined();
  expect(await page.locator("[data-public-record] img").count()).toBe(0);
});

test("loading, API failure and unexpected document data never render private fields", async ({ page }) => {
  let phase: "slow" | "leak" = "slow";
  await page.route("**/public/**", async route => {
    if (phase === "slow") { await new Promise(resolve => setTimeout(resolve, 350)); return route.fulfill({ status: 503, json: {} }); }
    return route.fulfill({ json: { ...entity, metadata_document: { private: "SYNTHETIC_PRIVATE_SENTINEL" } } });
  });
  await page.goto(traceUrl);
  await expect(page.getByRole("heading", { name: "Opening your trace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Records are temporarily unavailable" })).toBeVisible();
  phase = "leak";
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Records are temporarily unavailable" })).toBeVisible();
  await expect(page.getByText("SYNTHETIC_PRIVATE_SENTINEL")).toHaveCount(0);
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
});

test("lookup rejects malformed IDs and pasted URLs before any API request", async ({ page }) => {
  let externalRequests = 0;
  let apiRequests = 0;
  page.on("request", request => { if (new URL(request.url()).origin === "https://unapproved.example") externalRequests += 1; });
  await page.route("**/public/**", async route => { apiRequests += 1; await route.abort(); });
  await page.goto("/");
  for (const value of ["bad", "0x" + "gg".repeat(32), "https://unapproved.example" + trackingUrl]) {
    await page.getByLabel("Tracking ID", { exact: true }).fill(value);
    await page.getByRole("button", { name: "View public trace" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a complete Tracking ID" })).toContainText("0x followed by 64 hexadecimal characters");
    await expect(page).toHaveURL("http://127.0.0.1:4178/");
  }
  expect(externalRequests).toBe(0);
  expect(apiRequests).toBe(0);
});

test("one Tracking ID opens the real gateway and supports accessible copying", async ({ page, context }, testInfo) => {
  const calls: { path: string; method: string; auth: boolean; cookie: boolean }[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/public/")) calls.push({ path, method: request.method(), auth: Boolean(request.headers().authorization), cookie: Boolean(request.headers().cookie) });
  });
  await page.goto("/");
  await page.getByLabel("Tracking ID", { exact: true }).fill("0x" + trackingId.slice(2).toUpperCase());
  await page.getByLabel("Tracking ID", { exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(trackingUrl + "$"));
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
  await expect(page.locator(".timeline-event")).toHaveCount(4);
  expect(calls.map(call => call.path).sort()).toEqual([trackingApiPath, apiPath, apiPath + "/history"].sort());
  expect(calls.every(call => call.method === "GET" && !call.auth && !call.cookie)).toBe(true);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy Tracking ID", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(trackingId);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("single-id-trace.png") });
});

test("global tracking IDs distinguish the same Entity ID in two tenants", async ({ page }) => {
  await page.goto(trackingUrl);
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
  await page.goto("/track/" + otherTrackingId);
  await expect(page.getByRole("heading", { name: "Other tenant batch provenance" })).toBeVisible();
  await expect(page.getByText(otherTenantId, { exact: true })).toBeVisible();
});

test("tracking gateway rejects POST, invalid IDs and query tokens", async ({ request }) => {
  expect((await request.post(trackingApiPath)).status()).toBe(405);
  expect((await request.get(trackingApiPath.replace(trackingId, "bad"))).status()).toBe(400);
  expect((await request.get(trackingApiPath + "?token=synthetic")).status()).toBe(400);
  const hidden = await request.get(trackingApiPath.replace(trackingId, unknownId));
  expect(hidden.status()).toBe(404);
  expect(hidden.headers()["cache-control"]).toBe("no-store");
  expect(await hidden.json()).toEqual({ error: { code: "entity_not_found", message: "Entity was not found." } });
});

test("unknown or invalid Tracking IDs never query entity/history routes", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/public/")) calls.push(request.url()); });
  await page.goto("/track/bad");
  await expect(page.getByRole("heading", { name: "This trace link is invalid" })).toBeVisible();
  expect(calls).toHaveLength(0);
  await page.goto("/track/" + unknownId);
  await expect(page.getByRole("heading", { name: "Public trace unavailable" })).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("/public/v1/tracking/");
});

test("single-ID refresh rechecks publication and clears a revoked mapping", async ({ page }) => {
  let revoked = false;
  const calls: string[] = [];
  await page.route("**/public/**", async route => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    if (path === trackingApiPath) return route.fulfill(revoked ? { status: 404, json: {} } : { json: tracking });
    return route.fulfill({ json: path.endsWith("/history") ? history() : entity });
  });
  await page.goto(trackingUrl);
  await expect(page.getByRole("heading", { name: "Batch provenance" })).toBeVisible();
  revoked = true;
  await page.getByRole("button", { name: "Refresh record" }).click();
  await expect(page.getByRole("heading", { name: "Public trace unavailable" })).toBeVisible();
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
  expect(calls).toHaveLength(4);
  expect(calls.at(-1)).toBe(trackingApiPath);
});

test("submitting an unknown Tracking ID opens the public unavailable state", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Tracking ID", { exact: true }).fill(unknownId);
  await page.getByRole("button", { name: "View public trace" }).click();
  await expect(page).toHaveURL(new RegExp("/track/" + unknownId + "$"));
  await expect(page.getByRole("heading", { name: "Public trace unavailable" })).toBeVisible();
});
