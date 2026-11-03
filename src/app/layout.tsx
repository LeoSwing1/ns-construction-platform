import type { Metadata } from "next";
import "./globals.css";
import AnalyticsConsent from "@/components/AnalyticsConsent";
import { site } from "@/lib/site";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata: Metadata = {
  title: { default: "N.S. Construction | Building with purpose", template: "%s | N.S. Construction" },
  description: "Discuss residential, commercial and civil construction requirements with N.S. Construction in Lucknow, Uttar Pradesh.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    title: "N.S. Construction | Building with purpose",
    description: "Thoughtful project conversations and considered construction work in Lucknow, Uttar Pradesh.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image", title: "N.S. Construction", description: "Construction and project consultations in Lucknow, Uttar Pradesh." },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    name: site.name,
    url: siteUrl,
    telephone: site.phoneDisplay,
    address: { "@type": "PostalAddress", addressLocality: "Lucknow", addressRegion: "Uttar Pradesh", addressCountry: "IN" },
    sameAs: [site.facebook],
  };
  return <html lang="en"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
    {children}
    <AnalyticsConsent />
  </body></html>;
}