import { publicGateway } from "@/lib/public-gateway";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ tenantId: string; entityId: string }> }) {
  return publicGateway(request, await context.params);
}
