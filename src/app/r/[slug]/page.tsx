import { notFound } from "next/navigation";
import { getBranchBySlug, recordEvent } from "@/lib/branches";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";

export default async function BranchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const branch = await getBranchBySlug(slug);
  if (!branch || !branch.active) notFound();

  await recordEvent(branch.id, "scan").catch(() => {});

  return (
    <main className="page">
      <div className="hero">
        <div className="logo">{branch.name.charAt(0)}</div>
        <h1>{branch.name}</h1>
        <p>Thank you for dining with us!</p>
      </div>

      <section className="card">
        <h2>🥤 {branch.reward_text} on us</h2>
        <p className="muted">
          Enter your name and phone number to get your voucher, then show it at the counter.
          No review needed.
        </p>
        <ClaimForm slug={branch.slug} />
      </section>

      <p className="center small muted" style={{ marginTop: 24 }}>
        One reward per phone number every {branch.cooldown_days} days. Voucher valid for{" "}
        {branch.voucher_valid_hours} hours. We only use your number to prevent duplicate claims.
      </p>
    </main>
  );
}
