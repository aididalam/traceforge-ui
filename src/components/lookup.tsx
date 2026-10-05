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
    } catch { setError("Enter a complete Tracking ID: 0x followed by 64 hexadecimal characters."); }
  };
  return <div className="home-grid">
    <section className="home-intro"><span className="eyebrow">PROVENANCE MADE VISIBLE</span>
      <Heading>Every record has a journey.</Heading>
      <p className="home-lead">Follow the published history behind an entity. See its current state, recorded events, and evidence references in one place.</p>
      <div className="flow-illustration" aria-hidden="true"><span className="flow-node">01</span><span className="flow-line"/><span className="flow-node">02</span><span className="flow-line"/><span className="flow-node active">03</span></div>
      <div className="home-features"><div><span className="feature-number">01 /</span><strong>Current state</strong><p>Where the record stands today.</p></div>
        <div><span className="feature-number">02 /</span><strong>Recorded history</strong><p>Its available public events.</p></div>
        <div><span className="feature-number">03 /</span><strong>Evidence references</strong><p>Hashes that connect the records.</p></div></div>
    </section>
    <section className="lookup-card panel" aria-labelledby="lookup-heading"><span className="eyebrow">OPEN A PUBLIC RECORD</span><h2 id="lookup-heading">Track a product</h2>
      <p>Enter the Tracking ID provided with your product.</p>
      <form onSubmit={submit}>
        <label className="input-label">Tracking ID<input name="trackingId" value={tracking} onChange={event => setTracking(event.target.value)} required maxLength={66} placeholder="0x…" autoComplete="off" spellCheck={false} aria-describedby={error ? "lookup-error" : "lookup-hint"}/></label>
        <p id="lookup-hint" className="input-hint">Only explicitly published records can be viewed here.</p>
        {error && <p id="lookup-error" className="form-error" role="alert">{error}</p>}
        <button className="button primary lookup-submit" type="submit">View public trace <span aria-hidden="true">↗</span></button>
      </form>
      <div className="lookup-footnote"><span aria-hidden="true">◎</span><p>An open view, with no account needed.</p></div>
    </section>
  </div>;
}
