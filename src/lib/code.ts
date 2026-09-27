// Browser-safe voucher code helpers (no database imports), shared by the
// server and the staff QR scanner.

export function cleanCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

/**
 * Pulls a voucher code out of whatever a scanned QR contains: the staff link
 * printed on vouchers (…/staff?code=482913), a voucher page link (…/v/482913),
 * or a bare code. Returns null for anything else. Only the code is used; the
 * scanned link itself is never opened.
 */
export function parseScannedCode(text: string): string | null {
  const value = text.trim();
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    const path = url.pathname.replace(/\/+$/, "");
    let raw: string | null = null;
    if (path.endsWith("/staff")) raw = url.searchParams.get("code");
    else raw = path.match(/\/v\/([^/]+)$/)?.[1] ?? null;
    const code = raw ? cleanCode(decodeURIComponent(raw)) : "";
    return CODE_PATTERN.test(code) ? code : null;
  }
  if (!/^[A-Za-z0-9 -]{4,16}$/.test(value)) return null;
  const code = cleanCode(value);
  return CODE_PATTERN.test(code) ? code : null;
}
