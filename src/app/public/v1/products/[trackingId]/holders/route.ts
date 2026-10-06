import { publicProductGateway } from "../../../../../../lib/public-gateway";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{trackingId:string}>}){return publicProductGateway(request,(await context.params).trackingId,"holders");}
