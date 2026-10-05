import { OperatorDashboard } from "../../../components/operator/dashboard";
export const dynamic="force-dynamic";
export default async function ReceivePage({searchParams}:{searchParams:Promise<{tracking?:string}>}){
 const {tracking}=await searchParams;
 const initial=tracking&&/^(0x[0-9a-fA-F]{64}|[0123456789abcdefghjkmnpqrstvwxyz]{12})$/.test(tracking)?tracking:"";
 return <OperatorDashboard section="receive" initialTracking={initial}/>;
}
