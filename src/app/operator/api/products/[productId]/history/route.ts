import { operatorGateway } from "../../../../../../lib/operator-gateway";
export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{productId:string}>}){return operatorGateway(request,"history",(await params).productId);}
