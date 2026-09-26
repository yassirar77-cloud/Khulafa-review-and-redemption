"use server";

import { redirect } from "next/navigation";
import { checkPin } from "@/lib/auth";
import { getBranchById } from "@/lib/branches";
import { db } from "@/lib/db";
import { maskPhone } from "@/lib/phone";
import { endStaffSession, staffBranchId, startStaffSession } from "@/lib/session";
import { formatDateTime, getVoucher, redeemVoucher, voucherProblem } from "@/lib/vouchers";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type LoginState = { error?: string };

export async function staffLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const branchId = Number(formData.get("branchId"));
  const pin = String(formData.get("pin") ?? "");
  const branch = Number.isInteger(branchId) ? await getBranchById(branchId) : null;
  if (!branch || !branch.active) return { error: "Please choose your branch." };
  if (!branch.staff_pin_hash) return { error: "No staff PIN set for this branch yet. Ask the owner." };
  if (branch.pin_locked_until && branch.pin_locked_until > new Date()) {
    return { error: `Too many wrong PINs. Try again after ${formatDateTime(branch.pin_locked_until)}.` };
  }

  if (!checkPin(pin, branch.staff_pin_hash)) {
    await db()`
      UPDATE review.branches SET
        failed_pin_attempts = CASE WHEN failed_pin_attempts + 1 >= ${MAX_ATTEMPTS} THEN 0 ELSE failed_pin_attempts + 1 END,
        pin_locked_until = CASE WHEN failed_pin_attempts + 1 >= ${MAX_ATTEMPTS}
          THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE pin_locked_until END
      WHERE id = ${branch.id}`;
    return { error: "Wrong PIN." };
  }

  await db()`UPDATE review.branches SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ${branch.id}`;
  await startStaffSession(branch.id);
  redirect("/staff");
}

export async function staffLogoutAction(): Promise<void> {
  await endStaffSession();
  redirect("/staff");
}

export type VoucherPreview = {
  code: string;
  customerName: string;
  phone: string;
  reward: string;
  created: string;
  problem: string | null;
};

export type RedeemState = {
  preview?: VoucherPreview;
  error?: string;
  success?: string;
};

/** One action for both steps so each result replaces the previous one on screen. */
export async function voucherAction(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  return formData.get("intent") === "redeem" ? redeem(formData) : lookup(formData);
}

async function lookup(formData: FormData): Promise<RedeemState> {
  const branchId = await staffBranchId();
  if (!branchId) redirect("/staff");
  const code = String(formData.get("code") ?? "");
  const voucher = await getVoucher(code);
  if (!voucher) return { error: "No voucher with that code. Check the letters and try again." };
  return {
    preview: {
      code: voucher.code,
      customerName: voucher.customer_name,
      phone: maskPhone(voucher.phone),
      reward: voucher.reward_text,
      created: formatDateTime(voucher.created_at),
      problem: voucherProblem(voucher, branchId),
    },
  };
}

async function redeem(formData: FormData): Promise<RedeemState> {
  const branchId = await staffBranchId();
  if (!branchId) redirect("/staff");
  const result = await redeemVoucher(branchId, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: result.error };
  return {
    success: `Redeemed ${result.voucher.code}: give ${result.voucher.customer_name} their ${result.voucher.reward_text.toLowerCase()}.`,
  };
}
