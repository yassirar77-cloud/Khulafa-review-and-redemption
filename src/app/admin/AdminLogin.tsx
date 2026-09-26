"use client";

import { useActionState } from "react";
import { adminLoginAction, type FormState } from "./actions";

export function AdminLogin() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminLoginAction, {});
  return (
    <form action={action} className="card">
      <label htmlFor="password">Owner password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions">
        <button className="btn" disabled={pending}>{pending ? "Checking…" : "Log in"}</button>
      </div>
    </form>
  );
}
