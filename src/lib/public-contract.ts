import { z } from "zod";

import { uint64, publicQuantitySchema, publicMovementSchema } from "./product-contract";
export { uint64 } from "./product-contract";
export const maxCursor = 18446744073709551615n;
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase());
const label = z.string().max(255).nullable();
const organization = z.strictObject({ id: hash, name: label, type: label });
const productInfo = z.strictObject({
  name: label, description: z.string().max(2000).nullable(),
  fields: z.array(z.strictObject({ label: z.string().min(1).max(80), value: z.string().min(1).max(1000) })).max(32),
});

export const publicTrackingSchema = z.strictObject({ trackingId: hash, tenantId: hash, entityId: hash });
export const publicShortLinkSchema = z.strictObject({
  shortCode: z.string().transform(value => value.toLowerCase()).pipe(z.string().regex(/^[0123456789abcdefghjkmnpqrstvwxyz]{12}$/)),
  trackingId: hash, tenantId: hash, entityId: hash,
});

export const publicEntitySchema = z.strictObject({
  tenantId: hash, entityId: hash, entityType: hash, entityTypeLabel: label,
  metadataHash: hash, currentState: hash, currentStateLabel: label,
  currentCustodian: hash, closed: z.boolean(), createdAt: uint64, closedAt: uint64.nullable(),
  quantity: publicQuantitySchema.optional(),
  productInfo: productInfo.nullable().default(null), currentHolder: organization.nullable().default(null),
}).refine(entity => !entity.currentHolder || entity.currentHolder.id === entity.currentCustodian,
  "Current holder reference does not match the product.");
export const publicEventSchema = z.strictObject({
  quantity: publicMovementSchema.optional(),
  eventId: uint64, eventName: z.string().min(1).max(128), blockNumber: uint64,
  transactionHash: hash, transactionIndex: z.number().int().nonnegative(),
  logIndex: z.number().int().nonnegative(), eventType: hash.nullable(), eventTypeLabel: label,
  stateAfter: hash.nullable(), stateAfterLabel: label, linkType: hash.nullable(), linkTypeLabel: label,
  metadataHash: hash.nullable(), evidenceHash: hash.nullable(),
  occurredAt: uint64.nullable().default(null), organization: organization.nullable().default(null),
  transfer: z.strictObject({ from: organization.nullable(), to: organization.nullable() }).nullable().default(null),
});
export const publicHistorySchema = z.strictObject({
  tenantId: hash, entityId: hash, entity: publicEntitySchema,
  events: z.array(publicEventSchema).max(100),
  page: z.strictObject({ limit: z.number().int().min(1).max(100), hasMore: z.boolean(), nextAfterEventId: uint64.nullable() }),
});
export type PublicEntity = z.infer<typeof publicEntitySchema>;
export type PublicEvent = z.infer<typeof publicEventSchema>;
export type PublicHistory = z.infer<typeof publicHistorySchema>;
export type PublicOrganization = z.infer<typeof organization>;

export function validateHistory(data: unknown, tenantId: string, entityId: string, limit: number, after: string): PublicHistory {
  const history = publicHistorySchema.parse(data);
  if (history.tenantId !== tenantId || history.entityId !== entityId ||
      history.entity.tenantId !== tenantId || history.entity.entityId !== entityId ||
      history.page.limit !== limit || history.events.length > limit) throw new Error("Mismatched public history.");
  let previous = BigInt(after);
  for (const event of history.events) {
    const current = BigInt(event.eventId);
    if (current <= previous) throw new Error("History IDs must strictly increase.");
    previous = current;
  }
  if (history.page.hasMore) {
    if (!history.events.length || history.page.nextAfterEventId !== history.events.at(-1)?.eventId) {
      throw new Error("Invalid next cursor.");
    }
  } else if (history.page.nextAfterEventId !== null) throw new Error("Final page has a cursor.");
  return history;
}
