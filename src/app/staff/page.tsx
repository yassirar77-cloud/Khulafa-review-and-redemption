import { getBranchById, listActiveBranches } from "@/lib/branches";
import { staffBranchId } from "@/lib/session";
import { formatDateTime, listRecentVouchers } from "@/lib/vouchers";
import { staffLogoutAction } from "./actions";
import { RedeemPanel } from "./RedeemPanel";
import { StaffLogin } from "./StaffLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff · Redeem vouchers" };

export default async function StaffPage() {
  const branchId = await staffBranchId();
  const branch = branchId ? await getBranchById(branchId) : null;

  if (!branch || !branch.active) {
    const branches = await listActiveBranches();
    return (
      <main className="page">
        <div className="hero">
          <h1>Staff login</h1>
          <p>Redeem customer vouchers</p>
        </div>
        <StaffLogin branches={branches} />
      </main>
    );
  }

  const recent = (await listRecentVouchers(50, branch.id)).filter((v) => v.redeemed_at);

  return (
    <main className="page">
      <div className="topbar">
        <h1>{branch.name}</h1>
        <form action={staffLogoutAction}>
          <button className="btn btn-secondary btn-small">Log out</button>
        </form>
      </div>
      <RedeemPanel />

      <section className="card">
        <h2>Recently redeemed</h2>
        {recent.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {recent.slice(0, 15).map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.code}</strong></td>
                    <td>{v.customer_name}</td>
                    <td className="num muted">{formatDateTime(v.redeemed_at!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
