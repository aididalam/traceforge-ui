import { TraceViewer } from "../../../../components/trace-viewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function TracePage({ params }: { params: Promise<{ tenantId: string; entityId: string }> }) {
  const { tenantId, entityId } = await params;
  // No server-side provenance fetch: HTML/RSC contains a loading shell only.
  return <TraceViewer key={`${tenantId}:${entityId}`} tenantId={tenantId} entityId={entityId} />;
}
