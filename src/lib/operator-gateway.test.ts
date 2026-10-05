import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { operatorGateway } from "./operator-gateway";
import { operatorUser,operatorProducts,operatorBusinesses,operatorHistory } from "../../tests/operator-fixtures";
const origin="https://dashboard.example",token="tfos_"+"A".repeat(43);
const store=()=>((globalThis as typeof globalThis & {traceforgeOperatorSessions?:Map<string,{token:string;expires:number}>}).traceforgeOperatorSessions!);
const response=(body:unknown,status=200,headers={})=>Response.json(body,{status,headers});
const request=(action:string,body?:unknown,cookie?:string)=>new Request(origin+"/operator/api/"+action,{method:body?"POST":"GET",headers:{Origin:origin,...(body?{"Content-Type":"application/json"}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
const loginBody={email:operatorUser.email,password:"Synthetic-Only-Password-2026"};
beforeEach(()=>{store().clear();vi.stubEnv("TRACEFORGE_OPERATOR_SITE_ORIGIN",origin);vi.stubEnv("TRACEFORGE_OPERATOR_API_ORIGIN","https://api.example");});
afterEach(()=>{store().clear();vi.unstubAllGlobals();vi.unstubAllEnvs();});
async function signIn(spy:ReturnType<typeof vi.fn<typeof fetch>>,previousCookie?:string){
 spy.mockResolvedValue(response({sessionToken:token,expiresAt:new Date(Date.now()+1800000).toISOString(),user:operatorUser}));
 const result=await operatorGateway(request("login",loginBody,previousCookie),"login");expect(result.status).toBe(200);
 const cookie=result.headers.get("set-cookie")!;expect(cookie).toContain("HttpOnly");expect(cookie).toContain("Secure");expect(cookie).toContain("SameSite=Strict");
 expect(cookie).toContain("__Host-tf-operator=");expect(cookie).not.toContain(token);expect(await result.json()).toEqual({user:operatorUser});
 return cookie.split(";")[0];
}
describe("operator gateway session boundary",()=>{
 it("guards product mutations with exact origin, strict payloads, session credentials and matching tracking identity",async()=>{
  const spy=vi.fn<typeof fetch>();vi.stubGlobal("fetch",spy);const cookie=await signIn(spy),id=operatorHistory.product.id;
  const body={version:"1",confirmed:true,idempotencyKey:"synthetic-request-1234"};
  spy.mockClear();
  const csrf=new Request(origin+"/operator/api/products/"+id+"/receive",{method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});
  expect((await operatorGateway(csrf,"receive",id)).status).toBe(403);
  for(const invalid of [{...body,confirmed:false},{...body,organizationId:operatorUser.organizationId},{...body,version:"18446744073709551616"}])expect((await operatorGateway(request("receive",invalid,cookie),"receive",id)).status).toBe(400);
  expect((await operatorGateway(request("close",{reason:"Sold",confirmed:true,idempotencyKey:"synthetic-request-1234"}),"close",id)).status).toBe(401);
  expect(spy).not.toHaveBeenCalled();
  const result={operationId:"12345678-1234-4234-8234-123456789def",status:"CONFIRMED",transactionHash:"0x"+"44".repeat(32),blockNumber:"12",trackingId:id};
  spy.mockResolvedValue(response(result));
  expect((await operatorGateway(request("receive",body,cookie),"receive",id)).status).toBe(200);
  expect(spy.mock.calls.at(-1)?.[0]).toBe("https://api.example/operator/v1/products/"+id+"/receive");
  expect(spy.mock.calls.at(-1)?.[1]?.body).toBe(JSON.stringify(body));
  expect(spy.mock.calls.at(-1)?.[1]?.headers).toMatchObject({Authorization:"Bearer "+token});
  for(const upstream of [{...result,trackingId:"0x"+"ff".repeat(32)},{...result,serializedTransaction:"PRIVATE_SENTINEL"}]){
   spy.mockResolvedValue(response(upstream));const denied=await operatorGateway(request("receive",body,cookie),"receive",id);expect(denied.status).toBe(503);expect(await denied.text()).not.toContain("PRIVATE_SENTINEL");
  }
 });
 it("supports independent signup without forwarding a session and validates scan preview identity",async()=>{
  const spy=vi.fn<typeof fetch>();vi.stubGlobal("fetch",spy);const cookie=await signIn(spy);
  const signup={...loginBody,name:"Operator",businessName:"Independent Business",businessType:"Distributor",publicProfile:true};
  spy.mockResolvedValue(response({created:true,pending:false}));
  expect((await operatorGateway(request("signup",signup,cookie),"signup")).status).toBe(200);
  expect(spy.mock.calls.at(-1)?.[0]).toBe("https://api.example/operator/v1/signup");
  expect(spy.mock.calls.at(-1)?.[1]?.headers).not.toHaveProperty("Authorization");
  const id=operatorHistory.product.id,preview={trackingId:id,name:"Product",holder:{id:operatorUser.organizationId,name:"Business"},closed:false,version:"3",canReceive:true};
  spy.mockResolvedValue(response(preview));
  expect((await operatorGateway(request("lookup",undefined,cookie),"lookup",id)).status).toBe(200);
  spy.mockResolvedValue(response({...preview,trackingId:"0x"+"ff".repeat(32)}));
  expect((await operatorGateway(request("lookup",undefined,cookie),"lookup",id)).status).toBe(503);
 });
 it("keeps upstream credentials on the server, rotates local sessions and forwards only fixed reads",async()=>{
  const spy=vi.fn<typeof fetch>();vi.stubGlobal("fetch",spy);const cookie=await signIn(spy);
  spy.mockResolvedValue(response(operatorProducts,200,{"Set-Cookie":"SYNTHETIC_PRIVATE_SENTINEL"}));
  const result=await operatorGateway(request("products?after=9007199254740993&limit=50",undefined,cookie),"products");
  expect(result.status).toBe(200);expect(await result.json()).toEqual(operatorProducts);expect(result.headers.get("set-cookie")).toBeNull();expect(result.headers.get("cache-control")).toBe("no-store");
  expect(spy.mock.calls.at(-1)?.[0]).toBe("https://api.example/operator/v1/products?after=9007199254740993&limit=50");
  expect(spy.mock.calls.at(-1)?.[1]).toMatchObject({credentials:"omit",cache:"no-store",redirect:"error",headers:{Accept:"application/json",Authorization:"Bearer "+token}});
  expect(spy.mock.calls.at(-1)?.[1]?.headers).not.toHaveProperty("Cookie");
  const replacement=await signIn(spy,cookie);expect(replacement).not.toBe(cookie);expect(store().size).toBe(1);
  const old=await operatorGateway(request("me",undefined,cookie),"me");expect(old.status).toBe(401);
 });
 it("rejects CSRF, missing sessions, query injection and oversized login input before upstream access",async()=>{
  const spy=vi.fn<typeof fetch>();vi.stubGlobal("fetch",spy);
  for(const sent of [new Request(origin+"/operator/api/login",{method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json"},body:JSON.stringify(loginBody)}),new Request(origin+"/operator/api/login",{method:"POST",body:JSON.stringify(loginBody)})])expect((await operatorGateway(sent,"login")).status).toBe(403);
  expect((await operatorGateway(request("products?tenantId=external"),"products")).status).toBe(400);
  expect((await operatorGateway(request("products?after=18446744073709551616"),"products")).status).toBe(400);
  expect((await operatorGateway(request("products?limit=1&limit=2"),"products")).status).toBe(400);
  expect((await operatorGateway(request("products"),"products")).status).toBe(401);
  expect((await operatorGateway(request("login",{...loginBody,password:"x".repeat(5000)}),"login")).status).toBe(400);
  expect((await operatorGateway(new Request(origin+"/operator/api/me",{headers:{"sec-fetch-site":"cross-site"}}),"me")).status).toBe(403);
  expect(spy).not.toHaveBeenCalled();
 });
 it("clears revoked/expired sessions and always signs out locally even when API revocation fails",async()=>{
  const spy=vi.fn<typeof fetch>();vi.stubGlobal("fetch",spy);const cookie=await signIn(spy);
  spy.mockResolvedValue(response({private:"SYNTHETIC_PRIVATE_SENTINEL"},401));
  const revoked=await operatorGateway(request("me",undefined,cookie),"me");expect(revoked.status).toBe(401);expect(store().size).toBe(0);expect(await revoked.text()).not.toContain("PRIVATE_SENTINEL");
  const second=await signIn(spy);for(const value of store().values())value.expires=Date.now()-1;
  expect((await operatorGateway(request("me",undefined,second),"me")).status).toBe(401);expect(store().size).toBe(0);
  const third=await signIn(spy);spy.mockRejectedValue(Error("Synthetic upstream outage"));
  const logout=await operatorGateway(request("logout",{},third),"logout");expect(logout.status).toBe(200);expect(store().size).toBe(0);expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
 });
 it("fails closed on private fields, conflicting product identity, bad cursors, redirects and unavailable API",async()=>{
  const spy=vi.fn<typeof fetch>();vi.stubGlobal("fetch",spy);const cookie=await signIn(spy);
  for(const body of [{...operatorBusinesses,wallet:"PRIVATE_SENTINEL"}]){spy.mockResolvedValue(response(body));expect((await operatorGateway(request("businesses",undefined,cookie),"businesses")).status).toBe(503);}
  for(const body of [{...operatorHistory,product:{...operatorHistory.product,id:"0x"+"ff".repeat(32)}},{...operatorHistory,events:[...operatorHistory.events].reverse()}]){spy.mockResolvedValue(response(body));expect((await operatorGateway(request("history",undefined,cookie),"history",operatorHistory.product.id)).status).toBe(503);}
  for(const status of [302,500]){spy.mockResolvedValue(response({private:"PRIVATE_SENTINEL"},status,{Location:"https://evil.example"}));const result=await operatorGateway(request("me",undefined,cookie),"me");expect(result.status).toBe(503);expect(result.headers.get("location")).toBeNull();expect(await result.text()).not.toContain("PRIVATE_SENTINEL");}
 });
});
