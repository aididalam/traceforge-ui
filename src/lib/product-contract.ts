import { z } from "zod";
export const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase());
const big=(value:string)=>/^(0|[1-9][0-9]{0,19})$/.test(value)?BigInt(value):-1n;
export const uint64 = z.string().regex(/^(0|[1-9][0-9]{0,19})$/).refine(value => big(value)>=0n && big(value) <= 18446744073709551615n);
export const count = uint64.refine(value => big(value)>=0n && big(value) <= BigInt(Number.MAX_SAFE_INTEGER));
export const positiveCount = count.refine(value => big(value)>0n);
export const itemQuantity = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const shortCode = z.string().regex(/^[0123456789abcdefghjkmnpqrstvwxyz]{12}$/);
export const businessCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,16}$/);
export const referenceId = z.string().trim().min(1).refine(value => [...value].length <= 120 && !/[\x00-\x1f\x7f-\x9f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value));
export const reasons = ["Sold", "Lost", "Damaged", "Spoiled", "Disposed", "Other"] as const;
export const removalReason = z.enum(reasons);
export const reasonText = z.string().refine(value => [...value].length <= 256 && new TextEncoder().encode(value).length <= 1024 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value));
const business = z.strictObject({ id: hash, name: z.string().max(240).nullable() });
export const quantitySchema = z.strictObject({ externalId: referenceId.nullable(), initialQuantity: positiveCount, availableQuantity: count, removedQuantity: count,
 isBatch: z.boolean(), inSupplyChain: z.boolean(), reasons: z.array(z.strictObject({ reason: removalReason, quantity: count })).length(6), ownAvailableQuantity: count.optional() })
 .refine(q => big(q.initialQuantity) === big(q.availableQuantity) + big(q.removedQuantity) && q.isBatch === (big(q.initialQuantity)>1n) && q.inSupplyChain === (big(q.availableQuantity)>0n)
 && (q.ownAvailableQuantity === undefined || big(q.ownAvailableQuantity)<=big(q.availableQuantity)) && new Set(q.reasons.map(r=>r.reason)).size===6
 && q.reasons.reduce((sum,r)=>sum+big(r.quantity),0n)===big(q.removedQuantity), "Invalid stock totals.");
export const publicQuantitySchema = quantitySchema.refine(q=>q.ownAvailableQuantity===undefined);
export const routeSchema = z.strictObject({ id: hash, parentRouteId: hash, owner: business, previousOwner: business.nullable(), receivedQuantity: positiveCount, availableQuantity: positiveCount, version: uint64, receivedAt: uint64 })
 .refine(r=>big(r.availableQuantity)<=big(r.receivedQuantity));
export const numericPage = z.strictObject({hasMore:z.boolean(),next:uint64.nullable()}).refine(p=>p.hasMore===(p.next!==null));
export const routesSchema = z.strictObject({ routes: z.array(routeSchema).max(100), page: numericPage }).refine(p=>new Set(p.routes.map(r=>r.id)).size===p.routes.length);
export const holdersSchema = z.strictObject({holders:z.array(business.extend({availableQuantity:positiveCount,routeCount:z.number().int().nonnegative()})).max(100),page:z.strictObject({hasMore:z.boolean(),next:hash.nullable()}).refine(p=>p.hasMore===(p.next!==null))})
 .refine(p=>new Set(p.holders.map(r=>r.id)).size===p.holders.length);
export const searchProductSchema = z.strictObject({trackingId:hash,shortCode:shortCode.nullable(),name:z.string().max(240).nullable(),externalId:referenceId,
 origin:business.extend({businessCode:businessCode.nullable()}),isBatch:z.boolean(),initialQuantity:positiveCount,availableQuantity:count,inSupplyChain:z.boolean()})
 .refine(q=>q.isBatch===(big(q.initialQuantity)>1n)&&big(q.availableQuantity)<=big(q.initialQuantity)&&q.inSupplyChain===(big(q.availableQuantity)>0n));
export const searchSchema = z.strictObject({products:z.array(searchProductSchema).max(100),page:numericPage}).refine(p=>new Set(p.products.map(r=>r.trackingId)).size===p.products.length);
export const publicMovementSchema = z.strictObject({quantity:positiveCount.nullable(),initialQuantity:positiveCount.nullable(),reason:removalReason.nullable(),reasonText:reasonText.nullable(),sourceRouteId:hash.nullable(),receivedRouteId:hash.nullable()});
export const operatorMovementSchema = z.strictObject({quantity:positiveCount,reason:removalReason.nullable(),reasonText:reasonText.nullable(),routeId:hash.nullable(),receivedRouteId:hash.nullable()});
export type Quantity = z.infer<typeof quantitySchema>;
export type BatchRoute = z.infer<typeof routeSchema>;
export type RoutePage = z.infer<typeof routesSchema>;
export type HolderPage = z.infer<typeof holdersSchema>;
export type SearchPage = z.infer<typeof searchSchema>;
export type SearchProduct = z.infer<typeof searchProductSchema>;
export const zeroHash = "0x"+"0".repeat(64);
// Validate each bounded page without reducing totals to the rows currently loaded.
export function validatePage<T extends {page:{next:string|null}}>(data:T, after:string, limit:number, kind:"routes"|"holders"|"search", externalId?:string, code?:string):T {
 if(data.page.next!==null && BigInt(data.page.next)<=BigInt(after))throw Error("Non-advancing page.");
 const rows=kind==="routes"?(data as T & RoutePage).routes:kind==="holders"?(data as T & HolderPage).holders:(data as T & SearchPage).products;
 if(rows.length>limit || (data.page.next!==null&&!rows.length))throw Error("Invalid page size.");
 if(kind==="holders"){const ids=(rows as HolderPage["holders"]).map(r=>r.id);let previous=BigInt(after);for(const id of ids){if(BigInt(id)<=previous)throw Error("Unordered holders.");previous=BigInt(id);}if(data.page.next!==null&&data.page.next!==ids.at(-1))throw Error("Invalid holder cursor.");}
 if(kind==="search"&&(rows as SearchProduct[]).some(p=>p.externalId!==externalId||(code&&p.origin.businessCode!==null&&p.origin.businessCode!==code)))throw Error("Mismatched search.");
 return data;
}
export function productQuery(query:URLSearchParams, kind:"routes"|"holders"|"search") {
 const allowed=kind==="search"?["id","businessCode","after","limit"]:["after","limit"];
 for(const key of query.keys())if(!allowed.includes(key)||query.getAll(key).length!==1)throw Error("Invalid query.");
 const after=kind==="holders"?hash.parse(query.get("after")??zeroHash):uint64.parse(query.get("after")??"0");
 const limitText=query.get("limit")??"50";if(!/^[0-9]{1,3}$/.test(limitText))throw Error();
 const limit=Number(limitText);if(limit<1||limit>100)throw Error();
 const externalId=kind==="search"?referenceId.parse(query.get("id")):undefined;
 const code=query.has("businessCode")?businessCode.parse(query.get("businessCode")):undefined;
 return {after,limit,externalId,code,query:new URLSearchParams({after,limit:String(limit),...(externalId?{id:externalId}:{}),...(code?{businessCode:code}:{})})};
}
