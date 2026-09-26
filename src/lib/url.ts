import { headers } from "next/headers";

/** Base URL used in QR codes: PUBLIC_BASE_URL if set, otherwise the current host. */
export async function publicBaseUrl(): Promise<string> {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
