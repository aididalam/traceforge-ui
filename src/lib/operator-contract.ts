import { z } from "zod";
import { uint64, quantitySchema, routesSchema, numericPage, itemQuantity, referenceId, businessCode, shortCode, hash, removalReason, reasonText, operatorMovementSchema } from "./product-contract";
const id=z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value=>value.toLowerCase());
const uuid=z.string().uuid().transform(value=>value.toLowerCase());
const label=z.string().max(240).nullable();
export const operatorUserSchema=z.strictObject({accountId:uuid,email:z.string().email().max(254),name:z.string().min(1).max(120),
  tenantId:id,organizationId:id,workspaceName:label,organizationName:label,businessCode:businessCode.nullable().optional(),access:z.literal("manage")});
export const operatorMeSchema=z.strictObject({user:operatorUserSchema});
export const loginRequestSchema=z.strictObject({email:z.string().email().max(254),password:z.string().min(1).max(128)});
export const activationRequestSchema=loginRequestSchema.extend({password:z.string().min(12).max(128),name:z.string().trim().min(1).max(120),invitationCode:z.string().regex(/^tfoi_[A-Za-z0-9_-]{43}$/)});
export const loginResultSchema=z.strictObject({sessionToken:z.string().regex(/^tfos_[A-Za-z0-9_-]{43}$/),expiresAt:z.string().datetime(),user:operatorUserSchema});
export const operatorProductSchema=z.strictObject({id,name:label,description:z.string().max(2000).nullable(),type:label,status:label,closed:z.boolean(),createdAt:uint64,
  quantity:quantitySchema.nullable().optional(),holder:z.strictObject({id,name:label}).nullable(),fields:z.array(z.strictObject({label:z.string().max(80),value:z.string().max(1000)})).max(32)});
const page=z.strictObject({hasMore:z.boolean(),next:uint64.nullable()}).refine(value=>value.hasMore===(value.next!==null));
export const operatorProductsSchema=z.strictObject({products:z.array(operatorProductSchema).max(100),page});
export const operatorBusinessesSchema=z.strictObject({businesses:z.array(z.strictObject({id,name:label,type:z.string().max(120).nullable(),active:z.boolean()})).max(200),truncated:z.boolean()});
export const operatorHistorySchema=z.strictObject({product:operatorProductSchema,events:z.array(z.strictObject({id:uint64,name:z.string().max(128),label,
  occurredAt:uint64.nullable(),organizationId:id.nullable(),fromId:id.nullable(),toId:id.nullable(),transactionHash:id,quantity:operatorMovementSchema.optional()})).max(100),page});
export const operatorOperationsSchema=z.strictObject({operations:z.array(z.strictObject({id:uuid,productId:id,name:z.string().max(64),
  status:z.enum(["PREPARED","BROADCAST","CONFIRMED","FAILED"]),transactionHash:id,blockNumber:uint64.nullable(),createdAt:z.string().datetime(),updatedAt:z.string().datetime()})).max(50),truncated:z.boolean()});
export type OperatorUser=z.infer<typeof operatorUserSchema>;
export type OperatorProduct=z.infer<typeof operatorProductSchema>;
export type OperatorHistory=z.infer<typeof operatorHistorySchema>;
export type OperatorBusinesses=z.infer<typeof operatorBusinessesSchema>;
export type OperatorOperations=z.infer<typeof operatorOperationsSchema>;

const key=z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export const signupRequestSchema=loginRequestSchema.extend({password:z.string().min(12).max(128),name:z.string().trim().min(1).max(120),
 businessName:z.string().trim().min(1).max(120),businessType:z.string().trim().min(1).max(120).regex(/^[^\x00-\x1f\x7f]*$/),publicProfile:z.boolean(),businessCode:businessCode.optional()});
const detailText=(max:number)=>z.string().trim().min(1).max(max).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$/);
export const productFieldsSchema=z.array(z.strictObject({label:detailText(80),value:detailText(1000)})).max(32)
 .refine(fields=>!fields.some(f=>["id","quantity","schemaversion","name","product name","product / batch id","initial quantity","number of items"].includes(f.label.toLowerCase())),"Use the dedicated ID and quantity fields.")
 .refine(fields=>new Set(fields.map(field=>field.label.toLowerCase())).size===fields.length,"Each field needs a unique name.");
export const createProductRequestSchema=z.strictObject({name:z.string().trim().min(1).max(240),id:referenceId,quantity:itemQuantity.optional(),description:z.string().max(2000).optional(),fields:productFieldsSchema.optional(),publish:z.boolean(),idempotencyKey:key});
export const receiveProductRequestSchema=z.strictObject({version:uint64,confirmed:z.literal(true),idempotencyKey:key,sourceRouteId:hash.optional(),quantity:itemQuantity.optional()});
export const closeProductRequestSchema=z.strictObject({reason:z.enum(["Sold","Lost","Damaged","Disposed"]),confirmed:z.literal(true),idempotencyKey:key});
export const removeProductRequestSchema=z.strictObject({version:uint64,confirmed:z.literal(true),idempotencyKey:key,routeId:hash.optional(),quantity:itemQuantity.optional(),reason:removalReason.default("Sold"),reasonText:reasonText.default("")})
 .refine(r=>r.reason==="Sold"||r.reasonText.trim().length>0,"Please explain this removal.");
const writeBase=z.strictObject({operationId:uuid,status:z.enum(["PREPARED","BROADCAST","CONFIRMED","FAILED"]),transactionHash:id,blockNumber:uint64.nullable(),trackingId:id});
export const createWriteResultSchema=writeBase.extend({shortCode:shortCode.nullable().optional()}).refine(r=>r.status!=="CONFIRMED"||r.shortCode!==null);
export const receiptStatus=z.enum(['WAITING_APPROVAL','APPROVING','CONFIRMED','DECLINED','CANCELLED','EXPIRED','FAILED']);
const positiveCount=uint64.refine(value=>BigInt(value)>0n&&BigInt(value)<=BigInt(Number.MAX_SAFE_INTEGER));
export const receiveWriteResultSchema=z.strictObject({operationId:uuid,receiptRequestId:uuid,status:receiptStatus,transactionHash:id.nullable(),blockNumber:uint64.nullable(),trackingId:id,receivedRouteId:hash.optional(),quantity:positiveCount});
export const removeWriteResultSchema=writeBase.extend({removedQuantity:uint64.optional(),reason:removalReason.optional(),reasonText:reasonText.optional()});
export const businessWriteResultSchema=z.strictObject({operationId:uuid,receiptRequestId:uuid.optional(),status:z.enum(['PREPARED','BROADCAST','CONFIRMED','FAILED','WAITING_APPROVAL','APPROVING','DECLINED','CANCELLED','EXPIRED']),transactionHash:id.nullable(),blockNumber:uint64.nullable(),trackingId:id,shortCode:shortCode.nullable().optional(),receivedRouteId:hash.optional(),quantity:uint64.optional(),removedQuantity:uint64.optional(),reason:removalReason.optional(),reasonText:reasonText.optional()});
const wallet=z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(v=>v.toLowerCase());
const receiptBusiness=z.strictObject({id,name:label,walletAddress:wallet.nullable()});
export const receiptRequestSchema=z.strictObject({id:uuid,trackingId:id,name:label,source:receiptBusiness,requester:receiptBusiness.extend({walletAddress:wallet}),sourceRouteId:hash.nullable(),quantity:positiveCount,status:receiptStatus,createdAt:z.string().datetime(),expiresAt:z.string().datetime(),transactionHash:id.nullable(),errorCode:z.string().max(64).nullable()});
export const receiptRequestsSchema=z.strictObject({requests:z.array(receiptRequestSchema).max(100),page});
const receiptError=z.strictObject({code:z.string().max(64)});
export const receiptDecisionsRequestSchema=z.strictObject({requestIds:z.array(uuid).min(1).max(100).refine(ids=>new Set(ids).size===ids.length),action:z.enum(['approve','decline','cancel']),idempotencyKey:key});
export const receiptDecisionsResultSchema=z.strictObject({results:z.array(z.strictObject({requestId:uuid,ok:z.boolean(),result:receiveWriteResultSchema.nullable(),error:receiptError.nullable()}).refine(r=>r.ok?r.result!==null&&r.error===null&&r.result.receiptRequestId===r.requestId:r.result===null&&r.error!==null)).min(1).max(100)});
export const receiptBatchRequestSchema=z.strictObject({requests:z.array(receiveProductRequestSchema.extend({trackingId:id})).min(1).max(100)});
export const receiptBatchResultSchema=z.strictObject({results:z.array(z.strictObject({trackingId:id,ok:z.boolean(),result:receiveWriteResultSchema.nullable(),error:receiptError.nullable()}).refine(r=>r.ok?r.result!==null&&r.error===null&&r.result.trackingId===r.trackingId:r.result===null&&r.error!==null)).min(1).max(100)});
export type ReceiptRequest=z.infer<typeof receiptRequestSchema>;
export const receiveLookupSchema=z.strictObject({trackingId:id,name:label,holder:z.strictObject({id,name:label}).nullable(),closed:z.boolean(),version:uint64.nullable(),canReceive:z.boolean(),quantity:quantitySchema.optional(),routes:routesSchema.shape.routes.optional(),page:numericPage.optional()})
 .refine(p=>p.quantity?.isBatch? p.holder===null&&p.version===null&&p.routes!==undefined&&p.page!==undefined : p.holder!==null&&p.version!==null);
export type ReceiveLookup=z.infer<typeof receiveLookupSchema>;
export type WriteResult=z.infer<typeof businessWriteResultSchema>;
