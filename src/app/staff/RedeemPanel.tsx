"use client";

import { useActionState, useEffect, useRef } from "react";
import { voucherAction, type RedeemState } from "./actions";

export function RedeemPanel() {
  const [state, action, pending] = useActionState<RedeemState, FormData>(voucherAction, {});
  const codeInput = useRef<HTMLInputElement>(null);

  // After a successful redemption, clear the box ready for the next customer.
  useEffect(() => {
    if (state.success && codeInput.current) {
      codeInput.current.value = "";
      codeInput.current.focus();
    }
  }, [state]);

  const preview = state.preview;

  return (
    <section className="card">
      <h2>Redeem a voucher</h2>
      <form action={action}>
        <input type="hidden" name="intent" value="lookup" />
        <label htmlFor="code">Voucher code</label>
        <input
          ref={codeInput}
          id="code"
          name="code"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="e.g. 7KQ3MX"
          required
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 3, textTransform: "uppercase" }}
        />
        <div className="form-actions">
          <button className="btn" disabled={pending}>{pending ? "Checking…" : "Check code"}</button>
        </div>
      </form>

      {preview && (
        <div className="card" style={{ background: "#fbf8f3" }}>
          <p style={{ margin: 0 }}>
            <strong style={{ fontSize: 22, letterSpacing: 2 }}>{preview.code}</strong>
          </p>
          <p style={{ margin: "4px 0" }}>
            {preview.customerName} · {preview.phone}
            <br />
            <span className="muted small">{preview.reward} · claimed {preview.created}</span>
          </p>
          {preview.problem ? (
            <div className="alert alert-error">{preview.problem}</div>
          ) : (
            <form action={action}>
              <input type="hidden" name="intent" value="redeem" />
              <input type="hidden" name="code" value={preview.code} />
              <div className="form-actions">
                <button className="btn" disabled={pending}>
                  {pending ? "Redeeming…" : `Redeem ${preview.reward.toLowerCase()}`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.success && <div className="alert alert-ok">✅ {state.success}</div>}
    </section>
  );
}
