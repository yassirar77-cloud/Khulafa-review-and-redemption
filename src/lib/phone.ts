/**
 * Normalises a phone number to digits with country code, so "012-345 6789",
 * "+60123456789" and "60123456789" are all treated as the same customer.
 * Numbers starting with a single 0 are assumed to be Malaysian (+60).
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "60" + digits.slice(1);
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** Shows only the last 4 digits, for staff and admin screens. */
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? phone : "•••• " + phone.slice(-4);
}
