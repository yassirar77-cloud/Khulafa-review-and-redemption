import { maskPhone } from "./phone";
import { cleanCode, formatDateTime, getVoucher, voucherProblem } from "./vouchers";

export type VoucherPreview = {
  code: string;
  customerName: string;
  phone: string;
  reward: string;
  rewardNote: string;
  created: string;
  problem: string | null;
};

export type RedeemState = {
  code?: string;
  preview?: VoucherPreview;
  error?: string;
  success?: string;
};

/**
 * The "Check code" step: read-only, never redeems. Used both when the cashier
 * types a code and when they open a scanned /staff?code= link.
 */
export async function previewVoucher(branchId: number, codeInput: string): Promise<RedeemState> {
  const code = cleanCode(codeInput);
  const voucher = code ? await getVoucher(code) : null;
  if (!voucher) return { code, error: "No voucher with that code. Check the code and try again." };
  return {
    code: voucher.code,
    preview: {
      code: voucher.code,
      customerName: voucher.customer_name,
      phone: maskPhone(voucher.phone),
      reward: voucher.reward_text,
      rewardNote: voucher.branch_reward_note,
      created: formatDateTime(voucher.created_at),
      problem: voucherProblem(voucher, branchId),
    },
  };
}

/** Staff page link, optionally carrying a voucher code to check straight away. */
export function staffPath(codeInput?: string | null): string {
  const code = cleanCode(codeInput ?? "").slice(0, 12);
  return code ? `/staff?code=${code}` : "/staff";
}
