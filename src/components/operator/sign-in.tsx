"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heading } from "../display";
export function OperatorSignIn(){
 const router=useRouter();
 const [signup,setSignup]=useState(false),[businessName,setBusinessName]=useState(""),[businessType,setBusinessType]=useState(""),[publicProfile,setPublicProfile]=useState(false);
 const [activate,setActivate]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[invitation,setInvitation]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{if(retryAt<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[retryAt]);
 const wait=Math.max(0,Math.ceil((retryAt-now)/1000));
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(busy||wait)return;
  if(signup&&(!businessType.trim()||/[\x00-\x1f\x7f]/.test(businessType))){setError("Enter a business type, such as a repair workshop or customs broker.");return;}
  setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch(`/operator/api/${signup?"signup":activate?"activate":"login"}`,{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password,...(signup?{name:name.trim(),businessName:businessName.trim(),businessType:businessType.trim(),publicProfile}:activate?{name:name.trim(),invitationCode:invitation.trim()}: {})}),signal:AbortSignal.timeout(signup?55000:10000)});
   setPassword("");
   if(response.status===429){setRetryAt(Date.now()+Number(response.headers.get("retry-after")??60)*1000);setError("Please wait before trying again.");return;}
   if(!response.ok){setError(response.status===401?"Email or password is incorrect, or access is unavailable.":response.status===400?activate?"Check your details and invitation code. Ask your business administrator for a new invitation if needed.":"Check your details and try again.":"Sign in is temporarily unavailable. Try again shortly.");return;}
   if(signup){const result=await response.json();if(result.pending){setSuccess("Registration is awaiting confirmation. Submit the same details again to finish.");return;}setSignup(false);setSuccess("Your business account is ready. Sign in with your email and password.");}
   else if(activate){setInvitation("");setActivate(false);setSuccess("Your account is ready. Sign in with your email and password.");}
   else{router.replace("/operator");router.refresh();}
  }catch{setPassword("");setError("Sign in is temporarily unavailable. Try again shortly.");}finally{setBusy(false);}
 };
 return <section className="operator-auth panel"><span className="eyebrow">Business account</span><Heading>{signup?"Register your business":activate?"Join your business":"Welcome back."}</Heading>
  <p>{signup?"Create your own business account. You can add products and receive them from any registered business.":activate?"Use the invitation provided by your administrator to create your account.":"Sign in to see your business's products and their supply history."}</p>
  <form onSubmit={submit}>
   <fieldset className="auth-fields" disabled={busy}>
   {(signup||activate)&&<label className="input-label">Your name<input className="form-control" value={name} onChange={event=>setName(event.target.value)} autoComplete="name" required maxLength={120}/></label>}
   {signup&&<><label className="input-label">Business name<input className="form-control" autoComplete="organization" value={businessName} onChange={event=>setBusinessName(event.target.value)} required maxLength={120}/></label><div><label className="input-label">Business type<input className="form-control" list="business-type-suggestions" value={businessType} onChange={event=>setBusinessType(event.target.value)} required maxLength={120} placeholder="e.g. Repair workshop or customs broker" aria-describedby="business-type-help"/></label>
     <datalist id="business-type-suggestions">{["Manufacturer","Distributor","Transport company","Warehouse","Retailer","Importer","Exporter","Repair workshop","Recycler"].map(type=><option key={type} value={type}/>)}</datalist>
     <p className="form-text" id="business-type-help">Choose a suggestion or write your own. This describes your business; it does not limit who you can receive products from.</p></div>
    <div className="form-check"><input className="form-check-input" id="public-business-name" type="checkbox" checked={publicProfile} onChange={event=>setPublicProfile(event.target.checked)}/><label className="form-check-label" htmlFor="public-business-name">Show my business name in public product history</label></div></>}
   <label className="input-label">Email address<input className="form-control" type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" required maxLength={254}/></label>
   {activate&&<label className="input-label">Invitation code<input className="form-control" value={invitation} onChange={event=>setInvitation(event.target.value)} autoComplete="off" spellCheck={false} required maxLength={48}/></label>}
   <div><label className="input-label">Password<input className="form-control" type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={signup||activate?"new-password":"current-password"} required minLength={signup||activate?12:1} maxLength={128} aria-describedby={signup||activate?"password-help":undefined}/></label>
   {(signup||activate)&&<p id="password-help" className="form-text">Use at least 12 characters.</p>}
   </div>
   </fieldset>
   {error&&<p className="form-error" role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
   <button className="btn btn-primary" type="submit" disabled={busy||wait>0}>{busy?"Please wait…":wait>0?`Try again in ${wait}s`:signup?"Register business":activate?"Create account":"Sign in"}</button>
  </form>
  <div className="operator-auth-links"><button className="btn btn-link" type="button" disabled={busy} onClick={()=>{setSignup(!signup);setActivate(false);setError("");setSuccess("");setPassword("");}}>{signup?"I already have an account":"Register a business"}</button><button className="btn btn-link" type="button" disabled={busy} onClick={()=>{setActivate(!activate);setSignup(false);setError("");setSuccess("");setPassword("");setInvitation("");}}>{activate?"I already have an account":"I have an invitation"}</button>
  <Link href="/" prefetch={false}>Track a product</Link></div>
  <p className="small-note">Register your own business, or use an invitation to join an existing team.</p>
 </section>;
}
