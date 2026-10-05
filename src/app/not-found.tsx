import Link from "next/link";

export default function NotFound() {
  return <section className="problem-card"><span className="eyebrow">PAGE NOT FOUND</span><h1 className="page-title">Let's find your trace.</h1>
    <p>This page does not exist. Start with your trace link or entity identifiers.</p><Link className="button primary" href="/">Back to lookup</Link></section>;
}
