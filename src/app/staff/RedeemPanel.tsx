"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { voucherAction, type RedeemState } from "./actions";
import { QrScanner } from "./QrScanner";

/** `initial` is the already-checked voucher when the page was opened from a scanned QR. */
export function RedeemPanel({ initial = {} }: { initial?: RedeemState }) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(voucherAction, initial);
  // Controlled so the code stays visible after "Check code" (React resets
  // uncontrolled fields once a form action finishes).
  const [code, setCode] = useState(initial.code ?? "");
  const codeInput = useRef<HTMLInputElement>(null);
  const lookupForm = useRef<HTMLFormElement>(null);

  // A scanned code runs "Check code" straight away; Redeem is still a separate tap.
  function onScanned(scanned: string) {
    flushSync(() => setCode(scanned));
    lookupForm.current?.requestSubmit();
  }

  // After a successful redemption, clear the box ready for the next customer
  // and drop ?code= so a refresh doesn't reopen the voucher just used.
  useEffect(() => {
    if (state.success && codeInput.current) {
      setCode("");
      codeInput.current.focus();
      if (window.location.search) window.history.replaceState(null, "", "/staff");
    }
  }, [state]);

  const preview = state.preview;

  return (
    <section className="card">
      <h2>Redeem a voucher</h2>
      <QrScanner onCode={onScanned} disabled={pending} />
      <p className="or-divider">or type the code</p>
      <form ref={lookupForm} action={action}>
        <input type="hidden" name="intent" value="lookup" />
        <label htmlFor="code">Voucher code</label>
        <input
          ref={codeInput}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 482913"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 3 }}
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
            {preview.rewardNote && (
              <>
                <br />
                <strong>Give: {preview.rewardNote}</strong>
              </>
            )}
          </p>
          {preview.problem ? (
            <div className="alert alert-error">{preview.problem}</div>
          ) : (
            <form action={action}>
              <input type="hidden" name="intent" value="redeem" />
              <input type="hidden" name="code" value={preview.code} />
              <input type="hidden" name="reward_note" value={preview.rewardNote} />
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
