import { createServer } from "node:http";
import { apiPath, entity, history, tracking, trackingApiPath, otherTenantId, otherTrackingId, richTrackingId, richEntityId, richEntity, richHistory, richApiPath, shortApiPath, shortTracking, otherShortCode, richShortApiPath, richShortTracking } from "./fixtures.ts";

const requests = [];
const server = createServer((request, reply) => {
  const url = new URL(request.url, "http://127.0.0.1:4202");
  const send = (status, body) => { reply.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); reply.end(JSON.stringify(body)); };
  if (url.pathname === "/health") return send(200, { ready: true });
  if (url.pathname === "/__requests") return send(200, requests);
  requests.push({ path: url.pathname, method: request.method, authorization: Boolean(request.headers.authorization), cookie: Boolean(request.headers.cookie) });
  if (request.method !== "GET") return send(405, { error: { code: "method_not_allowed" } });
  if (url.pathname === shortApiPath) return send(200, shortTracking);
  if (url.pathname === richShortApiPath) return send(200, richShortTracking);
  if (url.pathname === "/public/v1/short-links/" + otherShortCode) return send(200, { ...tracking, shortCode: otherShortCode, trackingId: otherTrackingId, tenantId: otherTenantId });
  if (url.pathname === trackingApiPath) return send(200, tracking);
  if (url.pathname === "/public/v1/tracking/" + richTrackingId) return send(200, { ...tracking, trackingId: richTrackingId, entityId: richEntityId });
  if (url.pathname === richApiPath) return send(200, richEntity);
  if (url.pathname === richApiPath + "/history") return send(200, richHistory());
  if (url.pathname === "/public/v1/tracking/" + otherTrackingId) return send(200, { ...tracking, trackingId: otherTrackingId, tenantId: otherTenantId });
  const otherPath = apiPath.replace(entity.tenantId, otherTenantId);
  const otherEntity = { ...entity, tenantId: otherTenantId, entityTypeLabel: "Second batch" };
  if (url.pathname === otherPath) return send(200, otherEntity);
  if (url.pathname === otherPath + "/history") return send(200, { ...history(), tenantId: otherTenantId, entity: otherEntity });
  if (url.pathname === apiPath) return send(200, entity);
  if (url.pathname === apiPath + "/history") return send(200, history(undefined, url.searchParams.get("afterEventId") ?? "0", Number(url.searchParams.get("limit") ?? "50")));
  return send(404, { error: { code: "entity_not_found", message: "Entity was not found." } });
});
server.listen(4202, "127.0.0.1");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
