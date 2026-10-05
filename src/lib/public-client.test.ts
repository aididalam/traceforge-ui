import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicClient, PublicApiError, retryTime } from "./public-client";
import { publicGateway, publicTrackingGateway } from "./public-gateway";
import { maxCursor, validateHistory } from "./public-contract";
import { parseTraceLink, publicOrigin, tracePath, trackingPath } from "./urls";
import { apiPath, entity, entityId, hash, history, makeEvents, tenantId, traceUrl, unknownId, tracking, trackingId, trackingUrl, trackingApiPath } from "../../tests/fixtures";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const response = (body: unknown, status = 200, headers = {}) => Response.json(body, { status, headers });

describe("public URL boundary", () => {
  it("accepts canonical single-ID links while keeping the exact path/origin boundary", () => {
    expect(trackingPath("0x" + trackingId.slice(2).toUpperCase())).toBe(trackingUrl);
    expect(parseTraceLink("https://trace.example" + trackingUrl, ["https://trace.example"])).toBe(trackingUrl);
    for (const suffix of ["/extra", "?token=synthetic", "#secret", "/", "/../bad"]) {
      expect(() => parseTraceLink("https://trace.example" + trackingUrl + suffix, ["https://trace.example"])).toThrow();
    }
    expect(() => trackingPath("bad")).toThrow();
  });
  it("normalizes mixed-case identifiers and restricts link origins", () => {
    expect(tracePath(tenantId.toUpperCase().replace("0X", "0x"), entityId)).toBe(traceUrl);
    expect(parseTraceLink("https://trace.example" + traceUrl, ["https://trace.example"])).toBe(traceUrl);
    for (const link of ["https://other.example" + traceUrl, "javascript:alert(1)", "https://user:secret@trace.example" + traceUrl,
      "https://trace.example" + traceUrl + "?token=fixture", "https://trace.example" + traceUrl + "#fixture", "https://trace.example/trace/bad/bad"]) {
      expect(() => parseTraceLink(link, ["https://trace.example"])).toThrow();
    }
    for (const base of ["http://api.example", "https://api.example/private", "https://api.example?x=1", "https://user:secret@api.example"]) expect(() => publicOrigin(base)).toThrow();
  });
});

describe("token-free client and public contract", () => {
  it("resolves a single ID without credentials and validates identity/private fields", async () => {
    const spy = vi.fn<typeof fetch>().mockResolvedValue(response(tracking));
    const client = createPublicClient("", spy);
    expect(await client.tracking("0x" + trackingId.slice(2).toUpperCase())).toEqual(tracking);
    expect(spy.mock.calls[0][0]).toBe(trackingApiPath);
    expect(spy.mock.calls[0][1]).toMatchObject({ method: "GET", headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store", redirect: "error" });
    for (const body of [{ ...tracking, trackingId: unknownId }, { ...tracking, tenantId: "bad" }, { ...tracking, document: "SYNTHETIC_PRIVATE_SENTINEL" }]) {
      spy.mockResolvedValue(response(body));
      await expect(client.tracking(trackingId)).rejects.toMatchObject({ kind: "unavailable" });
    }
    spy.mockClear();
    await expect(client.tracking("bad")).rejects.toMatchObject({ kind: "invalid" });
    expect(spy).not.toHaveBeenCalled();
  });
  it("sends only GET requests without credentials and preserves big cursors", async () => {
    const spy = vi.fn<typeof fetch>().mockResolvedValue(response(history()));
    const client = createPublicClient("", spy);
    const result = await client.history(tenantId, entityId);
    expect(result.events[0].eventId).toBe("9007199254740993");
    expect(spy.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", redirect: "error", headers: { Accept: "application/json" } });
    expect(String(spy.mock.calls[0][0])).toBe(apiPath + "/history?afterEventId=0&limit=50");
    const events = makeEvents(53);
    const first = history(events);
    const second = history(events, first.page.nextAfterEventId!);
    expect(validateHistory(second, tenantId, entityId, 50, first.page.nextAfterEventId!).events).toHaveLength(3);
  });
  it("rejects private fields, numeric/rounded IDs, mixed tenants and broken cursor ordering", async () => {
    const cases = [
      { ...history(), event_args: { private: "SYNTHETIC_PRIVATE_SENTINEL" } },
      { ...history(), entity: { ...entity, metadata_document: { private: true } } },
      { ...history(), tenantId: unknownId },
      { ...history(), events: [{ ...makeEvents()[0], eventId: 9007199254740992 }] },
      { ...history(), events: [makeEvents()[1], makeEvents()[0]] },
      { ...history(), page: { limit: 50, hasMore: true, nextAfterEventId: "42" } },
    ];
    for (const data of cases) {
      const client = createPublicClient("", vi.fn<typeof fetch>().mockResolvedValue(response(data)));
      await expect(client.history(tenantId, entityId)).rejects.toMatchObject({ kind: "unavailable" });
    }
    const wrongEntity = createPublicClient("", vi.fn<typeof fetch>().mockResolvedValue(response({ ...entity, entityId: unknownId })));
    await expect(wrongEntity.entity(tenantId, entityId)).rejects.toMatchObject({ kind: "unavailable" });
  });
  it("blocks malformed inputs before any request", async () => {
    const spy = vi.fn<typeof fetch>();
    const client = createPublicClient("", spy);
    for (const cursor of ["-1", String(maxCursor + 1n), "1.5", "01"]) await expect(client.history(tenantId, entityId, cursor)).rejects.toMatchObject({ kind: "invalid" });
    await expect(client.entity("bad", entityId)).rejects.toMatchObject({ kind: "invalid" });
    await expect(client.history(tenantId, entityId, "0", 101)).rejects.toMatchObject({ kind: "invalid" });
    expect(spy).not.toHaveBeenCalled();
  });
  it.each([[404, "missing"], [429, "rateLimited"], [400, "invalid"], [401, "unavailable"], [500, "unavailable"]])("maps HTTP %s safely", async (status, kind) => {
    const client = createPublicClient("", vi.fn<typeof fetch>().mockResolvedValue(response({}, Number(status), { "retry-after": "2" })));
    await expect(client.entity(tenantId, entityId)).rejects.toMatchObject({ kind });
  });
  it("honors seconds/date Retry-After and handles unavailable/aborted requests", async () => {
    expect(retryTime("2", 1000)).toBe(3000);
    expect(retryTime("Thu, 01 Jan 1970 00:01:00 GMT", 1000)).toBe(60000);
    const signal = new AbortController();
    signal.abort();
    const spy = vi.fn<typeof fetch>().mockRejectedValue(new Error("Synthetic network error"));
    await expect(createPublicClient("", spy).entity(tenantId, entityId, signal.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(createPublicClient("", spy).entity(tenantId, entityId)).rejects.toBeInstanceOf(PublicApiError);
  });
});

describe("Next public GET gateway", () => {
  it("resolves tracking through a fixed GET path with no incoming credentials", async () => {
    vi.stubEnv("TRACEFORGE_PUBLIC_API_ORIGIN", "https://api.example");
    const spy = vi.fn<typeof fetch>().mockResolvedValue(response(tracking, 200, { "Set-Cookie": "synthetic=fixture" }));
    vi.stubGlobal("fetch", spy);
    const request = new Request("https://ui.example" + trackingApiPath, { headers: { Authorization: "Bearer synthetic", Cookie: "synthetic=fixture" } });
    const result = await publicTrackingGateway(request, trackingId);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(tracking);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("set-cookie")).toBeNull();
    expect(spy.mock.calls[0][0]).toBe("https://api.example" + trackingApiPath);
    expect(spy.mock.calls[0][1]).toMatchObject({ headers: { Accept: "application/json" }, credentials: "omit", method: "GET" });
    spy.mockClear();
    for (const [url, id] of [[request.url, "bad"], [request.url + "?token=synthetic", trackingId]]) expect((await publicTrackingGateway(new Request(url), id)).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
  it("fails closed for malformed/wrong tracking responses and sanitizes errors", async () => {
    vi.stubEnv("TRACEFORGE_PUBLIC_API_ORIGIN", "https://api.example");
    const spy = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", spy);
    const request = new Request("https://ui.example" + trackingApiPath);
    for (const body of [{ ...tracking, trackingId: unknownId }, { ...tracking, document: "SYNTHETIC_PRIVATE_SENTINEL" }]) {
      spy.mockResolvedValue(response(body));
      expect((await publicTrackingGateway(request, trackingId)).status).toBe(502);
    }
    for (const status of [404, 429, 503]) {
      spy.mockResolvedValue(response({ private: "SYNTHETIC_PRIVATE_SENTINEL" }, status, { "Retry-After": "3" }));
      const result = await publicTrackingGateway(request, trackingId);
      expect(result.status).toBe(status === 503 ? 502 : status);
      expect(JSON.stringify(await result.json())).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
      if (status === 429) expect(result.headers.get("retry-after")).toBe("3");
    }
  });
  it("never forwards incoming authorization/cookies and validates safe upstream data", async () => {
    vi.stubEnv("TRACEFORGE_PUBLIC_API_ORIGIN", "https://api.example");
    const spy = vi.fn<typeof fetch>().mockResolvedValue(response(entity, 200, { "Set-Cookie": "synthetic=fixture" }));
    vi.stubGlobal("fetch", spy);
    const result = await publicGateway(new Request("https://ui.example" + apiPath, { headers: { Authorization: "Bearer synthetic-fixture", Cookie: "synthetic=fixture" } }), { tenantId, entityId });
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("set-cookie")).toBeNull();
    expect(await result.json()).toEqual(entity);
    expect(spy.mock.calls[0][0]).toBe("https://api.example" + apiPath);
    expect(spy.mock.calls[0][1]).toMatchObject({ headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store", method: "GET" });
  });
  it("does not query upstream for invalid IDs, tokens in query or duplicate cursors", async () => {
    const spy = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", spy);
    for (const suffix of ["?token=fixture", "?limit=101", "?afterEventId=1.5", "?afterEventId=1&afterEventId=2", `?afterEventId=${maxCursor + 1n}`]) {
      expect((await publicGateway(new Request("https://ui.example" + apiPath + "/history" + suffix), { tenantId, entityId }, true)).status).toBe(400);
    }
    expect((await publicGateway(new Request("https://ui.example" + apiPath), { tenantId: "bad", entityId })).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
  it("fails closed for leaked document bodies and preserves publication/rate-limit errors", async () => {
    vi.stubEnv("TRACEFORGE_PUBLIC_API_ORIGIN", "https://api.example");
    const spy = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", spy);
    spy.mockResolvedValue(response({ ...entity, evidence_document: { secret: hash } }));
    const bad = await publicGateway(new Request("https://ui.example" + apiPath), { tenantId, entityId });
    expect(bad.status).toBe(502);
    expect(JSON.stringify(await bad.json())).not.toContain(hash);
    for (const status of [404, 429]) {
      spy.mockResolvedValue(response({ private: hash }, status, { "Retry-After": "3" }));
      const result = await publicGateway(new Request("https://ui.example" + apiPath), { tenantId, entityId });
      expect(result.status).toBe(status);
      if (status === 429) expect(result.headers.get("retry-after")).toBe("3");
      expect(JSON.stringify(await result.json())).not.toContain(hash);
    }
  });
});
