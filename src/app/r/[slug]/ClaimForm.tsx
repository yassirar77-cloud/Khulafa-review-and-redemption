"use client";

import { useActionState } from "react";
import { claimAction, type ClaimState } from "./actions";

export function ClaimForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" autoComplete="given-name" required maxLength={60} />
      <label htmlFor="phone">Phone number</label>
      <input
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="012-345 6789"
        required
      />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Getting your voucher…" : "Get my free drink"}
        </button>
      </div>
    </form>
  );
}
