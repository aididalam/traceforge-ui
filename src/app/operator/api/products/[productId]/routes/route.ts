import { operatorGateway } from "../../../../../../lib/operator-gateway";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{productId:string}>}){return operatorGateway(request,"routes",(await context.params).productId);}
