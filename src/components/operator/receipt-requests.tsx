'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {operatorClient,operatorReceiptDecisions,OperatorError} from '../../lib/operator-client';
import {receiptDecisionsRequestSchema} from '../../lib/operator-contract';
import type {ReceiptRequest} from '../../lib/operator-contract';
import {HashValue,useRetryWait} from '../display';
import {formatCount} from '../reference-lookup';

const labels:Record<string,string>={WAITING_APPROVAL:'Awaiting owner approval',APPROVING:'Awaiting blockchain confirmation',CONFIRMED:'Received',DECLINED:'Declined',CANCELLED:'Cancelled',EXPIRED:'Expired',FAILED:'Transfer failed'};
const errors:Record<string,string>={quantity_exceeds_available:'Not enough available stock. Approve fewer requests or refresh.',stock_changed:'The owner or stock version changed. Ask the receiver to refresh and make a new request.',request_not_pending:'This request is no longer awaiting a decision.',request_expired:'This request expired.',request_not_found:'This request is unavailable to your business.'};
const date=(value:string)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC';
export function ReceiptRequests(){
 const router=useRouter(),active=useRef<AbortController|null>(null);
 const [direction,setDirection]=useState<'incoming'|'outgoing'>('incoming'),[requests,setRequests]=useState<ReceiptRequest[]>([]),[next,setNext]=useState<string|null>(null),[selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failures,setFailures]=useState<{id:string;message:string}[]>([]),[retryAt,setRetryAt]=useState(0);
 const wait=useRetryWait(retryAt),pending=requests.filter(r=>r.status==='WAITING_APPROVAL');
 const load=useCallback(async(after='0')=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;
  try{const page=await operatorClient.receiptRequests(direction,after,controller.signal);if(controller.signal.aborted)return;
   setRequests(old=>after==='0'?page.requests:[...old,...page.requests.filter(r=>!old.some(o=>o.id===r.id))]);setNext(page.page.next);
   setSelected(old=>after==='0'?old.filter(id=>page.requests.some(r=>r.id===id&&r.status==='WAITING_APPROVAL')):old);
  }catch(error){if(controller.signal.aborted)return;if(error instanceof OperatorError&&error.kind==='signedOut')router.replace('/operator/sign-in');
   setRetryAt((error as {retryAt?:number}).retryAt??0);setNotice('Requests could not be refreshed. Try again shortly.');}
 },[direction,router]);
 useEffect(()=>{setRequests([]);setSelected([]);setNext(null);setNotice('');void load();return()=>{active.current?.abort();};},[load]);
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!busy&&!selected.length&&requests.length<=50&&!wait)void load();},10000);return()=>clearInterval(timer);},[load,busy,selected.length,requests.length,wait]);
 const decide=async(action:'approve'|'decline'|'cancel')=>{
  if(busy||wait||!selected.length)return;setBusy(true);setFailures([]);setNotice('');
  try{
   const payload=receiptDecisionsRequestSchema.parse({requestIds:selected,action,idempotencyKey:crypto.randomUUID()});
   const response=await operatorReceiptDecisions(payload),accepted=response.results.filter(r=>r.ok);
   setFailures(response.results.filter(r=>!r.ok).map(r=>({id:r.requestId,message:errors[r.error?.code??'']??'This request could not be completed. Refresh and try again.'})));
   setNotice(action==='approve'?`${accepted.length} request${accepted.length===1?'':'s'} queued for blockchain transfer.`:`${accepted.length} request${accepted.length===1?'':'s'} ${action==='decline'?'declined':'cancelled'}.`);
   setSelected([]);await load();
  }catch(error){if(error instanceof OperatorError&&error.kind==='signedOut')router.replace('/operator/sign-in');setRetryAt((error as {retryAt?:number}).retryAt??0);setNotice('The decision could not be confirmed. Refresh the list before retrying.');}
  finally{setBusy(false);}
 };
 return <section className='panel operator-panel' aria-label='Receipt requests'>
  <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3'><h2>Receipt requests</h2><button className='btn btn-outline-secondary' disabled={busy||wait>0} onClick={()=>void load()}>Refresh requests</button></div>
  <div className='btn-group mb-3' role='group' aria-label='Request direction'>
   <button className={'btn '+(direction==='incoming'?'btn-primary':'btn-outline-secondary')} disabled={busy} aria-pressed={direction==='incoming'} onClick={()=>setDirection('incoming')}>Incoming requests</button>
   <button className={'btn '+(direction==='outgoing'?'btn-primary':'btn-outline-secondary')} disabled={busy} aria-pressed={direction==='outgoing'} onClick={()=>setDirection('outgoing')}>My requests</button>
  </div>
  <p>{direction==='incoming'?'Check the receiving business and quantity before approving. Approval authorizes the transfer; inventory updates after blockchain confirmation.':'Pending requests do not add stock to your inventory. The current holder must approve each receipt.'}</p>
  {pending.length>0&&<div className='d-flex flex-wrap align-items-center gap-3 mb-3'>
   <label className='form-check d-flex align-items-center gap-2 mb-0'><input className='form-check-input mt-0' type='checkbox' disabled={busy} checked={pending.every(r=>selected.includes(r.id))} onChange={e=>setSelected(e.target.checked?pending.slice(0,100).map(r=>r.id):[])}/>Select pending requests</label>
   {direction==='incoming'?<><button className='btn btn-primary' disabled={busy||wait>0||!selected.length} onClick={()=>void decide('approve')}>Approve selected ({selected.length})</button><button className='btn btn-outline-secondary' disabled={busy||wait>0||!selected.length} onClick={()=>void decide('decline')}>Decline selected</button></>:<button className='btn btn-outline-secondary' disabled={busy||wait>0||!selected.length} onClick={()=>void decide('cancel')}>Cancel selected</button>}
  </div>}
  <div className='d-grid gap-3'>{requests.map(request=>{
   const business=direction==='incoming'?request.requester:request.source;
   return <article className='border rounded p-3' key={request.id}>
    <div className='d-flex flex-wrap align-items-start justify-content-between gap-2'>
     <label className='d-flex align-items-center gap-2'><input className='form-check-input mt-0' type='checkbox' aria-label={`Select ${request.name??'product'} request from ${business.name??business.id}`} checked={selected.includes(request.id)} disabled={busy||request.status!=='WAITING_APPROVAL'||!selected.includes(request.id)&&selected.length>=100} onChange={e=>setSelected(old=>e.target.checked?[...old,request.id]:old.filter(id=>id!==request.id))}/><strong>{request.name??'Product'}</strong></label>
     <span className={'badge '+(request.status==='CONFIRMED'?'text-bg-success':'text-bg-secondary')}>{labels[request.status]}</span>
    </div>
    <p className='mt-2 mb-1'><strong>{formatCount(request.quantity)} item{request.quantity==='1'?'':'s'}</strong> · {direction==='incoming'?'Requested by':'Requested from'} <strong>{business.name??'Business name unavailable'}</strong></p>
    <HashValue label='Business Organization ID' value={business.id}/>{business.walletAddress&&<HashValue label={direction==='incoming'?'Requester wallet address':'Owner wallet address'} value={business.walletAddress}/>}
    <p className='small text-body-secondary mb-1'>Requested: <time dateTime={request.createdAt}>{date(request.createdAt)}</time> · Expires: <time dateTime={request.expiresAt}>{date(request.expiresAt)}</time></p>
    {request.errorCode&&<p className='text-danger mb-1'>{errors[request.errorCode]??'The transfer could not complete. Refresh stock before making a new request.'}</p>}
    {request.status==='CONFIRMED'&&<Link href={`/operator/products/${request.trackingId}`} prefetch={false}>View received product</Link>}
    <details className='mt-2'><summary>Request references</summary><HashValue label='Request ID' value={request.id}/><HashValue label='Tracking ID' value={request.trackingId}/>{request.sourceRouteId&&<HashValue label='Source stock route' value={request.sourceRouteId}/>} {request.transactionHash&&<HashValue label='Transaction reference' value={request.transactionHash}/>}</details>
   </article>;
  })}</div>
  {!requests.length&&<p>No receipt requests to show.</p>}
  {next&&<button className='btn btn-outline-secondary mt-3' disabled={busy||wait>0} onClick={()=>void load(next)}>Show more requests</button>}
  {notice&&<p className='mt-3' role='status'>{notice}{wait?` Try again in ${wait}s.`:''}</p>}
  {failures.length>0&&<div role='alert'><ul>{failures.map(f=><li key={f.id}>{requests.find(r=>r.id===f.id)?.name??'Product'}: {f.message}</li>)}</ul></div>}
 </section>;
}
