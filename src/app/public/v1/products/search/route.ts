import { publicSearchGateway } from "../../../../../lib/public-gateway";
export const dynamic="force-dynamic";
export async function GET(request:Request){return publicSearchGateway(request);}
