import type { PublicEntity, PublicEvent } from "../src/lib/public-contract";

// Synthetic records only. No live tenant/entity IDs or operator credentials.
export const tenantId = "0x" + "ab".repeat(32);
export const entityId = "0x" + "cd".repeat(32);
export const unknownId = "0x" + "ef".repeat(32);
export const trackingId = "0x" + "34".repeat(32);
export const otherTrackingId = "0x" + "56".repeat(32);
export const otherTenantId = "0x" + "12".repeat(32);
export const tracking = { trackingId, tenantId, entityId };
export const trackingUrl = `/track/${trackingId}`;
export const trackingApiPath = `/public/v1/tracking/${trackingId}`;
export const hash = "0x" + "44".repeat(32);
export const entity: PublicEntity = {
  tenantId, entityId, entityType: hash, entityTypeLabel: "Batch",
  metadataHash: hash, currentState: hash, currentStateLabel: "Quality approved",
  currentCustodian: "0x" + "22".repeat(32), closed: false, createdAt: "1790000000", closedAt: null,
};
export function makeEvents(count = 4): PublicEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    eventId: String(9007199254740993n + BigInt(index)),
    eventName: index === 0 ? "EntityCreated" : "TraceRecorded",
    blockNumber: String(12340 + index), transactionHash: hash, transactionIndex: 0, logIndex: index,
    eventType: index ? hash : null,
    // Include legacy platform labels that must be readable in the public UI.
    eventTypeLabel: ["Entity created", "EntityMetadataRevised", "CustodyTransferAccepted", "GenericAPIRecordTraceProof"][index] ?? `Checkpoint ${index + 1}`,
    stateAfter: hash, stateAfterLabel: index < 2 ? "Created" : "Quality approved",
    linkType: null, linkTypeLabel: null, metadataHash: hash, evidenceHash: index ? "0x" + "66".repeat(32) : null,
  }));
}
export function history(events = makeEvents(), after = "0", limit = 50) {
  const available = events.filter(event => BigInt(event.eventId) > BigInt(after));
  const visible = available.slice(0, limit);
  const hasMore = available.length > limit;
  return { tenantId, entityId, entity, events: visible,
    page: { limit, hasMore, nextAfterEventId: hasMore ? visible.at(-1)!.eventId : null } };
}
export const traceUrl = `/trace/${tenantId}/${entityId}`;
export const apiPath = `/public/v1/tenants/${tenantId}/entities/${entityId}`;
