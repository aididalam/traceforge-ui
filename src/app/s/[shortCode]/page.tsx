import { TraceViewer } from "../../../components/trace-viewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ShortTrackingPage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  return <TraceViewer key={shortCode} shortCode={shortCode} />;
}
