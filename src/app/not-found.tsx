import Link from "next/link";

export default function NotFound() {
  return <main className="subpage"><div className="site-container not-found">
    <div className="section-index">404 / PAGE NOT FOUND</div><h1>This page is<br />not on the plans.</h1>
    <p>The address may have changed, or the page may no longer be published.</p>
    <Link className="btn" href="/">Return to N.S. Construction ↗</Link>
  </div></main>;
}
