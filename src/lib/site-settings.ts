import { logApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";

export type PublicSiteSettings = {
  phoneDisplay: string;
  phoneHref: string;
  location: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  mapsUrl: string;
};

const defaults: PublicSiteSettings = {
  phoneDisplay: site.phoneDisplay,
  phoneHref: site.phoneHref,
  location: site.location,
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || site.phoneHref.replace(/\D/g, ""),
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL || site.facebook,
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.location)}`,
};

function validMapsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isGoogleMapsHost = host === "google.com" || host.endsWith(".google.com") || host === "maps.app.goo.gl";
    return url.protocol === "https:" && isGoogleMapsHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const stored = await prisma.siteSetting.findMany({ select: { key: true, value: true } });
    const values = Object.fromEntries(stored.map(({ key, value }) => [key, value]));
    const phoneDisplay = values.phoneDisplay || defaults.phoneDisplay;
    const location = values.location || defaults.location;
    return {
      phoneDisplay,
      phoneHref: phoneDisplay.replace(/[^\d+]/g, ""),
      location,
      whatsappNumber: (values.whatsappNumber || defaults.whatsappNumber).replace(/\D/g, ""),
      facebookUrl: values.facebookUrl || defaults.facebookUrl,
      instagramUrl: values.instagramUrl ?? defaults.instagramUrl,
      mapsUrl: validMapsUrl(values.mapsUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
    };
  } catch (error) {
    logApiError("Public site settings", error);
    return defaults;
  }
}
