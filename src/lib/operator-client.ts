import { routesSchema, holdersSchema, searchSchema, productQuery, validatePage, zeroHash } from "./product-contract";
import { retryTime } from "./public-client";
import { receiveLookupSchema, businessWriteResultSchema, operatorMeSchema, operatorProductsSchema, operatorHistorySchema, operatorBusinessesSchema, operatorOperationsSchema } from "./operator-contract";
import { normalizeId } from "./urls";
import type { z } from "zod";
export class OperatorError extends Error { constructor(public kind:"signedOut"|"invalid"|"rateLimited"|"missing"|"unavailable",public retryAt=0){super(kind);} }
export async function operatorRead<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/operator/api/${path}`,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  if(response.status===401)throw new OperatorError("signedOut");
  if(response.status===429)throw new OperatorError("rateLimited",retryTime(response.headers.get("retry-after")));
  if(response.status===404)throw new OperatorError("missing");
  if(response.status===400||response.status===409)throw new OperatorError("invalid");
  if(!response.ok)throw new OperatorError("unavailable");
  try{return schema.parse(await response.json());}catch{throw new OperatorError("unavailable");}
}
export const operatorClient={
 search:(externalId:string,code="",after="0",signal?:AbortSignal)=>operatorProductRead("search",undefined,after,externalId,code,signal),
 routes:(id:string,after="0",signal?:AbortSignal)=>operatorProductRead("routes",id,after,undefined,undefined,signal),
 holders:(id:string,after=zeroHash,signal?:AbortSignal)=>operatorProductRead("holders",id,after,undefined,undefined,signal),
 me:(signal?:AbortSignal)=>operatorRead("me",operatorMeSchema,signal),
 products:(after="0",signal?:AbortSignal)=>operatorRead("products?"+new URLSearchParams({after,limit:"50"}),operatorProductsSchema,signal),
 businesses:(signal?:AbortSignal)=>operatorRead("businesses",operatorBusinessesSchema,signal),
 operations:(signal?:AbortSignal)=>operatorRead("operations",operatorOperationsSchema,signal),
 history:(id:string,after="0",signal?:AbortSignal)=>operatorRead(`products/${id}/history?`+new URLSearchParams({after,limit:"50"}),operatorHistorySchema,signal),
};

export async function operatorWrite(path:string,payload:unknown) {
 const response=await fetch("/operator/api/"+path,{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 if(response.status===401)throw new OperatorError("signedOut");
 if(response.status===429)throw new OperatorError("rateLimited",retryTime(response.headers.get("retry-after")));
 if(response.status===400||response.status===409)throw new OperatorError("invalid");
 if(!response.ok)throw new OperatorError("unavailable");
 return businessWriteResultSchema.parse(await response.json());
}
export const receiveLookup=(id:string,signal?:AbortSignal)=>operatorRead("receive/"+id,receiveLookupSchema,signal);

async function operatorProductRead<K extends "routes"|"holders"|"search">(kind:K,id?:string,after="0",externalId?:string,code?:string,signal?:AbortSignal) {
 if(kind!=="search"&&!normalizeId(id??""))throw new OperatorError("invalid");
 const args=productQuery(new URLSearchParams({after,limit:"50",...(externalId?{id:externalId}:{}),...(code?{businessCode:code}:{})}),kind);
 const path=(kind==="search"?"products/search":`products/${normalizeId(id!)}/${kind}`)+"?"+args.query;
 const schemas={routes:routesSchema,holders:holdersSchema,search:searchSchema};
 const result=await operatorRead(path,schemas[kind] as typeof searchSchema,signal);
 return validatePage(result,args.after,args.limit,kind,args.externalId,args.code) as {routes:import("./product-contract").RoutePage;holders:import("./product-contract").HolderPage;search:import("./product-contract").SearchPage}[K];
}
