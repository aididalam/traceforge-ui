import { z } from "zod";
import { uint64 } from "./public-contract";
const id=z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value=>value.toLowerCase());
const uuid=z.string().uuid();
const label=z.string().max(240).nullable();
export const operatorUserSchema=z.strictObject({accountId:uuid,email:z.string().email().max(254),name:z.string().min(1).max(120),
  tenantId:id,organizationId:id,workspaceName:label,organizationName:label,access:z.literal("manage")});
export const operatorMeSchema=z.strictObject({user:operatorUserSchema});
export const loginRequestSchema=z.strictObject({email:z.string().email().max(254),password:z.string().min(1).max(128)});
export const activationRequestSchema=loginRequestSchema.extend({password:z.string().min(12).max(128),name:z.string().trim().min(1).max(120),invitationCode:z.string().regex(/^tfoi_[A-Za-z0-9_-]{43}$/)});
export const loginResultSchema=z.strictObject({sessionToken:z.string().regex(/^tfos_[A-Za-z0-9_-]{43}$/),expiresAt:z.string().datetime(),user:operatorUserSchema});
export const operatorProductSchema=z.strictObject({id,name:label,description:z.string().max(2000).nullable(),type:label,status:label,closed:z.boolean(),createdAt:uint64,
  holder:z.strictObject({id,name:label}),fields:z.array(z.strictObject({label:z.string().max(80),value:z.string().max(1000)})).max(32)});
const page=z.strictObject({hasMore:z.boolean(),next:uint64.nullable()}).refine(value=>value.hasMore===(value.next!==null));
export const operatorProductsSchema=z.strictObject({products:z.array(operatorProductSchema).max(100),page});
export const operatorBusinessesSchema=z.strictObject({businesses:z.array(z.strictObject({id,name:label,type:z.string().max(120).nullable(),active:z.boolean()})).max(200),truncated:z.boolean()});
export const operatorHistorySchema=z.strictObject({product:operatorProductSchema,events:z.array(z.strictObject({id:uint64,name:z.string().max(128),label,
  occurredAt:uint64.nullable(),organizationId:id.nullable(),fromId:id.nullable(),toId:id.nullable(),transactionHash:id})).max(100),page});
export const operatorOperationsSchema=z.strictObject({operations:z.array(z.strictObject({id:uuid,productId:id,name:z.string().max(64),
  status:z.enum(["PREPARED","BROADCAST","CONFIRMED","FAILED"]),transactionHash:id,blockNumber:uint64.nullable(),createdAt:z.string().datetime(),updatedAt:z.string().datetime()})).max(50),truncated:z.boolean()});
export type OperatorUser=z.infer<typeof operatorUserSchema>;
export type OperatorProduct=z.infer<typeof operatorProductSchema>;
export type OperatorHistory=z.infer<typeof operatorHistorySchema>;
export type OperatorBusinesses=z.infer<typeof operatorBusinessesSchema>;
export type OperatorOperations=z.infer<typeof operatorOperationsSchema>;

const key=z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export const signupRequestSchema=loginRequestSchema.extend({password:z.string().min(12).max(128),name:z.string().trim().min(1).max(120),
 businessName:z.string().trim().min(1).max(120),businessType:z.enum(["Producer","Distributor","Transporter","Warehouse","Shop","Other business"]),publicProfile:z.boolean()});
const detailText=(max:number)=>z.string().trim().min(1).max(max).regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$/);
export const productFieldsSchema=z.array(z.strictObject({label:detailText(80),value:detailText(1000)})).max(32)
 .refine(fields=>new Set(fields.map(field=>field.label.toLowerCase())).size===fields.length,"Each field needs a unique name.");
export const createProductRequestSchema=z.strictObject({name:z.string().trim().min(1).max(240),description:z.string().max(2000),fields:productFieldsSchema.optional(),publish:z.boolean(),idempotencyKey:key});
export const receiveProductRequestSchema=z.strictObject({version:uint64,confirmed:z.literal(true),idempotencyKey:key});
export const closeProductRequestSchema=z.strictObject({reason:z.enum(["Sold","Lost","Damaged","Disposed"]),confirmed:z.literal(true),idempotencyKey:key});
export const businessWriteResultSchema=z.strictObject({operationId:uuid,status:z.enum(["PREPARED","BROADCAST","CONFIRMED","FAILED"]),transactionHash:id,blockNumber:uint64.nullable(),trackingId:id});
export const receiveLookupSchema=z.strictObject({trackingId:id,name:label,holder:z.strictObject({id,name:label}),closed:z.boolean(),version:uint64,canReceive:z.boolean()});
export type ReceiveLookup=z.infer<typeof receiveLookupSchema>;
