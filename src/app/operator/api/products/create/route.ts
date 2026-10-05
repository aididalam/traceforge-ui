import { operatorGateway } from "../../../../../lib/operator-gateway";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(request:Request){return operatorGateway(request,"create");}
