import { randomInt } from "crypto";
import { db } from "./db";
import { normalizePhone } from "./phone";

// No 0/O, 1/I/L so codes are easy to read out at the counter.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export type Voucher = {
  id: number;
  code: string;
  branch_id: number;
  customer_name: string;
  phone: string;
  reward_text: string;
  created_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
};

export type VoucherWithBranch = Voucher & { branch_name: string; branch_slug: string };

export type ClaimResult =
  | { ok: true; code: string; existing: boolean }
  | { ok: false; error: string };

export type RedeemResult =
  | { ok: true; voucher: Voucher }
  | { ok: false; error: string };

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function cleanCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function claimVoucher(
  branchSlug: string,
  nameInput: string,
  phoneInput: string,
): Promise<ClaimResult> {
  const name = nameInput.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Please enter your name." };
  const phone = normalizePhone(phoneInput);
  if (!phone) return { ok: false, error: "Please enter a valid phone number." };

  return db().begin(async (sql) => {
    const [branch] = await sql<
      { id: number; reward_text: string; voucher_valid_hours: number; cooldown_days: number }[]
    >`SELECT id, reward_text, voucher_valid_hours, cooldown_days
      FROM branches WHERE slug = ${branchSlug} AND active`;
    if (!branch) return { ok: false, error: "This branch is not taking part right now." };

    // Serialise claims for the same phone at the same branch so a double tap
    // cannot create two vouchers.
    await sql`SELECT pg_advisory_xact_lock(hashtext(${branch.id + ":" + phone}))`;

    const [recent] = await sql<Pick<Voucher, "code" | "created_at" | "expires_at" | "redeemed_at">[]>`
      SELECT code, created_at, expires_at, redeemed_at FROM vouchers
      WHERE branch_id = ${branch.id} AND phone = ${phone}
      ORDER BY created_at DESC LIMIT 1`;

    if (recent) {
      const stillUsable = !recent.redeemed_at && recent.expires_at > new Date();
      if (stillUsable) return { ok: true, code: recent.code, existing: true };
      const nextAllowed = new Date(recent.created_at.getTime() + branch.cooldown_days * 86_400_000);
      if (nextAllowed > new Date()) {
        return {
          ok: false,
          error: `This number already claimed a reward recently. You can claim again from ${nextAllowed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`,
        };
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const rows = await sql<{ code: string }[]>`
        INSERT INTO vouchers (code, branch_id, customer_name, phone, reward_text, expires_at)
        VALUES (${code}, ${branch.id}, ${name}, ${phone}, ${branch.reward_text},
                now() + make_interval(hours => ${branch.voucher_valid_hours}))
        ON CONFLICT (code) DO NOTHING
        RETURNING code`;
      if (rows.length) return { ok: true, code: rows[0].code, existing: false };
    }
    throw new Error("Could not generate a unique voucher code");
  });
}

export async function getVoucher(codeInput: string): Promise<VoucherWithBranch | null> {
  const code = cleanCode(codeInput);
  const [row] = await db()<VoucherWithBranch[]>`
    SELECT v.*, b.name AS branch_name, b.slug AS branch_slug
    FROM vouchers v JOIN branches b ON b.id = v.branch_id
    WHERE v.code = ${code}`;
  return row ?? null;
}

/** Explains why a voucher can't be used at this branch, or null if it can. */
export function voucherProblem(v: Voucher | null, branchId: number): string | null {
  if (!v) return "No voucher with that code.";
  if (v.branch_id !== branchId) return "This voucher is for a different branch.";
  if (v.redeemed_at) return `Already redeemed on ${formatDateTime(v.redeemed_at)}.`;
  if (v.expires_at <= new Date()) return `Expired on ${formatDateTime(v.expires_at)}.`;
  return null;
}

export async function redeemVoucher(branchId: number, codeInput: string): Promise<RedeemResult> {
  const code = cleanCode(codeInput);
  // Single conditional UPDATE so two tills can't redeem the same code.
  const [row] = await db()<Voucher[]>`
    UPDATE vouchers SET redeemed_at = now()
    WHERE code = ${code} AND branch_id = ${branchId}
      AND redeemed_at IS NULL AND expires_at > now()
    RETURNING *`;
  if (row) return { ok: true, voucher: row };
  const problem = voucherProblem(await getVoucher(code), branchId);
  return { ok: false, error: problem ?? "Could not redeem this voucher." };
}

export async function listRecentVouchers(limit: number, branchId?: number): Promise<VoucherWithBranch[]> {
  return db()<VoucherWithBranch[]>`
    SELECT v.*, b.name AS branch_name, b.slug AS branch_slug
    FROM vouchers v JOIN branches b ON b.id = v.branch_id
    ${branchId ? db()`WHERE v.branch_id = ${branchId}` : db()``}
    ORDER BY v.created_at DESC LIMIT ${limit}`;
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur",
  });
}
