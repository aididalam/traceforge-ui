import { createServer } from "node:http";
import { apiPath, entity, history } from "./fixtures.ts";

const requests = [];
const server = createServer((request, reply) => {
  const url = new URL(request.url, "http://127.0.0.1:4202");
  const send = (status, body) => { reply.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); reply.end(JSON.stringify(body)); };
  if (url.pathname === "/health") return send(200, { ready: true });
  if (url.pathname === "/__requests") return send(200, requests);
  requests.push({ path: url.pathname, method: request.method, authorization: Boolean(request.headers.authorization), cookie: Boolean(request.headers.cookie) });
  if (request.method !== "GET") return send(405, { error: { code: "method_not_allowed" } });
  if (url.pathname === apiPath) return send(200, entity);
  if (url.pathname === apiPath + "/history") return send(200, history(undefined, url.searchParams.get("afterEventId") ?? "0", Number(url.searchParams.get("limit") ?? "50")));
  return send(404, { error: { code: "entity_not_found", message: "Entity was not found." } });
});
server.listen(4202, "127.0.0.1");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
