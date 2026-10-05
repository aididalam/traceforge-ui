"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Heading } from "./display";
import { trackingPath } from "../lib/urls";

export function Lookup() {
  const router = useRouter();
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const path = trackingPath(tracking.trim());
      setError("");
      router.push(path);
    } catch { setError("That Tracking ID doesn't look complete. Copy and paste the full ID provided with your product."); }
  };
  return <div className="home-grid">
    <section className="home-intro"><span className="eyebrow">FOLLOW YOUR PRODUCT</span>
      <Heading>Every product has a journey.</Heading>
      <p className="home-lead">See your product's latest recorded status and the updates shared along its journey.</p>
      <div className="flow-illustration" aria-hidden="true"><span className="flow-node">01</span><span className="flow-line"/><span className="flow-node">02</span><span className="flow-line"/><span className="flow-node active">03</span></div>
      <div className="home-features"><div><span className="feature-number">01 /</span><strong>Latest status</strong><p>See the current recorded status.</p></div>
        <div><span className="feature-number">02 /</span><strong>Product history</strong><p>Follow the updates shared so far.</p></div>
        <div><span className="feature-number">03 /</span><strong>Supporting information</strong><p>See which updates include supporting references.</p></div></div>
    </section>
    <section className="lookup-card panel" aria-labelledby="lookup-heading"><span className="eyebrow">GET STARTED</span><h2 id="lookup-heading">Track a product</h2>
      <p>Enter the Tracking ID from your product or packaging.</p>
      <form onSubmit={submit}>
        <label className="input-label">Tracking ID<input name="trackingId" value={tracking} onChange={event => setTracking(event.target.value)} required maxLength={66} placeholder="Paste your Tracking ID" autoComplete="off" spellCheck={false} aria-describedby={error ? "lookup-error" : "lookup-hint"}/></label>
        <p id="lookup-hint" className="input-hint">Only information made available to everyone is shown here.</p>
        {error && <p id="lookup-error" className="form-error" role="alert">{error}</p>}
        <button className="button primary lookup-submit" type="submit">Track product <span aria-hidden="true">↗</span></button>
      </form>
      <div className="lookup-footnote"><span aria-hidden="true">◎</span><p>No account needed to track a product.</p></div>
    </section>
  </div>;
}
