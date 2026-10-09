"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { operatorWrite, receiveLookup, operatorClient, OperatorError,operatorReceiptBatch } from "../../lib/operator-client";
import { publicOrigin, trackingPath, shortPath } from "../../lib/urls";
import type { ReceiveLookup, OperatorProduct, WriteResult } from "../../lib/operator-contract";
import { createProductRequestSchema, receiveProductRequestSchema, removeProductRequestSchema,receiptBatchRequestSchema } from "../../lib/operator-contract";
import { reasons, type RoutePage } from "../../lib/product-contract";
import { SupplyChainStatus } from "../product-information";
import { productDisplayName } from "../../lib/display-labels";
import { ReferenceLookup, trackingInput, formatCount } from "../reference-lookup";
import { StockSummary, RouteDetails } from "../product-stock";
import { HashValue, useRetryWait } from "../display";
import { useSiteOrigin } from "../site-config";
const message=(status:string)=>status==='WAITING_APPROVAL'?'Request sent. Awaiting the current owner’s approval. Stock will appear after the approved transfer is confirmed.':status==='APPROVING'?'Owner approved. Awaiting blockchain confirmation.':status==="CONFIRMED"?"Confirmed. Product history will update shortly.":['FAILED','DECLINED','CANCELLED','EXPIRED'].includes(status)?"This request did not complete. Check Receipt requests and refresh before trying again.":"Submitted. Awaiting confirmation. Retry the same request to check confirmation, or check Activity.";
type Attempt={path:string;payload:Record<string,unknown>};
function quantityNumber(value:string,max:string,min=1){if(!/^[1-9][0-9]*$/.test(value))return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=min&&BigInt(value)<=BigInt(max)?n:null;}
export function ReceiveProduct({initial="",organizationId}:{initial?:string;organizationId:string}) {
 const siteOrigin=useSiteOrigin();
 const router=useRouter();
 const [scanned,setScanned]=useState(initial),[product,setProduct]=useState<ReceiveLookup|null>(null),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[camera,setCamera]=useState(false),[routes,setRoutes]=useState<RoutePage|null>(null),[routeId,setRouteId]=useState(""),[amount,setAmount]=useState("1"),[attempt,setAttempt]=useState<Attempt|null>(null),[done,setDone]=useState(false),[retryAt,setRetryAt]=useState(0);
 const [drafts,setDrafts]=useState<{trackingId:string;name:string;input:Record<string,unknown>}[]>([]),[bulkAttempt,setBulkAttempt]=useState<Record<string,unknown>|null>(null),[bulkNotice,setBulkNotice]=useState('');
 const wait=useRetryWait(retryAt),active=useRef<AbortController|null>(null),routeLock=useRef(false);
 const video=useRef<HTMLVideoElement|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(timer.current)clearTimeout(timer.current);setCamera(false);};
 useEffect(()=>()=>{active.current?.abort();stream.current?.getTracks().forEach(track=>track.stop());if(timer.current)clearTimeout(timer.current);},[]);
 const reset=()=>{active.current?.abort();setProduct(null);setRoutes(null);setRouteId("");setConfirmed(false);setAttempt(null);setDone(false);setNotice("");};
 const lookup=async(value:string)=>{
  if(busy||wait||attempt||bulkAttempt)return;reset();setBusy(true);const controller=new AbortController();active.current=controller;
  try{const found=await receiveLookup(value,controller.signal);if(controller.signal.aborted)return;setProduct(found);
   const page=found.routes&&found.page?{routes:found.routes,page:found.page}:null;setRoutes(page);
   const eligible=page?.routes.filter(r=>r.owner.id!==organizationId)??[];if(eligible.length===1&&!page?.page.hasMore)setRouteId(eligible[0].id);
  }catch(error){if(error instanceof OperatorError&&error.kind==="signedOut"){router.replace("/operator/sign-in");}if(!controller.signal.aborted){setNotice("Product unavailable. Check its Tracking ID or link and try again.");setRetryAt((error as {retryAt?:number}).retryAt??0);}}
  finally{if(active.current===controller)setBusy(false);}
 };
 const moreRoutes=async()=>{if(!product||!routes?.page.next||routeLock.current||wait||attempt||bulkAttempt)return;routeLock.current=true;setBusy(true);const controller=active.current!;
  try{const result=await operatorClient.routes(product.trackingId,routes.page.next,controller.signal);if(!controller.signal.aborted)setRoutes(old=>({...result,routes:[...(old?.routes??[]),...result.routes.filter(r=>!old?.routes.some(o=>o.id===r.id))]}));}
  catch(error){if(error instanceof OperatorError&&error.kind==="signedOut"){router.replace("/operator/sign-in");}if(!controller.signal.aborted){setNotice("More receipts could not be loaded. Try again shortly.");setRetryAt((error as {retryAt?:number}).retryAt??0);}}
  finally{routeLock.current=false;if(!controller.signal.aborted)setBusy(false);}
 };
 const scan=async()=>{
  setNotice("");setCamera(true);
  try{stream.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
   if(!video.current){stop();return;}video.current.srcObject=stream.current;await video.current.play();
   const canvas=document.createElement("canvas"),context=canvas.getContext("2d",{willReadFrequently:true})!;
   const tick=()=>{const target=video.current;if(!stream.current||!target)return;
    if(target.readyState>=2){canvas.width=target.videoWidth;canvas.height=target.videoHeight;context.drawImage(target,0,0);
     const pixels=context.getImageData(0,0,canvas.width,canvas.height),code=jsQR(pixels.data,pixels.width,pixels.height);
     if(code){try{const id=trackingInput(code.data,siteOrigin);setScanned(id);stop();void lookup(id);return;}catch{setNotice("Use a TraceForge QR code from this site.");}}}
    timer.current=setTimeout(tick,250);
   };tick();
  }catch{stop();setNotice("Camera unavailable. Enter the Tracking ID or paste the product link.");}
 };

 const selected=routes?.routes.find(r=>r.id===routeId),isBatch=product?.quantity?.isBatch===true;
 const n=quantityNumber(amount,selected?.availableQuantity??"1");
 const addToList=()=>{
  if(!product||busy||attempt||bulkAttempt||!confirmed||!product.canReceive||drafts.length>=100||isBatch&&(!selected||n===null))return;
  if(drafts.some(d=>d.trackingId===product.trackingId&&d.input.sourceRouteId===(isBatch?selected!.id:undefined))){setNotice('This product and source are already in your request list.');return;}
  const input=receiveProductRequestSchema.parse({version:isBatch?selected!.version:product.version,confirmed:true,idempotencyKey:crypto.randomUUID(),...(isBatch?{sourceRouteId:selected!.id,quantity:n}:{})});
  setDrafts(old=>[...old,{trackingId:product.trackingId,name:productDisplayName(product.name)??'Product',input}]);reset();setScanned('');
 };
 const sendList=async()=>{
  if(busy||wait||!drafts.length)return;
  const payload=bulkAttempt??receiptBatchRequestSchema.parse({requests:drafts.map(d=>({trackingId:d.trackingId,...d.input}))});
  setBulkAttempt(payload);setBusy(true);setBulkNotice('');
  try{const response=await operatorReceiptBatch(payload),accepted=response.results.filter(r=>r.ok).length;
   const failed=response.results.map((r,i)=>r.ok?null:`${drafts[i]?.name??'Product'}: ${r.error?.code==='quantity_exceeds_available'?'not enough available stock':'refresh the product and request again'}`).filter(Boolean);
   setBulkNotice(`${accepted} request${accepted===1?'':'s'} sent for owner approval.${failed.length?' '+failed.join('; ')+'.':''}`);setDrafts([]);setBulkAttempt(null);
  }catch(error){if(error instanceof OperatorError&&error.kind==='signedOut')router.replace('/operator/sign-in');setRetryAt((error as {retryAt?:number}).retryAt??0);setBulkNotice('Request results are unavailable. Retry this same list or check My requests.');}
  finally{setBusy(false);}
 };
 const receive=async()=>{
  if(!product||busy||wait||done||bulkAttempt||(!attempt&&(!confirmed||!product.canReceive||(isBatch&&(!selected||selected.owner.id===organizationId||n===null)))))return;
  const current=attempt??{path:`products/${product.trackingId}/receive`,payload:receiveProductRequestSchema.parse({version:isBatch?selected!.version:product.version,confirmed:true,idempotencyKey:crypto.randomUUID(),...(isBatch?{sourceRouteId:selected!.id,quantity:n}:{})})};
  setAttempt(current);setBusy(true);setNotice("");
  try{const result=await operatorWrite(current.path,current.payload);setNotice(message(result.status));if(['WAITING_APPROVAL','APPROVING','CONFIRMED'].includes(result.status)){setDone(true);setProduct({...product,canReceive:false});}else if(['FAILED','DECLINED','CANCELLED','EXPIRED'].includes(result.status))setDone(true);}
  catch(error){if(error instanceof OperatorError&&error.kind==="signedOut"){router.replace("/operator/sign-in");}setRetryAt((error as {retryAt?:number}).retryAt??0);setNotice(error instanceof OperatorError&&error.kind==="invalid"?"Stock changed or this request was rejected. Refresh before making a new request.":"Confirmation unavailable. Check Activity, or retry this same request.");if(error instanceof OperatorError&&error.kind==="invalid")setDone(true);}
  finally{setBusy(false);}
 };
 return <section className="panel operator-panel"><h2>Receive products</h2><p>Scan after physical handover and request the current owner&apos;s approval. You can add several products to a request list.</p>
  <ReferenceLookup operator initial={scanned} busy={busy||!!attempt||!!bulkAttempt||wait>0} onSelect={lookup} onReset={reset}/>
  <button className="btn btn-outline-secondary" type="button" onClick={()=>void scan()} disabled={busy||camera||!!attempt||!!bulkAttempt||wait>0}>Scan QR with camera</button>
  {camera&&<><video ref={video} muted playsInline aria-label="QR scanner" style={{width:"100%",maxWidth:400}}/><button className="btn btn-outline-secondary" onClick={stop}>Stop camera</button></>}
  {product&&<div className="receipt-preview"><h3>{productDisplayName(product.name)??"Product details not shared"}</h3>{product.quantity?.externalId&&<p>Product / batch ID: <strong>{product.quantity.externalId}</strong></p>}
   <p><SupplyChainStatus closed={product.closed}/></p>{product.quantity&&<StockSummary quantity={product.quantity}/>}
   {!isBatch&&<p>Current holder: {product.holder?.name??"Business name not shared"}</p>}
   {isBatch&&routes&&<fieldset disabled={busy||!!attempt||!!bulkAttempt}><legend>Choose the receipt you are receiving from</legend><p>Choose the business handing you these items. Separate deliveries at the same business have separate receipts.</p>
    <ul className="selection-list">{routes.routes.map(route=><li key={route.id}><div className="form-check"><input className="form-check-input" id={`source-${route.id}`} type="radio" name="source-receipt" value={route.id} checked={routeId===route.id} disabled={route.owner.id===organizationId} onChange={()=>{setRouteId(route.id);setConfirmed(false);setAmount("1");}}/><label className="form-check-label" htmlFor={`source-${route.id}`}>{route.owner.name??"Business name not shared"}{route.owner.id===organizationId?" (your business)":""}</label></div><RouteDetails route={route}/></li>)}</ul>
    {routes.page.hasMore&&<button type="button" className="btn btn-outline-secondary" onClick={()=>void moreRoutes()} disabled={wait>0}>Show more receipts</button>}
    {selected&&<label className="input-label">Number of items received<input className="form-control" type="number" min="1" step="1" max={selected.availableQuantity} value={amount} onChange={event=>{setAmount(event.target.value);setConfirmed(false);}}/></label>}
    {selected&&n===null&&<p role="alert">Enter a whole number from 1 to {formatCount(selected.availableQuantity)}.</p>}
   </fieldset>}
   {product.canReceive&&!done&&<div className="receipt-actions"><div className="form-check"><input className="form-check-input" id="confirm-receipt" type="checkbox" checked={confirmed} disabled={busy||!!attempt||!!bulkAttempt} onChange={event=>setConfirmed(event.target.checked)}/><label className="form-check-label" htmlFor="confirm-receipt">I have physically received this product</label></div><div className='d-flex flex-wrap gap-2'><button className="btn btn-primary" onClick={()=>void receive()} disabled={busy||wait>0||!!bulkAttempt||(!attempt&&(!confirmed||(isBatch&&(!selected||n===null))))}>{busy?"Sending request…":attempt?"Check request":"Request to receive"}</button><button className='btn btn-outline-secondary' disabled={busy||!!attempt||!!bulkAttempt||!confirmed||drafts.length>=100||isBatch&&(!selected||n===null)} onClick={addToList}>Add to request list</button></div></div>}
   {!product.closed&&!product.canReceive&&!done&&<p>{isBatch?"No other business has available stock on this page. Load more receipts if available.":"Already with your business."}</p>}
   {!attempt&&<button className="btn btn-outline-secondary" type="button" disabled={busy||!!bulkAttempt||wait>0} onClick={()=>void lookup(product.trackingId)}>Refresh product</button>}
   {done&&<button className="btn btn-outline-secondary" type="button" disabled={busy||wait>0} onClick={()=>{setAttempt(null);reset();}}>Receive another product</button>}
   <Link href='/operator/requests' prefetch={false}>Check receipt requests</Link><p className="form-text">Private product history becomes available after the approved receipt is recorded.</p></div>}
  {drafts.length>0&&<div className='border rounded p-3 mt-3'><h3>Request list ({drafts.length} / 100)</h3><ul className='list-group mb-3'>{drafts.map((d,index)=><li className='list-group-item d-flex justify-content-between align-items-center gap-2' key={String(d.input.idempotencyKey)}><span>{d.name} · {formatCount(String(d.input.quantity??1))} item{Number(d.input.quantity??1)===1?'':'s'}</span><button className='btn btn-sm btn-outline-secondary' disabled={busy||!!bulkAttempt} onClick={()=>setDrafts(old=>old.filter((_,i)=>i!==index))}>Remove</button></li>)}</ul><button className='btn btn-primary' disabled={busy||wait>0} onClick={()=>void sendList()}>{busy?'Sending requests…':bulkAttempt?'Retry request list':`Send ${drafts.length} requests`}</button></div>}
  {bulkNotice&&<p role='status' className='mt-3'>{bulkNotice} <Link href='/operator/requests' prefetch={false}>Check My requests</Link></p>}
  {notice&&<p role="status">{notice}{wait?` Try again in ${wait}s.`:""}</p>}
 </section>;
}
export function CreateProduct({businessCode}:{businessCode?:string|null}) {
 const router=useRouter();
 const [name,setName]=useState(""),[reference,setReference]=useState(""),[batch,setBatch]=useState(false),[amount,setAmount]=useState("2"),[publish,setPublish]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[created,setCreated]=useState<WriteResult|null>(null),[attempt,setAttempt]=useState<Attempt|null>(null),[retryAt,setRetryAt]=useState(0);
 const [fields,setFields]=useState<{id:string;label:string;value:string}[]>([]);const wait=useRetryWait(retryAt),locked=busy||!!attempt;
 const submit=async(event:FormEvent)=>{event.preventDefault();if(busy||created||wait)return;
  let current=attempt;
  if(!current){const quantity=batch?quantityNumber(amount,String(Number.MAX_SAFE_INTEGER),2):1;
   const input=createProductRequestSchema.safeParse({name,id:reference,quantity,fields:fields.map(({label,value})=>({label,value})),publish,idempotencyKey:crypto.randomUUID()});
   if(!input.success){setNotice("Enter a product name and ID, a valid whole-number batch quantity, and additional fields with a unique name and value. ID and quantity have dedicated fields.");return;}
   current={path:"products/create",payload:input.data};setAttempt(current);
  }
  setBusy(true);setNotice("");
  try{const result=await operatorWrite(current.path,current.payload);setNotice(message(result.status));if(result.status==="CONFIRMED")setCreated(result);else if(result.status==="FAILED")setAttempt(null);}
  catch(error){if(error instanceof OperatorError&&error.kind==="signedOut"){router.replace("/operator/sign-in");}setRetryAt((error as {retryAt?:number}).retryAt??0);if(error instanceof OperatorError&&error.kind==="invalid"){setAttempt(null);setNotice("Check your details. This request was rejected.");}else setNotice("Confirmation unavailable. Retry the same request or check Activity. Your original details are kept for this retry.");}
  finally{setBusy(false);}
 };
 return <section className="panel operator-panel"><h2>Product information</h2><form onSubmit={submit}>
  <fieldset className="auth-fields" disabled={locked||!!created}>
  <label className="input-label">Product name<input className="form-control" value={name} onChange={event=>setName(event.target.value)} required maxLength={240}/></label>
  <label className="input-label">Product / batch ID<input className="form-control" value={reference} onChange={event=>setReference(event.target.value)} required maxLength={240} aria-describedby="product-id-help"/></label>
  <p className="form-text" id="product-id-help">Use the ID already printed on your product, batch or serial label. It may match other registrations.</p>
  {businessCode&&<div className="business-code-suggestion"><p>Your business code: <strong>{businessCode}</strong>. You can print {businessCode} / YOUR-ID to reduce similar search results.</p><button className="btn btn-outline-secondary" type="button" disabled={!reference.trim()||reference.trim().startsWith(businessCode+" / ")} onClick={()=>setReference(businessCode+" / "+reference.trim())}>Use business code in this ID</button></div>}
  <div className="form-check"><input className="form-check-input" id="batch-product" type="checkbox" checked={batch} onChange={event=>{setBatch(event.target.checked);setAmount("2");}}/><label className="form-check-label" htmlFor="batch-product">Batch product</label></div>
  {batch?<label className="input-label">Number of items<input className="form-control" type="number" value={amount} onChange={event=>setAmount(event.target.value)} min="2" max={Number.MAX_SAFE_INTEGER} step="1" required/></label>:<p className="form-text">Single product · 1 item</p>}
  </fieldset>
  <fieldset className="product-detail-editor" disabled={locked||!!created}><legend>Product details</legend><p>Add details such as description, size, ingredients or expiry date.</p>
   {fields.map((field,index)=><div className="product-detail-row" key={field.id}>
    <label className="input-label">Detail name {index+1}<input className="form-control" value={field.label} onChange={event=>setFields(current=>current.map(item=>item.id===field.id?{...item,label:event.target.value}:item))} required maxLength={80} placeholder="e.g. Ingredients"/></label>
    <div className="input-label"><label htmlFor={`detail-value-${field.id}`}>Detail value {index+1}</label><textarea className="form-control" id={`detail-value-${field.id}`} rows={1} value={field.value} onChange={event=>setFields(current=>current.map(item=>item.id===field.id?{...item,value:event.target.value}:item))} required maxLength={1000}/></div>
    <button className="btn btn-outline-secondary" type="button" aria-label={`Remove field ${index+1}`} onClick={()=>setFields(current=>current.filter(item=>item.id!==field.id))}>Remove</button>
   </div>)}
   <button className="btn btn-outline-secondary" type="button" disabled={fields.length>=32} onClick={()=>setFields(current=>[...current,{id:crypto.randomUUID(),label:"",value:""}])}>Add field</button><p className="detail-context">{fields.length} of 32 fields added. Each field needs a different name.</p>
  </fieldset>
  <div className="form-check"><input className="form-check-input" id="share-product" type="checkbox" checked={publish} onChange={event=>setPublish(event.target.checked)} disabled={locked||!!created}/><label className="form-check-label" htmlFor="share-product">Share this product&apos;s details and supply history publicly, including the additional fields</label></div>
  <button className="btn btn-primary" disabled={busy||!!created||wait>0}>{busy?"Adding…":attempt?"Check confirmation":"Add product"}</button></form>
  {notice&&<p role="status">{notice}{wait?` Try again in ${wait}s.`:""}</p>}{created&&<><p>Tracking ID: <strong>{created.shortCode??created.trackingId}</strong></p><p className="form-text">{publish?"This tracking link will become public once the record is indexed.":"Keep this code for business receipts. Public tracking is unavailable until the product is shared."}</p><Link href={`/operator/products/${created.trackingId}`} prefetch={false}>View product</Link><ProductQR trackingId={created.trackingId} shortCode={created.shortCode}/><button className="btn btn-outline-secondary" onClick={()=>{setCreated(null);setName("");setReference("");setFields([]);setBatch(false);setAmount("2");setPublish(false);setAttempt(null);setNotice("");}}>Add another product</button></>}
 </section>;
}
export function ProductQR({trackingId,shortCode}:{trackingId:string;shortCode?:string|null}) {
 const siteOrigin=useSiteOrigin();
 const [url,setUrl]=useState("");const canvas=useRef<HTMLCanvasElement|null>(null);
 useEffect(()=>{const origin=publicOrigin(siteOrigin??window.location.origin,true);const link=origin+(shortCode?shortPath(shortCode):trackingPath(trackingId));setUrl(link);if(canvas.current)void QRCode.toCanvas(canvas.current,link,{width:240,margin:4,errorCorrectionLevel:"M"});},[trackingId,shortCode,siteOrigin]);
 return <div className="operator-qr"><h3>Product QR code</h3><canvas ref={canvas} role="img" aria-label="Product tracking QR code"/><HashValue label="Tracking ID" value={shortCode??trackingId}/>{shortCode&&<details><summary>Full tracking reference</summary><HashValue label="Full tracking reference" value={trackingId}/></details>}
  <a href={url}>Open tracking link</a><button className="btn btn-outline-secondary" onClick={()=>{const a=document.createElement("a");a.href=canvas.current!.toDataURL("image/png");a.download="traceforge-product-qr.png";a.click();}}>Download QR</button></div>;
}
export function CloseProduct({product,organizationId}:{product:OperatorProduct;organizationId:string}) {
 const router=useRouter();
 const [reason,setReason]=useState("Sold"),[text,setText]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[done,setDone]=useState(false),[attempt,setAttempt]=useState<Attempt|null>(null),[retryAt,setRetryAt]=useState(0),[routes,setRoutes]=useState<RoutePage|null>(null),[routeId,setRouteId]=useState(""),[amount,setAmount]=useState("1"),[version,setVersion]=useState<string|null>(null),[ready,setReady]=useState(!product.quantity);
 const active=useRef<AbortController|null>(null),lock=useRef(false),wait=useRetryWait(retryAt);const batch=product.quantity?.isBatch===true,legacy=!product.quantity;
 const load=async(after="0")=>{if(lock.current||retryAt>Date.now())return;lock.current=true;const controller=active.current??new AbortController();active.current=controller;setBusy(true);setNotice("");
  try{if(batch){const result=await operatorClient.routes(product.id,after,controller.signal);if(controller.signal.aborted)return;const own=result.routes.filter(r=>r.owner.id===organizationId);setRoutes(old=>({...result,routes:after==="0"?own:[...(old?.routes??[]),...own.filter(r=>!old?.routes.some(o=>o.id===r.id))]}));if(after==="0"&&own.length===1&&!result.page.hasMore)setRouteId(own[0].id);}
   else{const result=await receiveLookup(product.id,controller.signal);if(controller.signal.aborted)return;if(result.closed||result.holder?.id!==organizationId)throw new OperatorError("invalid");setVersion(result.version);}
   setReady(true);
  }catch(error){if(error instanceof OperatorError&&error.kind==="signedOut"){router.replace("/operator/sign-in");}if(!controller.signal.aborted){setNotice("Stock could not be refreshed. Refresh before removing items.");setRetryAt((error as {retryAt?:number}).retryAt??0);setReady(false);}}
  finally{if(active.current===controller){lock.current=false;setBusy(false);}}
 };
 useEffect(()=>{active.current=new AbortController();if(!legacy)void load();return()=>active.current?.abort();},[product.id]);
 const selected=routes?.routes.find(r=>r.id===routeId),n=batch?quantityNumber(amount,selected?.availableQuantity??"0"):1;
 const validText=removeProductRequestSchema.safeParse({version:batch?selected?.version??"0":version??"0",reason,reasonText:text,confirmed:true,idempotencyKey:"validation-only"}).success;
 const remove=async()=>{if(!confirmed||busy||wait||done||(!attempt&&(!ready||n===null||(!legacy&&!validText)||(batch&&!selected))))return;
  const current=attempt??{path:`products/${product.id}/${legacy?"close":"remove"}`,payload:legacy?{reason,confirmed:true,idempotencyKey:crypto.randomUUID()}:removeProductRequestSchema.parse({version:batch?selected!.version:version,reason,reasonText:text,confirmed:true,idempotencyKey:crypto.randomUUID(),...(batch?{routeId:selected!.id,quantity:n}:{})})};setAttempt(current);setBusy(true);
  try{const result=await operatorWrite(current.path,current.payload);setNotice(message(result.status));if(["CONFIRMED","FAILED"].includes(result.status))setDone(true);}
  catch(error){if(error instanceof OperatorError&&error.kind==="signedOut"){router.replace("/operator/sign-in");}setRetryAt((error as {retryAt?:number}).retryAt??0);setNotice(error instanceof OperatorError&&error.kind==="invalid"?"Stock changed or this request was rejected. Refresh before making a new request.":"Confirmation unavailable. Check Activity, or retry this same request.");if(error instanceof OperatorError&&error.kind==="invalid")setDone(true);}
  finally{setBusy(false);}
 };
 return <section className="panel operator-panel"><h2>Remove from supply chain</h2><p>{batch?"Remove only the items held by your business on the selected receipt. Other businesses keep their stock. One removal records the whole quantity.":"After removal, this product cannot be received again. Its history remains available."}</p>
 <fieldset className="auth-fields" disabled={busy||!!attempt||done}>
 {batch&&<><div className="input-label"><label htmlFor="owned-receipt">Your receipt</label><select id="owned-receipt" className="form-select" value={routeId} onChange={event=>{setRouteId(event.target.value);setConfirmed(false);setAmount("1");}}><option value="">Choose a receipt</option>{routes?.routes.map((r,index)=><option value={r.id} key={r.id}>Receipt {index+1} · {r.previousOwner?.name??"Original registration"} · {formatCount(r.availableQuantity)} available</option>)}</select></div>{selected&&<RouteDetails route={selected}/>}{routes?.page.hasMore&&<button type="button" className="btn btn-outline-secondary" onClick={()=>void load(routes.page.next!)} disabled={wait>0}>Show more of your receipts</button>}
 <label className="input-label">Number of items to remove<input className="form-control" type="number" min="1" max={selected?.availableQuantity??"0"} step="1" value={amount} onChange={event=>{setAmount(event.target.value);setConfirmed(false);}}/></label>{selected&&n===null&&<p role="alert">Enter a whole number from 1 to {formatCount(selected.availableQuantity)}.</p>}</>}
 <div className="input-label"><label htmlFor="removal-reason">Reason</label><select id="removal-reason" className="form-select" value={reason} onChange={event=>{setReason(event.target.value);setConfirmed(false);}}>{(legacy?["Sold","Lost","Damaged","Disposed"]:reasons).map(r=><option key={r} value={r}>{r==="Sold"?"Sold / delivered to customer":r}</option>)}</select></div>
 {!legacy&&<><label className="input-label">Explanation{reason==="Sold"?" (optional)":""}<textarea className="form-control" value={text} onChange={event=>{setText(event.target.value);setConfirmed(false);}} rows={3} required={reason!=="Sold"} maxLength={512} aria-describedby="removal-help"/></label><p id="removal-help" className="form-text">Saved permanently with this removal. Up to 256 characters. Explain losses, damage, spoilage or other removals.</p>{!validText&&<p className="form-error">Enter an explanation within 256 characters.</p>}</>}
 <div className="form-check"><input className="form-check-input" id="confirm-close" type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><label className="form-check-label" htmlFor="confirm-close">{batch?"I confirm these items should leave the supply chain":"I confirm this product should leave the supply chain"}</label></div>
 </fieldset>
 <button className="btn btn-primary" onClick={()=>void remove()} disabled={!confirmed||busy||done||wait>0||(!attempt&&(!ready||n===null||(batch&&!selected)||(!legacy&&!validText)))}>{busy?"Removing…":attempt&&!done?"Check confirmation":"Remove from supply chain"}</button>
 {notice&&<p role="status">{notice}{wait?` Try again in ${wait}s.`:""}</p>}
 {(!ready||done)&&<p className="form-text">Use Refresh at the top of the page to load current stock before another operation. Confirmed changes may take a moment to appear.</p>}
 {!ready&&!done&&<button type="button" className="btn btn-outline-secondary" disabled={busy||wait>0} onClick={()=>void load()}>Refresh stock</button>}
 </section>;
}
