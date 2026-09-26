import Link from "next/link";
import { listBranchStats } from "@/lib/branches";
import { maskPhone } from "@/lib/phone";
import { isAdmin } from "@/lib/session";
import { formatDateTime, listRecentVouchers } from "@/lib/vouchers";
import { adminLogoutAction } from "./actions";
import { AdminLogin } from "./AdminLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner dashboard" };

const PERIODS = [1, 7, 30, 365];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await isAdmin())) {
    return (
      <main className="page">
        <div className="hero">
          <h1>Owner dashboard</h1>
          <p>Reviews & free drink vouchers</p>
        </div>
        <AdminLogin />
      </main>
    );
  }

  const daysParam = Number((await searchParams).days);
  const days = PERIODS.includes(daysParam) ? daysParam : 30;
  const [branches, recent] = await Promise.all([listBranchStats(days), listRecentVouchers(25)]);
  const total = branches.reduce(
    (t, b) => ({
      scans: t.scans + b.scans,
      clicks: t.clicks + b.review_clicks,
      issued: t.issued + b.vouchers_issued,
      redeemed: t.redeemed + b.vouchers_redeemed,
    }),
    { scans: 0, clicks: 0, issued: 0, redeemed: 0 },
  );

  return (
    <main className="page-wide">
      <div className="topbar">
        <h1>Owner dashboard</h1>
        <div className="links">
          <Link href="/admin/branches/new" className="btn btn-small">+ Add branch</Link>
          <form action={adminLogoutAction}>
            <button className="btn btn-secondary btn-small">Log out</button>
          </form>
        </div>
      </div>

      <div className="links small" style={{ margin: "8px 0 12px" }}>
        Showing last:
        {PERIODS.map((p) => (
          <Link key={p} href={`/admin?days=${p}`} style={{ fontWeight: p === days ? 700 : 400 }}>
            {p === 1 ? "24 hours" : p === 365 ? "year" : `${p} days`}
          </Link>
        ))}
      </div>

      <div className="stats">
        <Stat value={total.scans} label="QR scans" />
        <Stat value={total.clicks} label="Tapped “Review on Google”" />
        <Stat value={total.issued} label="Vouchers claimed" />
        <Stat value={total.redeemed} label="Drinks redeemed" />
      </div>

      <section className="card">
        <h2>Branches</h2>
        {branches.length === 0 ? (
          <p className="muted">No branches yet. <Link href="/admin/branches/new">Add your first branch</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="num">Scans</th>
                  <th className="num">Review taps</th>
                  <th className="num">Claimed</th>
                  <th className="num">Redeemed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>{" "}
                      {!b.active && <span className="badge badge-muted">inactive</span>}
                      {!b.google_review_url && <span className="badge badge-err">no Google link</span>}
                      {!b.staff_pin_hash && <span className="badge badge-err">no staff PIN</span>}
                      <div className="small muted">/r/{b.slug}</div>
                    </td>
                    <td className="num">{b.scans}</td>
                    <td className="num">{b.review_clicks}</td>
                    <td className="num">{b.vouchers_issued}</td>
                    <td className="num">{b.vouchers_redeemed}</td>
                    <td>
                      <div className="links">
                        <Link href={`/admin/branches/${b.id}/qr`}>QR poster</Link>
                        <Link href={`/admin/branches/${b.id}`}>Edit</Link>
                        <Link href={`/r/${b.slug}`} target="_blank">Open</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Latest vouchers</h2>
        {recent.length === 0 ? (
          <p className="muted">No vouchers claimed yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Branch</th>
                  <th>Customer</th>
                  <th>Claimed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.code}</strong></td>
                    <td>{v.branch_name}</td>
                    <td>{v.customer_name} <span className="muted">{maskPhone(v.phone)}</span></td>
                    <td>{formatDateTime(v.created_at)}</td>
                    <td>
                      {v.redeemed_at ? (
                        <span className="badge badge-ok">redeemed {formatDateTime(v.redeemed_at)}</span>
                      ) : v.expires_at <= new Date() ? (
                        <span className="badge badge-muted">expired</span>
                      ) : (
                        <span className="badge badge-muted">waiting</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="small muted">
        Staff redeem vouchers at <Link href="/staff">/staff</Link> using their branch PIN.
      </p>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}
