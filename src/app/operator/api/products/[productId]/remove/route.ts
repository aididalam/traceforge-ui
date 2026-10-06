import { operatorGateway } from "../../../../../../lib/operator-gateway";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{productId:string}>}){return operatorGateway(request,"remove",(await context.params).productId);}
