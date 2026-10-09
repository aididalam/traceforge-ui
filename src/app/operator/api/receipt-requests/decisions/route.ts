import {operatorGateway} from '../../../../../lib/operator-gateway';
export const dynamic='force-dynamic';
export function POST(request:Request){return operatorGateway(request,'request-decisions');}
