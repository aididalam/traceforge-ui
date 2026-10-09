import {operatorGateway} from '../../../../lib/operator-gateway';
export const dynamic='force-dynamic';
export function GET(request:Request){return operatorGateway(request,'requests');}
export function POST(request:Request){return operatorGateway(request,'request-batch');}
