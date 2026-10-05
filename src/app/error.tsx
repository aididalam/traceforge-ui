"use client";

import { Heading } from "../components/display";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="problem-card" role="alert"><Heading>We could not open this page</Heading><p>Please try again in a moment.</p>
    <button className="button primary" onClick={reset}>Try again</button></section>;
}
