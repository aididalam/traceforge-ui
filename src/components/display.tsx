"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicApiError } from "../lib/public-client";
import { useSiteOrigin } from "./site-config";

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
    <div className="hash-content"><code>{value}</code><button className="btn btn-outline-secondary btn-sm copy-button" aria-label={`Copy ${label}`} onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button></div>
    <span className="sr-only" role="status">{copied ? `${label} copied.` : copyFailed ? "Copy unavailable. Select and copy the value manually." : ""}</span>
  </div>;
}

export function CopyTrackingLink({ path }: { path: string }) {
  const origin = useSiteOrigin();
  const [status, setStatus] = useState<"ready" | "copied" | "failed">("ready");
  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("ready"), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, origin ?? window.location.origin).href);
      setStatus("copied");
    } catch { setStatus("failed"); }
  };
  return <div className="share-tracking">
    <button className="btn btn-outline-secondary" onClick={copy}>{status === "copied" ? "Link copied" : "Copy tracking link"}</button>
    <span className={status === "failed" ? "small-note" : "sr-only"} role="status">
      {status === "copied" ? "Tracking link copied." : status === "failed" ? "Copy unavailable. Copy the link from your browser's address bar." : ""}
    </span>
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
  const title = error.kind === "missing" ? "Product history unavailable" : error.kind === "rateLimited" ? "Please wait a moment" :
    error.kind === "invalid" ? "Check your Tracking ID" : "Product tracking is temporarily unavailable";
  const description = error.kind === "missing" ? "We can't show this product's history. Check the Tracking ID or ask the business that gave it to you." :
    error.kind === "rateLimited" ? "Please wait before checking again." :
    error.kind === "invalid" ? "Copy and paste the complete Tracking ID provided with your product, then try again." :
    "We couldn't load the product's history. Please try again in a moment.";
  return <section className={inline ? "inline-problem" : "problem-card"} role="alert">
    {!inline && <div className="problem-symbol" aria-hidden="true">↗</div>}
    {inline ? <h3>{title}</h3> : <Heading>{title}</Heading>}
    <p>{description}</p>
    <div className="actions">
      {error.kind !== "invalid" && <button className="btn btn-primary" onClick={retry} disabled={wait > 0}>
        {wait > 0 ? `Try again in ${wait}s` : "Try again"}
      </button>}
      {!inline && <Link className="btn btn-outline-secondary" href="/" prefetch={false}>Track another product</Link>}
    </div>
  </section>;
}

export function displayDate(value: string): string {
  const millis = BigInt(value) * 1000n;
  if (millis > 8640000000000000n) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Number(millis)));
}

export function recordedTime(value: string | null) {
  if (value === null || !/^(0|[1-9][0-9]{0,19})$/.test(value)) return null;
  const millis = BigInt(value) * 1000n;
  if (millis > 8640000000000000n) return null;
  const date = new Date(Number(millis));
  return { iso: date.toISOString(), label: new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "UTC",
  }).format(date) + " UTC" };
}

export function RecordedTime({ value }: { value: string | null }) {
  const time = recordedTime(value);
  return time ? <time dateTime={time.iso}>{time.label}</time> : <span>Date unavailable</span>;
}
