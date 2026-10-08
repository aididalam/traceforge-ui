"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient } from "../lib/public-client";
import { operatorClient } from "../lib/operator-client";
import { normalizeId, normalizeShortCode, parseTraceLink, publicOrigin } from "../lib/urls";
import { businessCode, referenceId, type SearchPage } from "../lib/product-contract";
import { SupplyChainStatus } from "./product-information";
import { useRetryWait } from "./display";
import { useSiteOrigin } from "./site-config";
const publicClient=createPublicClient(process.env.NEXT_PUBLIC_API_BASE_URL??"");
export function trackingInput(value:string,siteOrigin:string|null=null){
 const direct=normalizeId(value.trim())??normalizeShortCode(value.trim());if(direct)return direct;
 const allowed=[window.location.origin];if(siteOrigin)allowed.push(publicOrigin(siteOrigin,true));
 const path=parseTraceLink(value,allowed,true);if(path.startsWith("/trace/"))throw Error();return path.split("/").at(-1)!;
}
export function ReferenceLookup({operator=false,initial="",busy=false,onSelect,onReset}:{operator?:boolean;initial?:string;busy?:boolean;onSelect:(id:string)=>void|Promise<void>;onReset?:()=>void}){
 const siteOrigin=useSiteOrigin();
 const router=useRouter();
 const [input,setInput]=useState(initial),[code,setCode]=useState(""),[results,setResults]=useState<SearchPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[retryAt,setRetryAt]=useState(0);
 const active=useRef<AbortController|null>(null),criteria=useRef<{id:string;code:string}|null>(null);const wait=useRetryWait(retryAt);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>setInput(initial),[initial]);
 const reset=()=>{active.current?.abort();criteria.current=null;setLoading(false);setResults(null);setError("");onReset?.();};
 const search=async(more=false)=>{
  if(busy||wait||loading)return;
  active.current?.abort();const controller=new AbortController();active.current=controller;
  if(!more){setResults(null);onReset?.();}
  setError("");setLoading(true);
  try{const id=referenceId.parse(more?criteria.current?.id:input),filter=code.trim()?businessCode.parse(code):"";
   if(!more)criteria.current={id,code:filter};
   const result=await (operator?operatorClient:publicClient).search(id,more?criteria.current!.code:filter,more?results?.page.next??"0":"0",controller.signal);
   if(controller.signal.aborted)return;
   setResults(old=>more&&old?{...result,products:[...old.products,...result.products.filter(p=>!old.products.some(o=>o.trackingId===p.trackingId))]}:result);
  }catch(error){if(controller.signal.aborted)return;if(operator&&(error as {kind?:string}).kind==="signedOut"){setResults(null);router.replace("/operator/sign-in");}setRetryAt((error as {retryAt?:number}).retryAt??0);setError("Search unavailable. Check the ID and business code, or try again shortly.");}
  finally{if(active.current===controller)setLoading(false);}
 };
 const choose=async(id:string)=>{active.current?.abort();setResults(null);setLoading(false);onReset?.();await onSelect(id);};
 return <div className="reference-lookup"><form onSubmit={event=>{event.preventDefault();if(busy||loading||wait)return;try{void choose(trackingInput(input,siteOrigin));}catch{if(/^(0x|[a-z][a-z0-9+.-]*:)/i.test(input.trim()))setError("Check the Tracking ID or use a product link from this site.");else void search();}}}>
  <label className="input-label">Tracking ID or product / batch ID<input className="form-control" value={input} onChange={event=>{reset();setInput(event.target.value);}} required maxLength={500} autoComplete="off" spellCheck={false} disabled={busy} aria-describedby="reference-help"/></label>
  <p id="reference-help" className="form-text">Use the short code, full Tracking ID, product link, or the ID printed by the business.</p>
  <details><summary>Filter by originating business</summary><label className="input-label">Originating business code (optional)<input className="form-control" value={code} onChange={event=>{reset();setCode(event.target.value.toUpperCase());}} maxLength={16} disabled={busy}/></label><p className="form-text">This filters business IDs. Tracking codes always identify one record.</p></details>
  <div className="action-row"><button className="btn btn-primary" disabled={busy||loading||wait>0}>{loading?"Searching…":operator?"Find product":"Track product"}</button><button type="button" className="btn btn-outline-secondary" disabled={busy||loading||wait>0||!input.trim()} onClick={()=>void search()}>Search product / batch ID</button></div>
 </form>
 {error&&<p role="alert">{error}{wait>0?` Try again in ${wait}s.`:""}</p>}
 {results&&<section aria-label="Matching products"><h3>Matching products</h3><p className="form-text">The same business ID can belong to different products. Choose the product you have.</p>
  {!results.products.length&&<p role="status">No matching products available to view.</p>}
  <ul className="selection-list">{results.products.map(product=><li key={product.trackingId}><strong>{product.name??"Product details not shared"}</strong><p>{product.externalId} · {product.origin.name??"Business name not shared"}{product.origin.businessCode?` (${product.origin.businessCode})`:""}</p><p>{product.isBatch?`${formatCount(product.availableQuantity)} out of ${formatCount(product.initialQuantity)} available`:"Single product"} · <SupplyChainStatus closed={!product.inSupplyChain}/></p><button type="button" className="btn btn-outline-secondary" onClick={()=>void choose(product.shortCode??product.trackingId)} disabled={busy}>Choose product</button><details><summary>Tracking reference</summary><code>{product.shortCode??product.trackingId}</code></details></li>)}</ul>
  {results.page.hasMore&&<button type="button" className="btn btn-outline-secondary" onClick={()=>void search(true)} disabled={loading||wait>0}>{loading?"Loading…":"Show more matches"}</button>}
 </section>}
 </div>;
}
export const formatCount=(value:string)=>BigInt(value).toLocaleString("en-US");
