"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Page render failed", { digest: error.digest || "UNAVAILABLE" }); }, [error]);
  return <main className="subpage"><div className="site-container not-found" role="alert">
    <div className="section-index">TEMPORARY INTERRUPTION</div><h1>We’ll get<br />things back on track.</h1>
    <p>This page could not be loaded. Please try again in a moment.</p>
    <button className="btn" onClick={reset}>Try again ↗</button>
  </div></main>;
}
