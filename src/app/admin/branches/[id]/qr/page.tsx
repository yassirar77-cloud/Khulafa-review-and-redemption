import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/Logo";
import { getBranchById } from "@/lib/branches";
import { requireAdmin } from "@/lib/session";
import { publicBaseUrl } from "@/lib/url";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function QrPosterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const branch = await getBranchById(Number((await params).id));
  if (!branch) notFound();

  const url = `${await publicBaseUrl()}/r/${branch.slug}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#2b211c", light: "#ffffff" },
  });

  return (
    <main className="page-wide">
      <div className="topbar no-print">
        <Link href="/admin">← Dashboard</Link>
        <PrintButton />
      </div>

      <div className="poster">
        <Logo size={96} className="poster-logo" />
        <h1>{branch.name}</h1>
        <div className="headline">🥤 {branch.reward_text} on us!</div>
        <p className="muted" style={{ margin: 0 }}>Scan to claim, and tell us how we did on Google</p>
        <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <ol className="steps">
          <li>Scan the QR code with your phone camera</li>
          <li>Get your free drink voucher</li>
          <li>Show it at the counter</li>
        </ol>
      </div>

      <p className="center small muted no-print">
        QR link: <a href={url}>{url}</a>
        {!process.env.PUBLIC_BASE_URL && (
          <>
            <br />
            Set PUBLIC_BASE_URL on the server so printed codes always point to your real domain.
          </>
        )}
      </p>
    </main>
  );
}
