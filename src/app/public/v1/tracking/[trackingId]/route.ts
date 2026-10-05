import { publicTrackingGateway } from "../../../../../lib/public-gateway";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ trackingId: string }> }) {
  return publicTrackingGateway(request, (await params).trackingId);
}
