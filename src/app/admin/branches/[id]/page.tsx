import { notFound } from "next/navigation";
import { getBranchById } from "@/lib/branches";
import { requireAdmin } from "@/lib/session";
import { BranchForm } from "../../BranchForm";

export const dynamic = "force-dynamic";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const branch = await getBranchById(Number((await params).id));
  if (!branch) notFound();

  return (
    <main className="page">
      <h1>Edit {branch.name}</h1>
      <BranchForm
        branch={{
          id: branch.id,
          name: branch.name,
          slug: branch.slug,
          google_review_url: branch.google_review_url,
          reward_text: branch.reward_text,
          reward_note: branch.reward_note,
          voucher_valid_hours: branch.voucher_valid_hours,
          cooldown_days: branch.cooldown_days,
          active: branch.active,
          hasPin: Boolean(branch.staff_pin_hash),
        }}
      />
    </main>
  );
}
