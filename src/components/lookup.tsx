"use client";

import { ReferenceLookup } from "./reference-lookup";

import { useRouter } from "next/navigation";
import { Heading } from "./display";
import { lookupPath } from "../lib/urls";

export function Lookup() {
  const router = useRouter();
  return <div className="home-grid">
    <section className="home-intro"><span className="eyebrow">Follow your product</span>
      <Heading>Every product has a journey.</Heading>
      <p className="home-lead">See your product's latest recorded status and the updates shared along its journey.</p>
      <div className="flow-illustration" aria-hidden="true"><span className="flow-node">01</span><span className="flow-line"/><span className="flow-node">02</span><span className="flow-line"/><span className="flow-node active">03</span></div>
      <div className="home-features"><div><span className="feature-number">01 /</span><strong>Latest status</strong><p>See the current recorded status.</p></div>
        <div><span className="feature-number">02 /</span><strong>Product history</strong><p>Follow the updates shared so far.</p></div>
        <div><span className="feature-number">03 /</span><strong>Supporting information</strong><p>See which updates include supporting references.</p></div></div>
    </section>
    <section className="lookup-card panel" aria-labelledby="lookup-heading"><span className="eyebrow">Get started</span><h2 id="lookup-heading">Track a product</h2>
      <p>Enter a tracking code or the product / batch ID printed on the packaging.</p>
      <ReferenceLookup onSelect={id=>router.push(lookupPath(id))}/>
      <p className="input-hint">Only information made available to everyone is shown here.</p>
      <div className="lookup-footnote"><span aria-hidden="true">◎</span><p>No account needed to track a product.</p></div>
    </section>
  </div>;
}
