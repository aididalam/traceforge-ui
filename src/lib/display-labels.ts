// Translate known tracking terms for consumers. Custom business labels stay
// plain text; spacing CamelCase names does not add claims or change API data.
const familiarLabels: Record<string, string> = {
  entity: "Product",
  entitycreated: "Product added",
  created: "Added to tracking",
  tracerecorded: "Update recorded",
  metadataupdated: "Product information updated",
  metadatarevised: "Product information updated",
  entitymetadataupdated: "Product information updated",
  entitymetadatarevised: "Product information updated",
  entitylinkcreated: "Related product added",
  entitylinkstatuschanged: "Product connection updated",
  custodyclaimed:"Product received",
  productreceived:"Product received",
  productclosed_sold:"Out of supply chain",
  productclosed_lost:"Out of supply chain",
  productclosed_damaged:"Out of supply chain",
  productclosed_disposed:"Out of supply chain",
  entityclosed: "Out of supply chain",
  batchregistered: "Batch registered",
  batchpacked: "Batch packed",
  batchqualityapproved: "Batch quality approved",
  qualityapproved: "Quality approved",
  qualitycheckpassed: "Quality check passed",
  genericapimockproof: "Test update",
  genericapirecordtraceproof: "Tracking update recorded",
};

export function readableLabel(value: string): string {
  const key = value.replace(/\s+/g, "").toLowerCase();
  return Object.hasOwn(familiarLabels, key) ? familiarLabels[key] : value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
}

// These original demo names included a lifecycle note. Present the name on its
// own; lifecycle belongs in the status badge. Preserve other product names and
// the original hash-bound metadata, including names entered by real businesses.
export function productDisplayName(value: string | null): string | null {
  return value === "Demo Cola Bottle · sold" || value === "Demo Cola Bottle · open"
    ? "Demo Cola Bottle" : value;
}
