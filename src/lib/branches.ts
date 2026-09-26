import { db } from "./db";

export type Branch = {
  id: number;
  slug: string;
  name: string;
  google_review_url: string;
  reward_text: string;
  voucher_valid_hours: number;
  cooldown_days: number;
  staff_pin_hash: string | null;
  failed_pin_attempts: number;
  pin_locked_until: Date | null;
  active: boolean;
  created_at: Date;
};

export type BranchStats = Branch & {
  scans: number;
  review_clicks: number;
  vouchers_issued: number;
  vouchers_redeemed: number;
};

export async function getBranchBySlug(slug: string): Promise<Branch | null> {
  const [row] = await db()<Branch[]>`SELECT * FROM review.branches WHERE slug = ${slug}`;
  return row ?? null;
}

export async function getBranchById(id: number): Promise<Branch | null> {
  const [row] = await db()<Branch[]>`SELECT * FROM review.branches WHERE id = ${id}`;
  return row ?? null;
}

export async function listActiveBranches(): Promise<Pick<Branch, "id" | "name">[]> {
  return db()<Pick<Branch, "id" | "name">[]>`
    SELECT id, name FROM review.branches WHERE active ORDER BY name`;
}

/** All branches with counts from the last `days` days. */
export async function listBranchStats(days: number): Promise<BranchStats[]> {
  return db()<BranchStats[]>`
    SELECT b.*,
      (SELECT count(*)::int FROM review.events e WHERE e.branch_id = b.id AND e.type = 'scan'
         AND e.created_at > now() - make_interval(days => ${days})) AS scans,
      (SELECT count(*)::int FROM review.events e WHERE e.branch_id = b.id AND e.type = 'review_click'
         AND e.created_at > now() - make_interval(days => ${days})) AS review_clicks,
      (SELECT count(*)::int FROM review.vouchers v WHERE v.branch_id = b.id
         AND v.created_at > now() - make_interval(days => ${days})) AS vouchers_issued,
      (SELECT count(*)::int FROM review.vouchers v WHERE v.branch_id = b.id
         AND v.redeemed_at > now() - make_interval(days => ${days})) AS vouchers_redeemed
    FROM review.branches b
    ORDER BY b.active DESC, b.name`;
}

export async function recordEvent(branchId: number, type: "scan" | "review_click"): Promise<void> {
  await db()`INSERT INTO review.events (branch_id, type) VALUES (${branchId}, ${type})`;
}

/** Accepts either a full Google review link or a bare Place ID. */
export function toGoogleReviewUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) {
    return `https://search.google.com/local/writereview?placeid=${value}`;
  }
  return null;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
