"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient } from "../lib/public-client";
import { operatorClient } from "../lib/operator-client";
import { zeroHash, type Quantity, type BatchRoute, type HolderPage } from "../lib/product-contract";
import { HashValue, RecordedTime, useRetryWait } from "./display";
import { formatCount } from "./reference-lookup";
const publicClient=createPublicClient(process.env.NEXT_PUBLIC_API_BASE_URL??"");
export function StockSummary({quantity}:{quantity:Quantity}){
 return <section className="stock-summary" aria-label="Product availability"><h3>{quantity.isBatch?"Batch availability":"Product availability"}</h3><p className="stock-total"><strong>{formatCount(quantity.availableQuantity)} out of {formatCount(quantity.initialQuantity)} available</strong></p>
 {quantity.ownAvailableQuantity!==undefined&&<p>Your business has <strong>{formatCount(quantity.ownAvailableQuantity)} available</strong>.</p>}
 <p>{formatCount(quantity.removedQuantity)} removed from the supply chain.</p>
 {BigInt(quantity.removedQuantity)>0n&&<dl className="reason-totals">{quantity.reasons.filter(r=>BigInt(r.quantity)>0n).map(r=><div key={r.reason}><dt>{r.reason}</dt><dd>{formatCount(r.quantity)}</dd></div>)}</dl>}
 </section>;
}
export function RouteDetails({route}:{route:BatchRoute}){
 return <><p>From {route.previousOwner?.name??(route.previousOwner?"Business name not shared":"Original registration")} · <RecordedTime value={route.receivedAt}/></p><p>{formatCount(route.availableQuantity)} available from {formatCount(route.receivedQuantity)} received.</p><details><summary>Receipt reference</summary><HashValue label="Receipt reference" value={route.id}/><HashValue label="Business reference" value={route.owner.id}/>{route.previousOwner&&<HashValue label="Previous business reference" value={route.previousOwner.id}/>}</details></>;
}
export function Holders({trackingId,operator=false,onMissing}:{trackingId:string;operator?:boolean;onMissing?:()=>void}){
 const router=useRouter();
 const [data,setData]=useState<HolderPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[retryAt,setRetryAt]=useState(0);const active=useRef<AbortController|null>(null),lock=useRef(false);const wait=useRetryWait(retryAt);
 const load=async(after=zeroHash)=>{if(lock.current||retryAt>Date.now())return;lock.current=true;const controller=active.current??new AbortController();active.current=controller;setLoading(true);setError("");
  try{const result=await (operator?operatorClient:publicClient).holders(trackingId,after,controller.signal);if(!controller.signal.aborted)setData(old=>after===zeroHash?result:{...result,holders:[...(old?.holders??[]),...result.holders.filter(r=>!old?.holders.some(o=>o.id===r.id))]});}
  catch(error){if(!controller.signal.aborted){if(operator&&(error as {kind?:string}).kind==="signedOut"){setData(null);router.replace("/operator/sign-in");}if((error as {kind?:string}).kind==="missing"){setData(null);onMissing?.();}setError("Holder information unavailable. Try again shortly.");setRetryAt((error as {retryAt?:number}).retryAt??0);}}
  finally{if(active.current===controller){lock.current=false;setLoading(false);}}
 };
 useEffect(()=>{setData(null);active.current=new AbortController();lock.current=false;void load();return()=>active.current?.abort();},[trackingId,operator]); // Separate bounded holder pages; global totals come from the summary.
 return <section className="stock-holders" aria-label="Businesses holding this batch"><h3>Where this batch is now</h3>{loading&&!data&&<p role="status">Loading businesses…</p>}{data&&<><ul className="selection-list">{data.holders.map(holder=><li key={holder.id}><strong>{holder.name??"Business name not shared"}</strong><p>{formatCount(holder.availableQuantity)} available · {holder.routeCount} receipt{holder.routeCount===1?"":"s"}</p><details><summary>Business reference</summary><HashValue label="Business reference" value={holder.id}/></details></li>)}</ul>{!data.holders.length&&<p>No items remain in the supply chain.</p>}</>}{error&&<p role="alert">{error}</p>}{(data?.page.next||error)&&<button type="button" className="btn btn-outline-secondary" disabled={loading||wait>0} onClick={()=>void load(data?.page.next??zeroHash)}>{wait?`Try again in ${wait}s`:loading?"Loading…":data?.page.next?"Show more businesses":"Try again"}</button>}</section>;
}

// A verifier can inspect a receipt path without recording a handover.
export function AvailableReceipts({trackingId,onMissing}:{trackingId:string;onMissing:()=>void}){
 const [opened,setOpened]=useState(false),[data,setData]=useState<import("../lib/product-contract").RoutePage|null>(null),[selected,setSelected]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[retryAt,setRetryAt]=useState(0);
 const active=useRef<AbortController|null>(null),lock=useRef(false),wait=useRetryWait(retryAt);
 const load=async(after="0")=>{if(lock.current||retryAt>Date.now())return;lock.current=true;const controller=active.current??new AbortController();active.current=controller;setBusy(true);setError("");
  try{const result=await publicClient.routes(trackingId,after,controller.signal);if(!controller.signal.aborted)setData(old=>({...result,routes:after==="0"?result.routes:[...(old?.routes??[]),...result.routes.filter(r=>!old?.routes.some(o=>o.id===r.id))]}));}
  catch(error){if(!controller.signal.aborted){if((error as {kind?:string}).kind==="missing"){setData(null);onMissing();}setError("Receipt information unavailable. Try again shortly.");setRetryAt((error as {retryAt?:number}).retryAt??0);}}
  finally{if(active.current===controller){lock.current=false;setBusy(false);}}
 };
 useEffect(()=>{active.current=new AbortController();setData(null);setSelected("");lock.current=false;if(opened)void load();return()=>active.current?.abort();},[trackingId,opened]);
 const route=data?.routes.find(r=>r.id===selected);
 if(!opened)return <button className="btn btn-outline-secondary" type="button" onClick={()=>setOpened(true)}>View available receipts</button>;
 return <section aria-label="Available batch receipts"><h3>Available receipts</h3><p>Choose the business handing you the product to inspect its receipt. Viewing this does not change ownership.</p>
 {data&&<><div className="input-label"><label htmlFor="public-receipt">Receipt to inspect</label><select className="form-select" id="public-receipt" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Choose a receipt</option>{data.routes.map((r,i)=><option key={r.id} value={r.id}>Receipt {i+1} · {r.owner.name??"Business name not shared"} · {formatCount(r.availableQuantity)} available</option>)}</select></div>{route&&<RouteDetails route={route}/>}<p className="form-text">{data.routes.length} available receipts shown.</p></>}
 {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Loading receipts…</p>}{(data?.page.next||error)&&<button type="button" className="btn btn-outline-secondary" disabled={busy||wait>0} onClick={()=>void load(data?.page.next??"0")}>{wait?`Try again in ${wait}s`:data?.page.next?"Show more receipts":"Try again"}</button>}
 </section>;
}
