import { operatorMeSchema, operatorProductsSchema, operatorHistorySchema, operatorBusinessesSchema, operatorOperationsSchema } from "./operator-contract";
import type { z } from "zod";
export class OperatorError extends Error { constructor(public kind:"signedOut"|"invalid"|"rateLimited"|"missing"|"unavailable",public retryAt=0){super(kind);} }
export async function operatorRead<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/operator/api/${path}`,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  if(response.status===401)throw new OperatorError("signedOut");
  if(response.status===429)throw new OperatorError("rateLimited",Date.now()+Number(response.headers.get("retry-after")??60)*1000);
  if(response.status===404)throw new OperatorError("missing");
  if(!response.ok)throw new OperatorError("unavailable");
  try{return schema.parse(await response.json());}catch{throw new OperatorError("unavailable");}
}
export const operatorClient={
 me:(signal?:AbortSignal)=>operatorRead("me",operatorMeSchema,signal),
 products:(after="0",signal?:AbortSignal)=>operatorRead("products?"+new URLSearchParams({after,limit:"50"}),operatorProductsSchema,signal),
 businesses:(signal?:AbortSignal)=>operatorRead("businesses",operatorBusinessesSchema,signal),
 operations:(signal?:AbortSignal)=>operatorRead("operations",operatorOperationsSchema,signal),
 history:(id:string,after="0",signal?:AbortSignal)=>operatorRead(`products/${id}/history?`+new URLSearchParams({after,limit:"50"}),operatorHistorySchema,signal),
};
