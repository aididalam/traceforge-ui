import { publicOrigin } from "./urls";

// Read server environment at request time. This value must never be baked into
// a NEXT_PUBLIC_* build setting: the same image serves each deployment/domain.
export function configuredSiteOrigin(): string | null {
  const configured = process.env.TRACEFORGE_SITE_ORIGIN;
  const legacy = process.env.TRACEFORGE_OPERATOR_SITE_ORIGIN;
  const origin = configured ? publicOrigin(configured, true) : null;
  const legacyOrigin = legacy ? publicOrigin(legacy, true) : null;
  if (origin && legacyOrigin && origin !== legacyOrigin) {
    throw new Error("Conflicting site origins; use TRACEFORGE_SITE_ORIGIN.");
  }
  return origin ?? legacyOrigin;
}
