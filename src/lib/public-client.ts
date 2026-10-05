import { publicEntitySchema, publicTrackingSchema, uint64, validateHistory } from "./public-contract";
import { normalizeId, publicOrigin } from "./urls";

export type FailureKind = "missing" | "rateLimited" | "invalid" | "unavailable";
export class PublicApiError extends Error {
  constructor(public readonly kind: FailureKind, public readonly retryAt = 0) {
    super(kind);
    this.name = "PublicApiError";
  }
}

export function retryTime(value: string | null, now = Date.now()): number {
  if (value && /^[0-9]+$/.test(value)) {
    const seconds = Number(value);
    if (Number.isSafeInteger(seconds) && seconds <= (8640000000000000 - now) / 1000) return now + seconds * 1000;
  }
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) && date > now ? date : now + 60000;
}

export function createPublicClient(base = "", fetcher: typeof fetch = fetch, timeoutMs = 10000) {
  // An external origin requires a separately configured CORS policy. Default
  // requests use this Next app's fixed, token-free public GET handlers.
  const origin = base ? publicOrigin(base, process.env.NODE_ENV !== "production") : "";
  function path(tenant: string, entity: string) {
    const tenantId = normalizeId(tenant);
    const entityId = normalizeId(entity);
    if (!tenantId || !entityId) throw new PublicApiError("invalid");
    return { tenantId, entityId, url: `${origin}/public/v1/tenants/${tenantId}/entities/${entityId}` };
  }

  async function read(url: string, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetcher(url, {
        method: "GET", headers: { Accept: "application/json" }, credentials: "omit",
        cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal,
      });
      if (response.status === 404) throw new PublicApiError("missing");
      if (response.status === 429) throw new PublicApiError("rateLimited", retryTime(response.headers.get("retry-after")));
      if (response.status === 400) throw new PublicApiError("invalid");
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new PublicApiError("unavailable");
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
      if (error instanceof PublicApiError) throw error;
      throw new PublicApiError("unavailable");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  return {
    async tracking(value: string, signal?: AbortSignal) {
      const trackingId = normalizeId(value);
      if (!trackingId) throw new PublicApiError("invalid");
      const data = await read(`${origin}/public/v1/tracking/${trackingId}`, signal);
      try {
        const result = publicTrackingSchema.parse(data);
        if (result.trackingId !== trackingId) throw new Error("Mismatched tracking ID.");
        return result;
      } catch { throw new PublicApiError("unavailable"); }
    },
    async entity(tenant: string, entity: string, signal?: AbortSignal) {
      const ids = path(tenant, entity);
      const data = await read(ids.url, signal);
      try {
        const result = publicEntitySchema.parse(data);
        if (result.tenantId !== ids.tenantId || result.entityId !== ids.entityId) throw new Error("Mismatched entity.");
        return result;
      } catch { throw new PublicApiError("unavailable"); }
    },
    async history(tenant: string, entity: string, after = "0", limit = 50, signal?: AbortSignal) {
      const ids = path(tenant, entity);
      if (!uint64.safeParse(after).success || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new PublicApiError("invalid");
      const data = await read(`${ids.url}/history?${new URLSearchParams({ afterEventId: after, limit: String(limit) })}`, signal);
      try { return validateHistory(data, ids.tenantId, ids.entityId, limit, after); }
      catch { throw new PublicApiError("unavailable"); }
    },
  };
}
export type PublicClient = ReturnType<typeof createPublicClient>;
