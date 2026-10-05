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
  custodyproposed: "Transfer requested",
  custodyaccepted: "Transfer accepted",
  custodytransferproposed: "Transfer requested",
  custodytransferaccepted: "Transfer accepted",
  custodytransferred: "Responsibility transferred",
  custodytransfercancelled: "Transfer cancelled",
  custodytransfercancelledbyadmin: "Transfer cancelled by administrator",
  entitylinkcreated: "Related product added",
  entitylinkstatuschanged: "Product connection updated",
  entityclosed: "Tracking closed",
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
