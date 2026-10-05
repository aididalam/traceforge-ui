"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Heading } from "./display";
import { parseTraceLink, publicOrigin, tracePath } from "../lib/urls";

export function Lookup() {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "ids">("link");
  const [link, setLink] = useState("");
  const [tenant, setTenant] = useState("");
  const [entity, setEntity] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const current = window.location.origin;
      const approved = process.env.NEXT_PUBLIC_SITE_ORIGIN ? publicOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN, true) : current;
      const path = mode === "ids" ? tracePath(tenant.trim(), entity.trim()) : parseTraceLink(link, [current, approved], true);
      setError("");
      router.push(path);
    } catch { setError(mode === "ids" ? "Enter both complete IDs: 0x followed by 64 hexadecimal characters." : "Enter a complete trace link from this site, without credentials, query parameters or a fragment."); }
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
    <section className="lookup-card panel" aria-labelledby="lookup-heading"><span className="eyebrow">OPEN A PUBLIC RECORD</span><h2 id="lookup-heading">Start with a trace link</h2>
      <p>Use the link or identifiers provided with your entity.</p>
      <div className="lookup-modes" aria-label="Lookup method">
        <button type="button" aria-pressed={mode === "link"} onClick={() => { setMode("link"); setError(""); }}>Trace link</button>
        <button type="button" aria-pressed={mode === "ids"} onClick={() => { setMode("ids"); setError(""); }}>Entity IDs</button>
      </div>
      <form onSubmit={submit}>
        {mode === "link" ? <label className="input-label">Trace link<input type="url" name="traceLink" value={link} onChange={event => setLink(event.target.value)} required maxLength={1024} placeholder="https://…/trace/0x…/0x…" autoComplete="off" spellCheck={false} aria-describedby={error ? "lookup-error" : "lookup-hint"}/></label> :
          <><label className="input-label">Tenant ID<input name="tenantId" value={tenant} onChange={event => setTenant(event.target.value)} required maxLength={66} placeholder="0x…" autoComplete="off" spellCheck={false} aria-describedby={error ? "lookup-error" : "lookup-hint"}/></label>
            <label className="input-label">Entity ID<input name="entityId" value={entity} onChange={event => setEntity(event.target.value)} required maxLength={66} placeholder="0x…" autoComplete="off" spellCheck={false} aria-describedby={error ? "lookup-error" : "lookup-hint"}/></label></>}
        <p id="lookup-hint" className="input-hint">Only explicitly published records can be viewed here.</p>
        {error && <p id="lookup-error" className="form-error" role="alert">{error}</p>}
        <button className="button primary lookup-submit" type="submit">View public trace <span aria-hidden="true">↗</span></button>
      </form>
      <div className="lookup-footnote"><span aria-hidden="true">◎</span><p>An open view, with no account needed.</p></div>
    </section>
  </div>;
}
