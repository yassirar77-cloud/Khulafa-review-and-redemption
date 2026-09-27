import { getBranchById, listActiveBranches } from "@/lib/branches";
import { staffBranchId } from "@/lib/session";
import { previewVoucher } from "@/lib/staff";
import { cleanCode, formatDateTime, listRecentVouchers } from "@/lib/vouchers";
import { staffLogoutAction } from "./actions";
import { RedeemPanel } from "./RedeemPanel";
import { StaffLogin } from "./StaffLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff · Redeem vouchers" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  // A scanned voucher QR opens /staff?code=123456. We only ever *check* the code
  // here; redeeming still needs a logged-in cashier to tap Redeem.
  const rawCode = (await searchParams).code;
  const code = cleanCode(typeof rawCode === "string" ? rawCode : "").slice(0, 12);
  const branchId = await staffBranchId();
  const branch = branchId ? await getBranchById(branchId) : null;

  if (!branch || !branch.active) {
    const branches = await listActiveBranches();
    return (
      <main className="page">
        <div className="hero">
          <h1>Staff login</h1>
          <p>{code ? `Log in to check voucher ${code}` : "Redeem customer vouchers"}</p>
        </div>
        <StaffLogin branches={branches} code={code} />
      </main>
    );
  }

  const [initial, recentAll] = await Promise.all([
    code ? previewVoucher(branch.id, code) : Promise.resolve({}),
    listRecentVouchers(50, branch.id),
  ]);
  const recent = recentAll.filter((v) => v.redeemed_at);

  return (
    <main className="page">
      <div className="topbar">
        <h1>{branch.name}</h1>
        <form action={staffLogoutAction}>
          <button className="btn btn-secondary btn-small">Log out</button>
        </form>
      </div>
      <RedeemPanel key={code} initial={initial} />

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
