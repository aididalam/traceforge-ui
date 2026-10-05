import { TraceViewer } from "../../../components/trace-viewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function TrackingPage({ params }: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await params;
  return <TraceViewer key={trackingId} trackingId={trackingId} />;
}
