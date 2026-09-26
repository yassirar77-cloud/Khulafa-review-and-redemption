"use server";

import { redirect } from "next/navigation";
import { checkAdminPassword, hashPin } from "@/lib/auth";
import { slugify, toGoogleReviewUrl } from "@/lib/branches";
import { db } from "@/lib/db";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/session";

export type FormState = { error?: string };

export async function adminLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!process.env.ADMIN_PASSWORD) return { error: "ADMIN_PASSWORD is not configured on the server." };
  if (!checkAdminPassword(String(formData.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: "Wrong password." };
  }
  await startAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin");
}

export async function saveBranchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? Number(idRaw) : null;
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const reviewUrl = toGoogleReviewUrl(String(formData.get("google") ?? ""));
  const rewardText = String(formData.get("reward_text") ?? "").trim() || "Free drink";
  const validHours = Number(formData.get("voucher_valid_hours"));
  const cooldownDays = Number(formData.get("cooldown_days"));
  const pin = String(formData.get("pin") ?? "").trim();
  const active = formData.get("active") === "on";

  if (!name) return { error: "Branch name is required." };
  if (!slug) return { error: "Link name must contain letters or numbers." };
  if (reviewUrl === null) return { error: "Google review link must be a Place ID or a link starting with https://." };
  if (!Number.isInteger(validHours) || validHours < 1 || validHours > 24 * 90) {
    return { error: "Voucher validity must be between 1 and 2160 hours." };
  }
  if (!Number.isInteger(cooldownDays) || cooldownDays < 0 || cooldownDays > 365) {
    return { error: "Days between rewards must be between 0 and 365." };
  }
  if (pin && !/^\d{4,8}$/.test(pin)) return { error: "Staff PIN must be 4 to 8 digits." };
  if (!id && !pin) return { error: "Set a staff PIN so the branch can redeem vouchers." };

  const pinHash = pin ? hashPin(pin) : null;

  try {
    if (id) {
      await db()`
        UPDATE branches SET
          name = ${name}, slug = ${slug}, google_review_url = ${reviewUrl},
          reward_text = ${rewardText}, voucher_valid_hours = ${validHours},
          cooldown_days = ${cooldownDays}, active = ${active},
          staff_pin_hash = COALESCE(${pinHash}, staff_pin_hash),
          failed_pin_attempts = CASE WHEN ${pinHash}::text IS NULL THEN failed_pin_attempts ELSE 0 END,
          pin_locked_until = CASE WHEN ${pinHash}::text IS NULL THEN pin_locked_until ELSE NULL END
        WHERE id = ${id}`;
    } else {
      await db()`
        INSERT INTO branches (name, slug, google_review_url, reward_text, voucher_valid_hours,
                              cooldown_days, staff_pin_hash, active)
        VALUES (${name}, ${slug}, ${reviewUrl}, ${rewardText}, ${validHours},
                ${cooldownDays}, ${pinHash}, ${active})`;
    }
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { error: `Another branch already uses the link name "${slug}".` };
    }
    throw err;
  }
  redirect("/admin");
}
