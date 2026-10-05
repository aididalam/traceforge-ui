import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiPath, entity, entityId, history, makeEvents, otherShortCode, otherTenantId, otherTrackingId,
  richApiPath, richShortApiPath, richShortCode, richShortUrl, richTrackingId,
  shortApiPath, shortCode, shortTracking, shortUrl, trackingId } from "./fixtures";

test("one Tracking ID field accepts a short code and copies a safe short link", async ({ page, context }, testInfo) => {
  await context.addCookies([{ name: "synthetic_operator_session", value: "fixture-only", domain: "127.0.0.1", path: "/" }]);
  const calls: { path: string; method: string; cookie: boolean; auth: boolean }[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/public/")) calls.push({ path, method: request.method(), cookie: Boolean(request.headers().cookie), auth: Boolean(request.headers().authorization) });
  });
  await page.goto("/");
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await page.getByLabel("Tracking ID", { exact: true }).fill(" " + richShortCode.toUpperCase() + " ");
  await page.getByLabel("Tracking ID", { exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(richShortUrl + "$"));
  await expect(page.getByRole("heading", { name: "Garden Tea Batch 001", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Current product overview" })).toContainText("Demo Distributor");
  await expect(page.locator(".timeline-event time")).toHaveCount(4);
  expect(calls.map(call => call.path).sort()).toEqual([richShortApiPath, richApiPath, richApiPath + "/history"].sort());
  expect(calls.every(call => call.method === "GET" && !call.cookie && !call.auth)).toBe(true);
  await expect(page.getByText(richTrackingId, { exact: true })).toBeHidden();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy Tracking ID", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(richShortCode);
  await page.getByRole("button", { name: "Copy tracking link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("http://127.0.0.1:4178" + richShortUrl);
  await expect(page.getByRole("button", { name: "Link copied", exact: true })).toBeVisible();
  await page.getByText("Reference details", { exact: true }).click();
  await expect(page.getByText(richTrackingId, { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("short-product-link.png"), fullPage: true });
});

test("short-link gateway rejects mutation, invalid codes and redirect/query targets", async ({ request }) => {
  expect((await request.post(shortApiPath)).status()).toBe(405);
  for (const path of [shortApiPath.replace(shortCode, "bad"), shortApiPath.replace(shortCode, "i".repeat(12)),
    shortApiPath + "?token=synthetic", shortApiPath + "?url=https://external.example"]) {
    expect((await request.get(path)).status()).toBe(400);
  }
  const valid = await request.get(shortApiPath.replace(shortCode, shortCode.toUpperCase()));
  expect(valid.status()).toBe(200); expect(await valid.json()).toEqual(shortTracking);
  expect(valid.headers()["location"]).toBeUndefined(); expect(valid.headers()["cache-control"]).toBe("no-store");
  const one = await request.get(shortApiPath.replace(shortCode, "aaaaaaaaaaaa"));
  const two = await request.get(shortApiPath.replace(shortCode, "bbbbbbbbbbbb"));
  expect(one.status()).toBe(404); expect(two.status()).toBe(404);
  expect(await one.json()).toEqual(await two.json()); expect(one.headers()["cache-control"]).toBe("no-store");
});

test("malformed and unknown short links never query a product or its history", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/public/**", async route => {
    calls.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/s/bad");
  await expect(page.getByRole("heading", { name: "Check your Tracking ID" })).toBeVisible(); expect(calls).toHaveLength(0);
  await page.goto("/s/aaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: "Product history unavailable" })).toBeVisible();
  expect(calls).toEqual(["/public/v1/short-links/aaaaaaaaaaaa"]);
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
});

test("refresh resolves the short code again and clears a revoked mapping", async ({ page }) => {
  let revoked = false;
  let aliasReads = 0;
  await page.route("**/public/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/short-links/")) {
      aliasReads++;
      return route.fulfill(revoked ? { status: 404, json: {} } : { json: shortTracking });
    }
    await route.fulfill({ json: path.endsWith("/history") ? history() : entity });
  });
  await page.goto(shortUrl);
  await expect(page.getByRole("heading", { name: "Batch tracking" })).toBeVisible();
  revoked = true;
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByRole("heading", { name: "Product history unavailable" })).toBeVisible();
  await expect(page.locator("[data-public-record]")).toHaveCount(0);
  await expect(page.getByText(entityId, { exact: true })).toHaveCount(0);
  expect(aliasReads).toBe(2);
});

test("short-code pagination preserves exact cursors and the full tracking reference", async ({ page }) => {
  const events = makeEvents(53), cursors: string[] = [];
  await page.route("**/public/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/short-links/")) return route.fulfill({ json: shortTracking });
    const after = url.searchParams.get("afterEventId") ?? "0";
    if (url.pathname.endsWith("/history")) cursors.push(after);
    await route.fulfill({ json: url.pathname.endsWith("/history") ? history(events, after) : entity });
  });
  await page.goto(shortUrl);
  await expect(page.locator(".timeline-event")).toHaveCount(50);
  await page.getByRole("button", { name: "Show more updates", exact: true }).click();
  await expect(page.locator(".timeline-event")).toHaveCount(53);
  expect(cursors).toEqual(["0", events[49].eventId]);
  await page.getByText("Reference details", { exact: true }).click();
  await expect(page.getByText(trackingId, { exact: true })).toBeVisible();
  await expect(page.getByText(shortCode, { exact: true })).toBeVisible();
});

test("short codes distinguish the same internal product ID in separate workspaces", async ({ page }) => {
  await page.goto(shortUrl);
  await expect(page.getByRole("heading", { name: "Batch tracking" })).toBeVisible();
  await page.goto("/s/" + otherShortCode);
  await expect(page.getByRole("heading", { name: "Second batch tracking" })).toBeVisible();
  await page.getByText("Reference details", { exact: true }).click();
  await expect(page.getByText(otherTenantId, { exact: true })).toBeVisible();
  await expect(page.getByText(otherTrackingId, { exact: true })).toBeVisible();
});
