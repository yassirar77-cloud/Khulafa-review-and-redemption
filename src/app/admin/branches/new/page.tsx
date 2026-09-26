import { requireAdmin } from "@/lib/session";
import { BranchForm } from "../../BranchForm";

export const dynamic = "force-dynamic";

export default async function NewBranchPage() {
  await requireAdmin();
  return (
    <main className="page">
      <h1>Add branch</h1>
      <BranchForm
        branch={{
          name: "",
          slug: "",
          google_review_url: "",
          reward_text: "Free drink",
          voucher_valid_hours: 24,
          cooldown_days: 30,
          active: true,
          hasPin: false,
        }}
      />
    </main>
  );
}
