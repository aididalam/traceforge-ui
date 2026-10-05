const bytes32 = /^0x[0-9a-fA-F]{64}$/;
export type TraceTarget = { trackingId: string } | { tenantId: string; entityId: string };

export function normalizeId(value: string): string | null {
  return bytes32.test(value) ? value.toLowerCase() : null;
}

export function publicOrigin(value: string, allowLoopback = false): string {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(allowLoopback && local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("An HTTPS origin without credentials or a path is required.");
  }
  return url.origin;
}

export function tracePath(tenant: string, entity: string): string {
  const tenantId = normalizeId(tenant);
  const entityId = normalizeId(entity);
  if (!tenantId || !entityId) throw new Error("Both identifiers must be bytes32 values.");
  return `/trace/${tenantId}/${entityId}`;
}

export function trackingPath(value: string): string {
  const trackingId = normalizeId(value);
  if (!trackingId) throw new Error("The tracking ID must be a bytes32 value.");
  return `/track/${trackingId}`;
}

export function parseTraceLink(value: string, allowedOrigins: string[], allowLoopback = false): string {
  const url = new URL(value.trim());
  const origin = publicOrigin(url.origin, allowLoopback);
  if (!allowedOrigins.includes(origin) || url.username || url.password || url.search || url.hash) {
    throw new Error("Use a TraceForge link from this site's approved origin.");
  }
  const tracking = /^\/track\/([^/]+)$/.exec(url.pathname);
  if (tracking) return trackingPath(tracking[1]);
  const match = /^\/trace\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (!match) throw new Error("The link must contain a tenant ID and entity ID.");
  return tracePath(match[1], match[2]);
}
