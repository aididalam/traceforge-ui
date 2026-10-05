import Link from "next/link";

export default function NotFound() {
  return <section className="problem-card"><span className="eyebrow">PAGE NOT FOUND</span><h1 className="page-title">Let's find your product.</h1>
    <p>This page does not exist. Enter your Tracking ID to find your product.</p><Link className="button primary" href="/">Track a product</Link></section>;
}
