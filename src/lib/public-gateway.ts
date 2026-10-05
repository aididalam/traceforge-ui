import { publicEntitySchema, publicTrackingSchema, uint64, validateHistory } from "./public-contract";
import { normalizeId, publicOrigin } from "./urls";

// Server-only by import direction: only App Router GET handlers import this
// module. No token/signer/DB dependencies, cookies or inbound headers are used.
const json = (body: unknown, status: number, extra: Record<string, string> = {}) => Response.json(body, {
    status, headers: { "Cache-Control": "no-store", ...extra },
  });
const fail = (status: number, code: string, message: string, extra: Record<string, string> = {}) => json({ error: { code, message } }, status, extra);

async function readPublic(request: Request, path: string, validate: (body: unknown) => unknown) {
  try {
    const configured = process.env.TRACEFORGE_PUBLIC_API_ORIGIN;
    if (!configured && process.env.NODE_ENV === "production") throw new Error("Public API origin is required.");
    const origin = publicOrigin(configured ?? "http://127.0.0.1:3000", true);
    const response = await fetch(`${origin}${path}`, {
      method: "GET", headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store",
      redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (response.status === 404) return fail(404, "entity_not_found", "Entity was not found.");
    if (response.status === 429) {
      const retry = response.headers.get("retry-after") ?? "60";
      return fail(429, "rate_limit_exceeded", "Please retry later.", { "Retry-After": retry });
    }
    if (response.status === 400) return fail(400, "invalid_request", "Invalid public request.");
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid upstream response.");
    return json(validate(await response.json()), 200);
  } catch {
    return fail(502, "public_api_unavailable", "Public records are temporarily unavailable.");
  }
}

export async function publicTrackingGateway(request: Request, value: string) {
  const trackingId = normalizeId(value);
  if (!trackingId || request.url.includes("?")) return fail(400, "invalid_request", "Invalid tracking lookup.");
  return readPublic(request, `/public/v1/tracking/${trackingId}`, body => {
    const safe = publicTrackingSchema.parse(body);
    if (safe.trackingId !== trackingId) throw new Error("Mismatched tracking ID.");
    return safe;
  });
}

export async function publicGateway(request: Request, params: { tenantId: string; entityId: string }, history = false) {
  const tenantId = normalizeId(params.tenantId);
  const entityId = normalizeId(params.entityId);
  const query = new URL(request.url).searchParams;
  const after = query.get("afterEventId") ?? "0";
  const limitText = query.get("limit") ?? "50";
  const limit = Number(limitText);
  if (!tenantId || !entityId) return fail(400, "invalid_request", "Invalid trace identifiers.");
  if ((history && (!uint64.safeParse(after).success || !/^[0-9]{1,3}$/.test(limitText) || limit < 1 || limit > 100)) ||
      [...query.keys()].some(key => !history || !["afterEventId", "limit"].includes(key)) ||
      query.getAll("afterEventId").length > 1 || query.getAll("limit").length > 1) {
    return fail(400, "invalid_request", "Invalid pagination.");
  }
  const suffix = history ? `/history?${new URLSearchParams({ afterEventId: after, limit: String(limit) })}` : "";
  return readPublic(request, `/public/v1/tenants/${tenantId}/entities/${entityId}${suffix}`, body => {
    const safe = history ? validateHistory(body, tenantId, entityId, limit, after) : publicEntitySchema.parse(body);
    if (safe.tenantId !== tenantId || safe.entityId !== entityId) throw new Error("Mismatched entity.");
    return safe;
  });
}
