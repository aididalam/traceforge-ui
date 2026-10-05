import { operatorGateway } from "../../../../../lib/operator-gateway";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{trackingId:string}>}){return operatorGateway(request,"lookup",(await context.params).trackingId);}
