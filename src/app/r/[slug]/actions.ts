"use server";

import { redirect } from "next/navigation";
import { claimVoucher } from "@/lib/vouchers";

export type ClaimState = { error?: string };

export async function claimAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const slug = String(formData.get("slug") ?? "");
  const result = await claimVoucher(
    slug,
    String(formData.get("name") ?? ""),
    String(formData.get("phone") ?? ""),
  );
  if (!result.ok) return { error: result.error };
  redirect(`/v/${result.code}`);
}
