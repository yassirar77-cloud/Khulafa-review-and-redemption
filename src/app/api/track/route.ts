import { getBranchBySlug, recordEvent } from "@/lib/branches";

export async function POST(request: Request) {
  try {
    const { slug, type } = await request.json();
    if (type === "review_click" && typeof slug === "string") {
      const branch = await getBranchBySlug(slug);
      if (branch?.active) await recordEvent(branch.id, "review_click");
    }
  } catch {
    // Tracking is best-effort; never fail the customer's tap.
  }
  return new Response(null, { status: 204 });
}
