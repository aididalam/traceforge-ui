import { OperatorDashboard } from "../../../../components/operator/dashboard";
export const dynamic="force-dynamic";
export const metadata={title:"TraceForge · Product details"};
export default async function Page({params}:{params:Promise<{productId:string}>}){return <OperatorDashboard section="product" productId={(await params).productId}/>;}
