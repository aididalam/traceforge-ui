"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { operatorWrite, receiveLookup } from "../../lib/operator-client";
import { normalizeId, normalizeShortCode, parseTraceLink, publicOrigin, trackingPath } from "../../lib/urls";
import type { ReceiveLookup } from "../../lib/operator-contract";
import { productFieldsSchema } from "../../lib/operator-contract";
import { SupplyChainStatus } from "../product-information";

function trackingInput(value:string) {
 const direct=normalizeId(value.trim())??normalizeShortCode(value.trim());
 if(direct)return direct;
 const allowed=[window.location.origin];
 if(process.env.NEXT_PUBLIC_SITE_ORIGIN)allowed.push(publicOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN,true));
 const path=parseTraceLink(value,allowed,true);
 const last=path.split("/").at(-1)!;
 if(path.startsWith("/trace/"))throw Error();
 return last;
}
const message=(status:string)=>status==="CONFIRMED"?"Confirmed. Product history will update shortly.":"Submitted. Awaiting confirmation; check activity.";
export function ReceiveProduct({initial=""}:{initial?:string}) {
 const [input,setInput]=useState(initial),[product,setProduct]=useState<ReceiveLookup|null>(null),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[camera,setCamera]=useState(false);
 const video=useRef<HTMLVideoElement|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const key=useRef<string|null>(null);
 const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(timer.current)clearTimeout(timer.current);setCamera(false);};
 useEffect(()=>()=>{stream.current?.getTracks().forEach(track=>track.stop());if(timer.current)clearTimeout(timer.current);},[]);
 const lookup=async(event?:FormEvent,value=input)=>{
  event?.preventDefault();if(busy)return;setBusy(true);setNotice("");setProduct(null);setConfirmed(false);key.current=null;
  try{setProduct(await receiveLookup(trackingInput(value)));}catch{setNotice("Product unavailable. Check its Tracking ID or link and try again.");}finally{setBusy(false);}
 };
 const scan=async()=>{
  setNotice("");setCamera(true);
  try{stream.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
   if(!video.current){stop();return;}video.current.srcObject=stream.current;await video.current.play();
   const canvas=document.createElement("canvas"),context=canvas.getContext("2d",{willReadFrequently:true})!;
   const tick=()=>{const target=video.current;if(!stream.current||!target)return;
    if(target.readyState>=2){canvas.width=target.videoWidth;canvas.height=target.videoHeight;context.drawImage(target,0,0);
     const pixels=context.getImageData(0,0,canvas.width,canvas.height),code=jsQR(pixels.data,pixels.width,pixels.height);
     if(code){try{const id=trackingInput(code.data);setInput(id);stop();void lookup(undefined,id);return;}catch{setNotice("Use a TraceForge QR code from this site.");}}}
    timer.current=setTimeout(tick,250);
   };tick();
  }catch{stop();setNotice("Camera unavailable. Enter the Tracking ID or paste the product link.");}
 };
 const receive=async()=>{
  if(!product||!confirmed||busy)return;setBusy(true);setNotice("");key.current??=crypto.randomUUID();
  try{const result=await operatorWrite(`products/${product.trackingId}/receive`,{version:product.version,confirmed:true,idempotencyKey:key.current});setNotice(message(result.status));if(result.status==="CONFIRMED")setProduct({...product,canReceive:false});}
  catch{setNotice("Receive could not be confirmed. Check activity or refresh the product before trying again.");}finally{setBusy(false);}
 };
 return <section className="panel operator-panel"><h2>Receive a product</h2><p>Scan its QR or enter its Tracking ID. Confirm receipt only after the product is physically with your business.</p>
  <form onSubmit={lookup}><label className="input-label">Tracking ID or product link<input className="form-control" value={input} onChange={event=>{setInput(event.target.value);setProduct(null);}} required maxLength={500} spellCheck={false}/></label><button className="btn btn-outline-secondary" disabled={busy}>Find product</button></form>
  <button className="btn btn-outline-secondary" type="button" onClick={()=>void scan()} disabled={busy||camera}>Scan QR with camera</button>
  {camera&&<><video ref={video} muted playsInline aria-label="QR scanner" style={{width:"100%",maxWidth:400}}/><button className="btn btn-outline-secondary" onClick={stop}>Stop camera</button></>}
  {product&&<div><h3>{product.name??"Product"}</h3><p>Current holder: {product.holder.name??"Business name unavailable"}</p><p><SupplyChainStatus closed={product.closed}/></p>{!product.closed&&<p>{product.canReceive?"Ready to receive":"Already with your business"}</p>}
   {product.canReceive&&<div className="receipt-actions"><div className="form-check"><input className="form-check-input" id="confirm-receipt" type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><label className="form-check-label" htmlFor="confirm-receipt">I have physically received this product</label></div><button className="btn btn-primary" onClick={()=>void receive()} disabled={!confirmed||busy}>{busy?"Receiving…":"Receive into my inventory"}</button></div>}
   <Link href={`/operator/products/${product.trackingId}`} prefetch={false}>View product history</Link></div>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
export function CreateProduct() {
 const [name,setName]=useState(""),[publish,setPublish]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[created,setCreated]=useState<string|null>(null);
 const [fields,setFields]=useState<{id:string;label:string;value:string}[]>([]);
 const key=useRef<string|null>(null);
 const submit=async(event:FormEvent)=>{event.preventDefault();if(busy||created)return;
  const details=productFieldsSchema.safeParse(fields.map(({label,value})=>({label,value})));
  if(!details.success){setNotice("Give every additional field a unique name and a value. Up to 32 fields are supported.");return;}
  setBusy(true);setNotice("");key.current??=crypto.randomUUID();
  try{const result=await operatorWrite("products/create",{name,description:"",fields:details.data,publish,idempotencyKey:key.current});setNotice(message(result.status));setCreated(result.trackingId);}
  catch{setNotice("Product could not be confirmed. Check activity and retry with the same details.");}finally{setBusy(false);}};
 return <section className="panel operator-panel"><h2>Product information</h2><form onSubmit={submit}>
  <label className="input-label">Product name<input className="form-control" value={name} onChange={event=>setName(event.target.value)} required maxLength={240} disabled={busy||!!created}/></label>
  <fieldset className="product-detail-editor" disabled={busy||!!created}><legend>Product details</legend>
   <p>Add any details your product needs, such as description, batch number, size, ingredients or expiry date.</p>
   {fields.map((field,index)=><div className="product-detail-row" key={field.id}>
    <label className="input-label">Detail name {index+1}<input className="form-control" value={field.label} onChange={event=>setFields(current=>current.map(item=>item.id===field.id?{...item,label:event.target.value}:item))} required maxLength={80} placeholder="e.g. Batch number"/></label>
    <div className="input-label"><label htmlFor={`detail-value-${field.id}`}>Detail value {index+1}</label><textarea className="form-control" id={`detail-value-${field.id}`} rows={1} value={field.value} onChange={event=>setFields(current=>current.map(item=>item.id===field.id?{...item,value:event.target.value}:item))} required maxLength={1000} placeholder="e.g. BATCH-2026-001"/></div>
    <button className="btn btn-outline-secondary" type="button" aria-label={`Remove field ${index+1}`} onClick={()=>setFields(current=>current.filter(item=>item.id!==field.id))}>Remove</button>
   </div>)}
   <button className="btn btn-outline-secondary" type="button" disabled={fields.length>=32} onClick={()=>setFields(current=>[...current,{id:crypto.randomUUID(),label:"",value:""}])}>Add field</button>
   <p className="detail-context">{fields.length} of 32 fields added. Each field needs a different name.</p>
  </fieldset>
  <div className="form-check"><input className="form-check-input" id="share-product" type="checkbox" checked={publish} onChange={event=>setPublish(event.target.checked)} disabled={busy||!!created}/><label className="form-check-label" htmlFor="share-product">Share this product&apos;s details and supply history publicly, including the additional fields</label></div>
  <button className="btn btn-primary" disabled={busy||!!created}>{busy?"Adding…":"Add product"}</button></form>
  {notice&&<p role="status">{notice}</p>}{created&&<><Link href={`/operator/products/${created}`} prefetch={false}>View product</Link><ProductQR trackingId={created}/><button className="btn btn-outline-secondary" onClick={()=>{setCreated(null);setName("");setFields([]);setPublish(false);key.current=null;setNotice("");}}>Add another product</button></>}
 </section>;
}
export function ProductQR({trackingId}:{trackingId:string}) {
 const [url,setUrl]=useState("");const canvas=useRef<HTMLCanvasElement|null>(null);
 useEffect(()=>{const origin=publicOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN||window.location.origin,true);
  const link=origin+trackingPath(trackingId);setUrl(link);if(canvas.current)void QRCode.toCanvas(canvas.current,link,{width:240,margin:4,errorCorrectionLevel:"M"});},[trackingId]);
 return <div className="operator-qr"><h3>Product QR code</h3><canvas ref={canvas} role="img" aria-label="Product tracking QR code"/><p className="hash-value">{trackingId}</p>
  <a href={url}>Open tracking link</a><button className="btn btn-outline-secondary" onClick={()=>{const a=document.createElement("a");a.href=canvas.current!.toDataURL("image/png");a.download="traceforge-product-qr.png";a.click();}}>Download QR</button></div>;
}
export function CloseProduct({trackingId}:{trackingId:string}) {
 const [reason,setReason]=useState("Sold"),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[closed,setClosed]=useState(false);const key=useRef<string|null>(null);
 const close=async()=>{if(!confirmed||busy)return;setBusy(true);key.current??=crypto.randomUUID();
  try{const result=await operatorWrite(`products/${trackingId}/close`,{reason,confirmed:true,idempotencyKey:key.current});setNotice(message(result.status));setClosed(result.status==="CONFIRMED");}
  catch{setNotice("Removal could not be confirmed. Check activity and refresh this product.");}finally{setBusy(false);}};
 return <section className="panel operator-panel"><h2>Remove from supply chain</h2><p>Only the current holder can remove this product. After removal, it cannot be received again. Its history remains available.</p>
  <div className="close-product-fields"><div className="input-label"><label htmlFor="close-reason">Reason</label><select className="form-select" id="close-reason" value={reason} onChange={event=>setReason(event.target.value)}>{[["Sold","Delivered to customer"],["Lost","Lost"],["Damaged","Damaged"],["Disposed","Disposed"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
  <div className="form-check"><input className="form-check-input" id="confirm-close" type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><label className="form-check-label" htmlFor="confirm-close">I confirm this product should leave the supply chain</label></div>
  <button className="btn btn-primary" onClick={()=>void close()} disabled={!confirmed||busy||closed}>{busy?"Removing…":"Remove from supply chain"}</button></div>{notice&&<p role="status">{notice}</p>}
 </section>;
}
