import { createServer } from "node:http";
import { apiPath, entity, history, tracking, trackingApiPath, otherTenantId, otherTrackingId, richTrackingId, richEntityId, richEntity, richHistory, richApiPath, shortApiPath, shortTracking, otherShortCode, richShortApiPath, richShortTracking } from "./fixtures.ts";

import { operatorUser,operatorProducts,operatorBusinesses,operatorHistory,operatorOperations } from "./operator-fixtures.ts";
const syntheticSessions=new Set();
let serial=0;
const requests = [];
const server = createServer((request, reply) => {
  const url = new URL(request.url, "http://127.0.0.1:4202");
  const send = (status, body) => { reply.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); reply.end(JSON.stringify(body)); };
  if (url.pathname === "/health") return send(200, { ready: true });
  if (url.pathname === "/__requests") return send(200, requests);
  requests.push({ path: url.pathname, method: request.method, authorization: Boolean(request.headers.authorization), cookie: Boolean(request.headers.cookie) });
  if(url.pathname.startsWith("/operator/v1/")) {
    if(url.pathname==="/operator/v1/login"||url.pathname==="/operator/v1/activate") {
      if(request.method!=="POST")return send(405,{});
      let data="";request.on("data",chunk=>data+=chunk);request.on("end",()=>{
        let body;try{body=JSON.parse(data);}catch{return send(400,{});}
        if(body.email!=="operator@example.test"||body.password!=="Synthetic-Only-Password-2026")return send(401,{});
        if(url.pathname.endsWith("activate"))return send(200,{created:true});
        const token="tfos_"+(String(++serial).padStart(43,"0"));syntheticSessions.add(token);
        return send(200,{sessionToken:token,expiresAt:new Date(Date.now()+30*60*1000).toISOString(),user:operatorUser});
      });return;
    }
    const token=(request.headers.authorization??"").replace(/^Bearer /,"");
    if(!syntheticSessions.has(token))return send(401,{});
    if(url.pathname==="/operator/v1/logout"&&request.method==="POST"){syntheticSessions.delete(token);return send(200,{signedOut:true});}
    if(request.method!=="GET")return send(405,{});
    if(url.pathname==="/operator/v1/me")return send(200,{user:operatorUser});
    if(url.pathname==="/operator/v1/products")return send(200,operatorProducts);
    if(url.pathname==="/operator/v1/businesses")return send(200,operatorBusinesses);
    if(url.pathname==="/operator/v1/operations")return send(200,operatorOperations);
    if(url.pathname===`/operator/v1/products/${operatorHistory.product.id}/history`)return send(200,operatorHistory);
    return send(404,{});
  }
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
