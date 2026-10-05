"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicApiError } from "../lib/public-client";

export const shortId = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

export function Heading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [children]);
  return <h1 className="page-title" ref={ref} tabIndex={-1}>{children}</h1>;
}

export function HashValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setCopyFailed(false); }
    catch { setCopyFailed(true); }
  };
  return <div className="hash-row">
    <span className="field-label">{label}</span>
    <div className="hash-content"><code>{value}</code><button className="copy-button" aria-label={`Copy ${label}`} onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button></div>
    <span className="sr-only" role="status">{copied ? `${label} copied.` : copyFailed ? "Copy unavailable. Select and copy the value manually." : ""}</span>
  </div>;
}

export function useRetryWait(retryAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [retryAt]);
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export function Problem({ error, retry, inline = false }: { error: PublicApiError; retry: () => void; inline?: boolean }) {
  const wait = useRetryWait(error.retryAt);
  const title = error.kind === "missing" ? "Public trace unavailable" : error.kind === "rateLimited" ? "A short pause" :
    error.kind === "invalid" ? "This trace link is invalid" : "Records are temporarily unavailable";
  const description = error.kind === "missing" ? "This trace cannot be viewed publicly. Check the link or ask the organization that provided it." :
    error.kind === "rateLimited" ? "Too many requests were made. Please wait before trying again." :
    error.kind === "invalid" ? "Use a complete TraceForge link, or enter valid tenant and entity IDs." :
    "We could not reach the public record service. You can try again in a moment.";
  return <section className={inline ? "inline-problem" : "problem-card"} role="alert">
    {!inline && <div className="problem-symbol" aria-hidden="true">↗</div>}
    {inline ? <h3>{title}</h3> : <Heading>{title}</Heading>}
    <p>{description}</p>
    <div className="actions">
      {error.kind !== "invalid" && <button className="button primary" onClick={retry} disabled={wait > 0}>
        {wait > 0 ? `Try again in ${wait}s` : "Try again"}
      </button>}
      {!inline && <Link className="button secondary" href="/" prefetch={false}>Back to lookup</Link>}
    </div>
  </section>;
}

export function displayDate(value: string): string {
  const millis = BigInt(value) * 1000n;
  if (millis > 8640000000000000n) return `Unix seconds ${value}`;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Number(millis)));
}
