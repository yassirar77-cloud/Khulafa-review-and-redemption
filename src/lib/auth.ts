import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type Session = { role: "admin" } | { role: "staff"; branchId: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return s;
}

function mac(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signSession(session: Session, maxAgeSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds }),
  ).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    if (data.role === "admin") return { role: "admin" };
    if (data.role === "staff" && Number.isInteger(data.branchId)) {
      return { role: "staff", branchId: data.branchId };
    }
  } catch {
    // fall through
  }
  return null;
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function checkPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const given = scryptSync(pin, salt, 32);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function checkAdminPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return false;
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(configured).digest();
  return timingSafeEqual(a, b);
}
