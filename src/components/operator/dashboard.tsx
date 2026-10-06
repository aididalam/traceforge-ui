"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heading, HashValue, RecordedTime, useRetryWait } from "../display";
import { readableLabel } from "../../lib/display-labels";
import { operatorClient, OperatorError } from "../../lib/operator-client";
import { normalizeId } from "../../lib/urls";
import type { OperatorUser,OperatorProduct,OperatorHistory,OperatorBusinesses,OperatorOperations } from "../../lib/operator-contract";

import { ReceiveProduct, CreateProduct, CloseProduct, ProductQR } from "./product-actions";
import { ProductMetadata, SupplyChainStatus } from "../product-information";

type Section="overview"|"products"|"businesses"|"activity"|"product"|"receive"|"create";
type Data={user:OperatorUser;products:OperatorProduct[];next:string|null;businesses:OperatorBusinesses;operations:OperatorOperations;history:OperatorHistory|null};
const friendly=(value:string|null,fallback:string)=>value?readableLabel(value):fallback;
const operationNames:Record<string,string>={createEntity:"Product added",recordTrace:"Update recorded",updateEntityState:"Status changed",updateEntityMetadata:"Product information updated",createEntityLink:"Related product added",setEntityLinkActive:"Product connection updated",claimCustody:"Product received",closeEntity:"Out of supply chain"};
const eventNames:Record<string,string>={EntityCreated:"Product added",CustodyClaimed:"Product received",EntityClosed:"Out of supply chain",EntityMetadataUpdated:"Product details updated",TraceRecorded:"Product update"};
const operationStatuses:Record<string,string>={PREPARED:"Prepared",BROADCAST:"Awaiting confirmation",CONFIRMED:"Confirmed",FAILED:"Failed"};
export function OperatorDashboard({section="overview",productId,initialTracking}:{section?:Section;productId?:string;initialTracking?:string}){
 const router=useRouter(),active=useRef<AbortController|null>(null),lock=useRef(false);
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<OperatorError|null>(null),[version,setVersion]=useState(0),[paging,setPaging]=useState(false),[filter,setFilter]=useState("all"),[search,setSearch]=useState("");
 const [signingOut,setSigningOut]=useState(false);
 const [menuOpen,setMenuOpen]=useState(false);
 const wait=useRetryWait(error?.retryAt??0);
 const refresh=useCallback(()=>{active.current?.abort();setData(null);setLoading(true);setVersion(value=>value+1);},[]);
 const fail=useCallback((problem:unknown)=>{const issue=problem instanceof OperatorError?problem:new OperatorError("unavailable");setError(issue);if(issue.kind==="signedOut"){setData(null);router.replace("/operator/sign-in");}},[router]);
 useEffect(()=>{
  if(section==="product"&&(!productId||!normalizeId(productId))){setError(new OperatorError("invalid"));setLoading(false);return;}
  const controller=new AbortController();active.current=controller;lock.current=false;setPaging(false);setData(null);setError(null);setLoading(true);
  Promise.all([operatorClient.me(controller.signal),operatorClient.products("0",controller.signal),operatorClient.businesses(controller.signal),operatorClient.operations(controller.signal),
   productId?operatorClient.history(productId,"0",controller.signal):Promise.resolve(null)])
   .then(([me,products,businesses,operations,history])=>{if(!controller.signal.aborted){setData({user:me.user,products:products.products,next:products.page.next,businesses,operations,history});document.documentElement.classList.remove("operator-suspended");}})
   .catch(problem=>{if(!controller.signal.aborted){fail(problem);document.documentElement.classList.remove("operator-suspended");}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[section,productId,version,fail]);
 useEffect(()=>{
  const hide=()=>{document.documentElement.classList.add("operator-suspended");active.current?.abort();};
  const restore=()=>{if(error&&error.retryAt>Date.now()){setData(null);setLoading(false);document.documentElement.classList.remove("operator-suspended");}else refresh();};
  const visibility=()=>{if(document.visibilityState==="hidden")hide();else restore();};
  const show=(event:PageTransitionEvent)=>{if(event.persisted)restore();};
  document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",hide);window.addEventListener("pageshow",show);
  return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",hide);window.removeEventListener("pageshow",show);};
 },[refresh,error]);
 useEffect(()=>()=>document.documentElement.classList.remove("operator-suspended"),[]);
 const more=async(history=false)=>{
  if(!data||lock.current||wait>0)return;const controller=active.current;if(!controller||controller.signal.aborted)return;
  const after=history?data.history?.page.next:data.next;if(!after)return;
  lock.current=true;setPaging(true);setError(null);
  try{if(history){const result=await operatorClient.history(productId!,after,controller.signal);if(!controller.signal.aborted)setData(previous=>previous?{...previous,history:{...result,events:[...previous.history!.events,...result.events.filter(event=>!previous.history!.events.some(old=>old.id===event.id))]}}:null);}
   else{const result=await operatorClient.products(after,controller.signal);if(!controller.signal.aborted)setData(previous=>previous?{...previous,products:[...previous.products,...result.products.filter(product=>!previous.products.some(old=>old.id===product.id))],next:result.page.next}:null);}
  }catch(problem){if(!controller.signal.aborted)fail(problem);}finally{lock.current=false;setPaging(false);}
 };
 const logout=async()=>{if(signingOut)return;setSigningOut(true);active.current?.abort();setData(null);
  try{const result=await fetch("/operator/api/logout",{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)});if(!result.ok&&result.status!==401)throw Error();router.replace("/operator/sign-in");router.refresh();}
  catch{setError(new OperatorError("unavailable"));setLoading(false);setSigningOut(false);}
 };
 const errorView=error&&<div className="inline-problem" role="alert"><h2>{error.kind==="missing"?"Product unavailable":error.kind==="invalid"?"Check this product link":error.kind==="rateLimited"?"Please wait a moment":"Dashboard temporarily unavailable"}</h2><p>{error.kind==="missing"?"This product could not be found in your business history.":"We couldn't load this information. Try again shortly."}</p><button className="btn btn-outline-secondary" onClick={refresh} disabled={wait>0}>{wait?`Try again in ${wait}s`:"Try again"}</button></div>;
 if(!data)return <section className="operator-loading"><Heading>{loading?"Loading your dashboard…":"Business dashboard"}</Heading>{loading?<p role="status">Checking your account and loading products.</p>:errorView}<Link href="/operator/sign-in" prefetch={false}>Back to sign in</Link></section>;
 const filtered=data.products.filter(product=>(filter!=="mine"||product.holder.id===data.user.organizationId)&&
  (filter!=="open"||!product.closed)&&(filter!=="closed"||product.closed)&&
  (!search||[product.name,product.closed?"Out of supply chain":"In supply chain",product.holder.name,product.id].some(value=>value?.toLowerCase().includes(search.toLowerCase()))));
 const businessName=(id:string|null)=>id?data.businesses.businesses.find(business=>business.id===id)?.name??"Business name unavailable":"Business not recorded";
 const title=section==="product"?friendly(data.history?.product.name??null,"Product details"):section==="create"?"Add a product":section==="receive"?"Receive a product":section==="products"?"Products":section==="businesses"?"Businesses":section==="activity"?"Activity":"Business dashboard";
 return <div className="operator-frame" data-operator-record>
  <aside className="operator-sidebar" aria-label="Business sidebar" data-menu-open={menuOpen}><div className="operator-sidebar-heading"><div><span className="eyebrow">Your business</span><h2>{data.user.organizationName??data.user.workspaceName??"Business workspace"}</h2>{data.user.workspaceName&&data.user.workspaceName!==data.user.organizationName&&<p>{data.user.workspaceName}</p>}</div><button className="btn btn-outline-secondary operator-menu-toggle" aria-expanded={menuOpen} aria-controls="business-menu" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?"Hide menu":"Show menu"}</button></div>
   <div className="operator-sidebar-body" id="business-menu">
   <nav aria-label="Business dashboard"><Link href="/operator" aria-current={section==="overview"?"page":undefined} prefetch={false}>Overview</Link><Link href="/operator/products" aria-current={section==="products"||section==="product"||section==="create"?"page":undefined} prefetch={false}>Products</Link><Link href="/operator/receive" aria-current={section==="receive"?"page":undefined} prefetch={false}>Receive a product</Link><Link href="/operator/businesses" aria-current={section==="businesses"?"page":undefined} prefetch={false}>Businesses</Link><Link href="/operator/activity" aria-current={section==="activity"?"page":undefined} prefetch={false}>Activity</Link></nav>
   <div className="operator-account"><strong>{data.user.name}</strong><p>{data.user.email}</p><button className="btn btn-outline-secondary" onClick={logout} disabled={signingOut}>Sign out</button></div>
   </div>
  </aside>
  <div className="operator-content"><div className="trace-heading"><div><span className="eyebrow">Business dashboard</span><Heading>{title}</Heading><p>{section==="create"?"Add a product and choose which details to share publicly.":"Products your business produced, received or handled across supply chains."}</p></div><div className="operator-page-actions">{section==="products"&&<Link className="btn btn-primary" href="/operator/products/new" prefetch={false}>Add product</Link>}{section==="create"&&<Link className="btn btn-outline-secondary" href="/operator/products" prefetch={false}>Back to products</Link>}<button className="btn btn-outline-secondary refresh" onClick={refresh} disabled={wait>0}>Refresh</button></div></div>
   <div className="operator-notice">Receive products after physical handover. Only the current holder can remove a product from the supply chain.</div>{errorView}
   {section==="receive"&&<ReceiveProduct initial={initialTracking}/>}
   {section==="create"&&<CreateProduct/>}
   {section==="overview"&&<div className="operator-stats"><div className="panel"><span>Products loaded</span><strong>{data.products.length}{data.next?"+":""}</strong></div><div className="panel"><span>Currently with your business</span><strong>{data.products.filter(product=>product.holder.id===data.user.organizationId).length}</strong></div><div className="panel"><span>Businesses shown</span><strong>{data.businesses.businesses.length}</strong></div></div>}
   {(section==="overview"||section==="products")&&<section className="panel operator-panel" aria-label="Workspace products"><div className="operator-section-title"><h2>{section==="overview"?"Products your business has handled":"Product list"}</h2><span>{filtered.length} shown</span></div>
    <div className="operator-filters"><label className="input-label">Find a product<input className="form-control" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Product name, status or reference"/></label><div className="input-label"><label htmlFor="product-status-filter">Show</label><select className="form-select" id="product-status-filter" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All products</option><option value="mine">With my business</option><option value="open">In supply chain</option><option value="closed">Out of supply chain</option></select></div></div>
    <p className="small-note">Search and filters apply to loaded products. Load more to include additional products.</p>
    <div className="operator-product-list">{filtered.map(product=><Link className="operator-product-row" href={`/operator/products/${product.id}`} key={product.id} prefetch={false}><div><strong>{friendly(product.name,"Unnamed product")}</strong><span>{friendly(product.type,"Product")}</span></div><div><span>Current status</span><SupplyChainStatus closed={product.closed}/></div><div><span>Current holder</span><strong>{product.holder.name??"Business name unavailable"}</strong></div><span aria-hidden="true">↗</span></Link>)}</div>
    {!filtered.length&&<p className="empty-history">No products match this view.</p>}{data.next&&<button className="btn btn-outline-secondary" onClick={()=>void more()} disabled={paging||wait>0}>{paging?"Loading…":"Show more products"}</button>}
   </section>}
   {section==="businesses"&&<section className="panel operator-panel"><h2>Businesses</h2><div className="operator-business-list">{data.businesses.businesses.map(business=><article key={business.id}><h3>{business.name??"Business name unavailable"}</h3><p>{business.type??"Business type unavailable"} · {business.active?"Active":"Inactive"}</p><details><summary>Business reference</summary><HashValue label="Business reference" value={business.id}/></details></article>)}</div>{!data.businesses.businesses.length&&<p>No businesses are recorded.</p>}{data.businesses.truncated&&<p>Showing the first 200 businesses.</p>}</section>}
   {section==="activity"&&<section className="panel operator-panel"><h2>Recent activity</h2><p className="small-note">Check progress here. Product history may take a moment to show a confirmed update.</p><div className="operator-operations">{data.operations.operations.map(operation=><article key={operation.id}><h3>{operationNames[operation.name]??readableLabel(operation.name)}</h3><span className="tag">{operationStatuses[operation.status]}</span><p><time dateTime={operation.updatedAt}>{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(operation.updatedAt))} UTC</time></p><Link href={`/operator/products/${operation.productId}`} prefetch={false}>View product</Link><details><summary>Operation references</summary><HashValue label="Operation reference" value={operation.id}/><HashValue label="Transaction reference" value={operation.transactionHash}/></details></article>)}</div>{!data.operations.operations.length&&<p className="empty-history">No operations are recorded for your business.</p>}{data.operations.truncated&&<p>Showing the most recent 50 operations.</p>}</section>}
   {section==="product"&&data.history&&<><section className="panel operator-panel"><h2>Product information</h2><ProductMetadata product={data.history.product}/><div className="operator-product-summary"><div><span>Current status</span><SupplyChainStatus closed={data.history.product.closed}/></div><div><span>Current holder</span><strong>{data.history.product.holder.name??"Business name unavailable"}</strong></div><div><span>Added to tracking</span><RecordedTime value={data.history.product.createdAt}/></div></div><details><summary>Product reference</summary><HashValue label="Internal product reference" value={data.history.product.id}/></details></section>
    <ProductQR trackingId={data.history.product.id}/>
    {!data.history.product.closed&&data.history.product.holder.id===data.user.organizationId&&<CloseProduct trackingId={data.history.product.id}/>}
    <section className="panel operator-panel"><h2>Supply history</h2><p className="small-note">Recorded dates and businesses, in order. Times are in UTC.</p><ol className="operator-timeline">{data.history.events.map((event,index)=><li key={event.id}><span className="eyebrow">Update {index+1}</span><h3>{event.name==="EntityClosed"?<SupplyChainStatus closed/>:friendly(event.label,eventNames[event.name]??friendly(event.name,"Product update"))}</h3><RecordedTime value={event.occurredAt}/><p>{event.fromId||event.toId?`${businessName(event.fromId)} → ${businessName(event.toId)}`:businessName(event.organizationId)}</p><details><summary>Update references</summary><HashValue label="Update reference" value={event.id}/><HashValue label="Transaction reference" value={event.transactionHash}/></details></li>)}</ol>{!data.history.events.length&&<p>No updates are recorded yet.</p>}{data.history.page.next&&<button className="btn btn-outline-secondary" onClick={()=>void more(true)} disabled={paging||wait>0}>{paging?"Loading…":"Show more updates"}</button>}</section></>}
  </div>
 </div>;
}
