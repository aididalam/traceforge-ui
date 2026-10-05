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
  productInfo: null, currentHolder: null,
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
    occurredAt: String(1790000000 + index * 60), organization: null, transfer: null,
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

export const richEntityId = "0x" + "78".repeat(32);
export const richTrackingId = "0x" + "89".repeat(32);
export const producer = { id: "0x" + "33".repeat(32), name: "Demo Producer", type: "Producer" };
export const distributor = { id: entity.currentCustodian, name: "Demo Distributor", type: "Distributor" };
export const richEntity: PublicEntity = { ...entity, entityId: richEntityId, currentHolder: distributor,
  productInfo: { name: "Garden Tea Batch 001", description: "A shared description of this tea batch.",
    fields: [{ label: "Batch number", value: "GT-001" }, { label: "Units", value: "100" },
      { label: "Packaging", value: "Packed" }, { label: "Quality", value: "Approved" }] } };
export const richTrackingUrl = `/track/${richTrackingId}`;
export const richApiPath = `/public/v1/tenants/${tenantId}/entities/${richEntityId}`;
export function richHistory() {
  const events = makeEvents().map((event, index) => ({ ...event,
    eventName: index === 2 ? "CustodyTransferred" : event.eventName,
    organization: index < 2 ? producer : distributor,
    transfer: index === 2 ? { from: producer, to: distributor } : null,
  }));
  return { ...history(events), entityId: richEntityId, entity: richEntity };
}
