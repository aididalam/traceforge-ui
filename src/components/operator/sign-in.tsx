"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heading } from "../display";
export function OperatorSignIn(){
 const router=useRouter();
 const [activate,setActivate]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[invitation,setInvitation]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{if(retryAt<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[retryAt]);
 const wait=Math.max(0,Math.ceil((retryAt-now)/1000));
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(busy||wait)return;setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch(`/operator/api/${activate?"activate":"login"}`,{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password,...(activate?{name:name.trim(),invitationCode:invitation.trim()}: {})}),signal:AbortSignal.timeout(10000)});
   setPassword("");
   if(response.status===429){setRetryAt(Date.now()+Number(response.headers.get("retry-after")??60)*1000);setError("Please wait before trying again.");return;}
   if(!response.ok){setError(response.status===401?"Email or password is incorrect, or access is unavailable.":response.status===400?"Check your details. If you are joining, ask your administrator for a valid invitation.":"Sign in is temporarily unavailable. Try again shortly.");return;}
   if(activate){setInvitation("");setActivate(false);setSuccess("Your account is ready. Sign in with your email and password.");}
   else{router.replace("/operator");router.refresh();}
  }catch{setPassword("");setError("Sign in is temporarily unavailable. Try again shortly.");}finally{setBusy(false);}
 };
 return <section className="operator-auth panel"><span className="eyebrow">BUSINESS ACCESS</span><Heading>{activate?"Join your business":"Welcome back."}</Heading>
  <p>{activate?"Use the invitation provided by your administrator to create your account.":"Sign in to see your business's products and their supply history."}</p>
  <form onSubmit={submit}>
   {activate&&<label className="input-label">Your name<input value={name} onChange={event=>setName(event.target.value)} autoComplete="name" required maxLength={120}/></label>}
   <label className="input-label">Email address<input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" required maxLength={254}/></label>
   {activate&&<label className="input-label">Invitation code<input value={invitation} onChange={event=>setInvitation(event.target.value)} autoComplete="off" spellCheck={false} required maxLength={48}/></label>}
   <label className="input-label">Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={activate?"new-password":"current-password"} required minLength={activate?12:1} maxLength={128}/></label>
   {activate&&<p className="input-hint">Use at least 12 characters.</p>}
   {error&&<p className="form-error" role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
   <button className="button primary" type="submit" disabled={busy||wait>0}>{busy?"Please wait…":wait>0?`Try again in ${wait}s`:activate?"Create account":"Sign in"}</button>
  </form>
  <div className="operator-auth-links"><button className="text-button" type="button" onClick={()=>{setActivate(!activate);setError("");setPassword("");setInvitation("");}}>{activate?"I already have an account":"I have an invitation"}</button>
  <Link href="/" prefetch={false}>Track a product</Link></div>
  <p className="small-note">Need access or help with your account? Contact your business administrator.</p>
 </section>;
}
