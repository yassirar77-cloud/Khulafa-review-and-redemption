"use client";

import { useActionState } from "react";
import { staffLoginAction, type LoginState } from "./actions";

export function StaffLogin({ branches }: { branches: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(staffLoginAction, {});

  return (
    <form action={action} className="card">
      <label htmlFor="branchId">Branch</label>
      <select id="branchId" name="branchId" required defaultValue={branches.length === 1 ? branches[0].id : ""}>
        <option value="" disabled>Choose branch…</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <label htmlFor="pin">Staff PIN</label>
      <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" required />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-actions">
        <button className="btn" disabled={pending}>{pending ? "Checking…" : "Log in"}</button>
      </div>
    </form>
  );
}
