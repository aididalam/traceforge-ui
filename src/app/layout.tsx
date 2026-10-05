import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceForge · Public provenance",
  description: "Explore explicitly published provenance and an entity's recorded journey.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header"><div className="shell header-inner"><Link className="brand" href="/" prefetch={false} aria-label="TraceForge home">
      <img src="/favicon.svg" width="36" height="36" alt=""/><span>TraceForge<span className="brand-dot">.</span></span></Link>
      <span className="header-label"><span aria-hidden="true"/>Public provenance</span></div></header>
    <main id="main-content" className="shell main-content">{children}</main>
    <footer className="site-footer shell"><span>TraceForge</span><p>Published records. Connected histories.</p><span className="footer-label">PUBLIC VIEW</span></footer>
  </body></html>;
}
