"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBranchAction, type FormState } from "./actions";

export type BranchFormValues = {
  id?: number;
  name: string;
  slug: string;
  google_review_url: string;
  reward_text: string;
  voucher_valid_hours: number;
  cooldown_days: number;
  active: boolean;
  hasPin: boolean;
};

export function BranchForm({ branch }: { branch: BranchFormValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBranchAction, {});

  return (
    <form action={action} className="card">
      {branch.id && <input type="hidden" name="id" value={branch.id} />}

      <label htmlFor="name">Branch name</label>
      <input id="name" name="name" defaultValue={branch.name} placeholder="Khulafa Bistro Shah Alam" required />

      <label htmlFor="slug">Link name</label>
      <input id="slug" name="slug" defaultValue={branch.slug} placeholder="khulafa-bistro-shah-alam" />
      <p className="hint">
        Used in the QR link: /r/<em>link-name</em>. Leave empty to build it from the name. Changing it
        breaks QR codes you already printed.
      </p>

      <label htmlFor="google">Google review link or Place ID</label>
      <input id="google" name="google" defaultValue={branch.google_review_url} placeholder="ChIJ… or https://g.page/r/…/review" />
      <p className="hint">
        Find your Place ID with{" "}
        <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer">
          Google&apos;s Place ID finder
        </a>
        , or copy the &quot;Ask for reviews&quot; link from your Google Business Profile.
      </p>

      <label htmlFor="reward_text">Reward</label>
      <input id="reward_text" name="reward_text" defaultValue={branch.reward_text} placeholder="Free drink" />

      <label htmlFor="voucher_valid_hours">Voucher valid for (hours)</label>
      <input id="voucher_valid_hours" name="voucher_valid_hours" type="number" min={1} defaultValue={branch.voucher_valid_hours} required />

      <label htmlFor="cooldown_days">Days before the same phone number can claim again</label>
      <input id="cooldown_days" name="cooldown_days" type="number" min={0} defaultValue={branch.cooldown_days} required />

      <label htmlFor="pin">Staff PIN {branch.hasPin && "(leave empty to keep current PIN)"}</label>
      <input id="pin" name="pin" inputMode="numeric" autoComplete="off" pattern="\d{4,8}" placeholder="4–8 digits" required={!branch.hasPin} />

      <label className="checkbox">
        <input type="checkbox" name="active" defaultChecked={branch.active} /> Active (customers can claim)
      </label>

      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions">
        <Link href="/admin" className="btn btn-secondary">Cancel</Link>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save branch"}</button>
      </div>
    </form>
  );
}
