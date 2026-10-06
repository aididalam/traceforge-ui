// Imported only by server route handlers and offline tests. Credentials remain
// here; public GET handlers/client never import this module.
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { publicOrigin, normalizeId, normalizeShortCode } from "./urls";
import { uint64 } from "./public-contract";
import { signupRequestSchema, createProductRequestSchema, receiveProductRequestSchema, closeProductRequestSchema, businessWriteResultSchema, receiveLookupSchema, activationRequestSchema, loginRequestSchema, loginResultSchema, operatorMeSchema, operatorProductsSchema, operatorHistorySchema, operatorBusinessesSchema, operatorOperationsSchema } from "./operator-contract";

export type OperatorAction="login"|"signup"|"activate"|"logout"|"me"|"products"|"history"|"businesses"|"operations"|"create"|"lookup"|"receive"|"close";
type Session={token:string;expires:number};
const state=globalThis as typeof globalThis & {traceforgeOperatorSessions?:Map<string,Session>};
const sessions=state.traceforgeOperatorSessions??=new Map<string,Session>();
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{"Cache-Control":"no-store","Vary":"Cookie","Referrer-Policy":"no-referrer",...headers}});
const fail=(status:number,code:string)=>json({error:{code}},status);
function siteOrigin(request:Request){
  const configured=process.env.TRACEFORGE_OPERATOR_SITE_ORIGIN;
  if(configured)return publicOrigin(configured,true);
  const url=new URL(request.url);
  if(!["127.0.0.1","localhost","[::1]"].includes(url.hostname))throw Error();
  return publicOrigin(url.origin,true);
}
function cookieName(origin:string){return origin.startsWith("https:")?"__Host-tf-operator":"tf_operator_dev";}
function cookie(origin:string,id:string,seconds:number){return `${cookieName(origin)}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${origin.startsWith("https:")?"; Secure":""}`;}
function current(request:Request,origin:string){
  const all=(request.headers.get("cookie")??"").split(";").map(value=>value.trim()).filter(value=>value.startsWith(cookieName(origin)+"="));
  if(all.length!==1)return null;
  const value=all[0].slice(cookieName(origin).length+1);
  if(!/^[A-Za-z0-9_-]{43}$/.test(value))return null;
  const key=hash(value),session=sessions.get(key);
  if(!session)return null;
  if(session.expires<=Date.now()){sessions.delete(key);return null;}
  return {key,session};
}
async function limitedBody(request:Request,maxBytes=4096){
  const reader=request.body?.getReader();if(!reader)throw Error();
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>maxBytes){await reader.cancel();throw Error();}chunks.push(chunk.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const responseSchemas={me:operatorMeSchema,products:operatorProductsSchema,history:operatorHistorySchema,businesses:operatorBusinessesSchema,operations:operatorOperationsSchema};

export async function operatorGateway(request:Request,action:OperatorAction,productId?:string){
  let origin:string;
  try{origin=siteOrigin(request);}catch{return fail(503,"unavailable");}
  const mutation=["login","signup","activate","logout","create","receive","close"].includes(action);
  if(request.method!==(mutation?"POST":"GET"))return fail(405,"method_not_allowed");
  const sentOrigin=request.headers.get("origin"),fetchSite=request.headers.get("sec-fetch-site");
  if((mutation&&sentOrigin!==origin)||(sentOrigin&&sentOrigin!==origin)||(fetchSite&&!["same-origin","none"].includes(fetchSite)))return fail(403,"origin_denied");
  const url=new URL(request.url);
  if([...url.searchParams.keys()].some(key=>!["products","history"].includes(action)||!["after","limit"].includes(key))||url.searchParams.getAll("after").length>1||url.searchParams.getAll("limit").length>1)return fail(400,"invalid_request");
  const after=url.searchParams.get("after")??"0",limit=url.searchParams.get("limit")??"50";
  if(!uint64.safeParse(after).success||!/^[0-9]{1,3}$/.test(limit)||Number(limit)<1||Number(limit)>100)return fail(400,"invalid_request");
  const id=productId?(normalizeId(productId)??(action==="lookup"?normalizeShortCode(productId):null)):null;
  if(["history","lookup","receive","close"].includes(action)&&!id)return fail(400,"invalid_request");
  const existing=current(request,origin);
  if(!["login","signup","activate"].includes(action)&&!existing)return json({error:{code:"signed_out"}},401,{"Set-Cookie":cookie(origin,"",0)});
  let payload:unknown;
  if(mutation&&action!=="logout"){
    if(!request.headers.get("content-type")?.startsWith("application/json"))return fail(400,"invalid_request");
    try{payload=({login:loginRequestSchema,signup:signupRequestSchema,activate:activationRequestSchema,create:createProductRequestSchema,receive:receiveProductRequestSchema,close:closeProductRequestSchema} as Record<string,z.ZodType>)[action].parse(await limitedBody(request,action==="create"?256*1024:4096));
    }catch{return fail(400,"invalid_request");}
  }
  try{
    const configured=process.env.TRACEFORGE_OPERATOR_API_ORIGIN;
    if(!configured&&process.env.NODE_ENV==="production")throw Error();
    const upstream=publicOrigin(configured??"http://127.0.0.1:3000",true);
    const path=action==="history"?`products/${id}/history`:action==="lookup"?`receive/${id}`:action==="create"?"products/create":["receive","close"].includes(action)?`products/${id}/${action}`:action;
    const query=["products","history"].includes(action)?"?"+new URLSearchParams({after,limit}):"";
    const response=await fetch(`${upstream}/operator/v1/${path}${query}`,{method:request.method,cache:"no-store",credentials:"omit",redirect:"error",
      headers:{Accept:"application/json",...(payload?{"Content-Type":"application/json"}:{}),...(existing&&!["login","signup","activate"].includes(action)?{Authorization:`Bearer ${existing.session.token}`}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(action==="signup"?55000:mutation?30000:10000)])});
    if(action==="logout"){
      sessions.delete(existing!.key);
      // Local logout is unconditional even if upstream revocation is unavailable.
      return json({signedOut:true},200,{"Set-Cookie":cookie(origin,"",0)});
    }
    if(response.status===401){if(existing)sessions.delete(existing.key);return json({error:{code:action==="login"?"invalid_credentials":"signed_out"}},401,{"Set-Cookie":cookie(origin,"",0)});}
    if(response.status===429){const value=response.headers.get("retry-after");return json({error:{code:"rate_limited"}},429,{"Retry-After":value&&/^\d{1,4}$/.test(value)?value:"60"});}
    if(response.status===409)return fail(409,"operation_not_allowed");
    if(response.status===400||response.status===404)return fail(response.status,response.status===404?"missing":"invalid_request");
    if(!response.ok||!response.headers.get("content-type")?.includes("application/json"))throw Error();
    const body=await response.json();
    if(action==="signup")return json(z.strictObject({created:z.boolean(),pending:z.boolean()}).parse(body));
    if(["create","receive","close"].includes(action)){
      const result=businessWriteResultSchema.parse(body);
      if(action!=="create"&&result.trackingId!==id)throw Error();
      return json(result);
    }
    if(action==="lookup"){
      const result=receiveLookupSchema.parse(body);
      if(normalizeId(id!)&&result.trackingId!==id)throw Error();
      return json(result);
    }
    if(action==="activate")return json(z.strictObject({created:z.literal(true)}).parse(body));
    if(action==="login"){
      const result=loginResultSchema.parse(body),expires=Date.parse(result.expiresAt);
      if(expires<=Date.now()||expires>Date.now()+31*60*1000)throw Error();
      for(const [key,value]of sessions)if(value.expires<=Date.now())sessions.delete(key);
      if(sessions.size>=1000)return fail(503,"unavailable");
      if(existing)sessions.delete(existing.key);
      const local=randomBytes(32).toString("base64url");sessions.set(hash(local),{token:result.sessionToken,expires});
      return json({user:result.user},200,{"Set-Cookie":cookie(origin,local,Math.max(1,Math.floor((expires-Date.now())/1000)))});
    }
    const safe=responseSchemas[action as keyof typeof responseSchemas].parse(body);
    if(action==="history"&&"product"in safe&&safe.product.id!==id)throw Error();
    if((action==="products"||action==="history")&&"page"in safe){
      if(safe.page.next!==null&&BigInt(safe.page.next)<=BigInt(after))throw Error();
      if("events"in safe){let previous=BigInt(after);for(const event of safe.events){if(BigInt(event.id)<=previous)throw Error();previous=BigInt(event.id);}if(safe.page.next!==null&&safe.page.next!==safe.events.at(-1)?.id)throw Error();}
    }
    return json(safe);
  }catch{
    if(action==="logout"&&existing){sessions.delete(existing.key);return json({signedOut:true},200,{"Set-Cookie":cookie(origin,"",0)});}
    return fail(503,"unavailable");
  }
}
