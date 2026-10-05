import { OperatorDashboard } from "../../../../components/operator/dashboard";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{productId:string}>}){return <OperatorDashboard section="product" productId={(await params).productId}/>;}
