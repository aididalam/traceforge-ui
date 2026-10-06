import { operatorGateway } from "../../../../../lib/operator-gateway";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){return operatorGateway(request,"search");}
