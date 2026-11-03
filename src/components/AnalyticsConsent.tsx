"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type Consent = "accepted" | "rejected" | null;
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

export default function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ns-analytics-consent");
    if (saved === "accepted" || saved === "rejected") setConsent(saved);
    else setVisible(true);
  }, []);

  function choose(value: Exclude<Consent, null>) {
    localStorage.setItem("ns-analytics-consent", value);
    setConsent(value);
    setVisible(false);
  }

  const analyticsId = process.env.NEXT_PUBLIC_GA_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const enabled = consent === "accepted";

  return <>
    {enabled && analyticsId && <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`} strategy="afterInteractive" />
      <Script id="ns-google-analytics" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.gtag = function(){ window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ${JSON.stringify(analyticsId)}, { anonymize_ip: true });
      `}</Script>
    </>}
    {enabled && pixelId && <Script id="ns-meta-pixel" strategy="afterInteractive">{`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', ${JSON.stringify(pixelId)}); window.fbq('track', 'PageView');
    `}</Script>}
    {visible && <aside className="consent-banner" aria-label="Analytics choices">
      <div><strong>Privacy choices</strong><p>Optional analytics help us understand site use. They remain off unless you choose to allow them. <a href="/privacy">Privacy policy</a></p></div>
      <div className="consent-actions"><button onClick={() => choose("rejected")}>Reject optional</button><button onClick={() => choose("accepted")}>Allow analytics</button></div>
    </aside>}
  </>;
}
