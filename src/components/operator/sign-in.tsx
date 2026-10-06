"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { businessCode as businessCodeSchema } from "../../lib/product-contract";
import { Heading } from "../display";
import { BusinessTypePicker } from "./business-type-picker";
export function OperatorSignIn(){
 const router=useRouter();
 const [signup,setSignup]=useState(false),[businessName,setBusinessName]=useState(""),[businessType,setBusinessType]=useState(""),[publicProfile,setPublicProfile]=useState(false);
 const [businessCode,setBusinessCode]=useState("");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{if(retryAt<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[retryAt]);
 const wait=Math.max(0,Math.ceil((retryAt-now)/1000));
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(busy||wait)return;
  if(signup&&(!businessType.trim()||/[\x00-\x1f\x7f]/.test(businessType))){setError("Enter a business type, such as a repair workshop or customs broker.");return;}
  if(signup&&businessCode.trim()&&!businessCodeSchema.safeParse(businessCode).success){setError("Business code must use 1–16 letters or numbers.");return;}
  setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch(`/operator/api/${signup?"signup":"login"}`,{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password,...(signup?{name:name.trim(),businessName:businessName.trim(),businessType:businessType.trim(),publicProfile,...(businessCode.trim()?{businessCode:businessCodeSchema.parse(businessCode)}:{})}: {})}),signal:AbortSignal.timeout(signup?55000:10000)});
   setPassword("");
   if(response.status===429){setRetryAt(Date.now()+Number(response.headers.get("retry-after")??60)*1000);setError("Please wait before trying again.");return;}
   if(!response.ok){setError(response.status===401?"Email or password is incorrect, or access is unavailable.":response.status===409?"That business code or account is unavailable. Choose another code and try again.":response.status===400?"Check your details and try again.":"Sign in is temporarily unavailable. Try again shortly.");return;}
   if(signup){const result=await response.json();if(result.pending){setSuccess("Registration is awaiting confirmation. Submit the same details again to finish.");return;}setSignup(false);setSuccess("Your business account is ready. Sign in with your email and password."+(result.businessCode?` Your business code is ${result.businessCode}.`:""));}
   else{router.replace("/operator");router.refresh();}
  }catch{setPassword("");setError("Sign in is temporarily unavailable. Try again shortly.");}finally{setBusy(false);}
 };
 return <section className="operator-auth panel"><span className="eyebrow">Business account</span><Heading>{signup?"Register your business":"Welcome back."}</Heading>
  <p>{signup?"Create your own business account. You can add products and receive them from any registered business.":"Sign in to see your business's products and their supply history."}</p>
  <form onSubmit={submit}>
   <fieldset className="auth-fields" disabled={busy}>
   {signup&&<label className="input-label">Your name<input className="form-control" value={name} onChange={event=>setName(event.target.value)} autoComplete="name" required maxLength={120}/></label>}
   {signup&&<><label className="input-label">Business name<input className="form-control" autoComplete="organization" value={businessName} onChange={event=>setBusinessName(event.target.value)} required maxLength={120}/></label><BusinessTypePicker value={businessType} onChange={setBusinessType} disabled={busy}/>
    <label className="input-label">Business code (optional)<input className="form-control" value={businessCode} onChange={event=>setBusinessCode(event.target.value.toUpperCase())} maxLength={16} aria-describedby="business-code-help"/></label><p className="form-text" id="business-code-help">Leave blank for an automatic unique code, or choose 1–16 letters or numbers. You can use it on product labels.</p>
    <div className="form-check"><input className="form-check-input" id="public-business-name" type="checkbox" checked={publicProfile} onChange={event=>setPublicProfile(event.target.checked)}/><label className="form-check-label" htmlFor="public-business-name">Show my business name in public product history</label></div></>}
   <label className="input-label">Email address<input className="form-control" type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" required maxLength={254}/></label>
   <div><label className="input-label">Password<input className="form-control" type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={signup?"new-password":"current-password"} required minLength={signup?12:1} maxLength={128} aria-describedby={signup?"password-help":undefined}/></label>
   {signup&&<p id="password-help" className="form-text">Use at least 12 characters.</p>}
   </div>
   </fieldset>
   {error&&<p className="form-error" role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
   <button className="btn btn-primary" type="submit" disabled={busy||wait>0}>{busy?"Please wait…":wait>0?`Try again in ${wait}s`:signup?"Register business":"Sign in"}</button>
  </form>
  <div className="operator-auth-links"><button className="btn btn-link" type="button" disabled={busy} onClick={()=>{setSignup(!signup);setError("");setSuccess("");setPassword("");}}>{signup?"I already have an account":"Register a business"}</button>
  <Link href="/" prefetch={false}>Track a product</Link></div>
  <p className="small-note">Each business registers independently. No invitation is needed.</p>
 </section>;
}
