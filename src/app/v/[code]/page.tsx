import { Logo } from "@/components/Logo";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ReviewButton } from "@/components/ReviewButton";
import { staffPath } from "@/lib/staff";
import { publicBaseUrl } from "@/lib/url";
import { formatDateTime, getVoucher } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

export default async function VoucherPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const voucher = await getVoucher(code);
  if (!voucher) notFound();

  const expired = !voucher.redeemed_at && voucher.expires_at <= new Date();
  const used = Boolean(voucher.redeemed_at) || expired;

  // The cashier scans this to open the voucher on the staff screen. Opening the
  // link only checks the code; staff still log in and tap Redeem.
  const staffUrl = `${await publicBaseUrl()}${staffPath(voucher.code)}`;
  const qrSvg = used
    ? null
    : await QRCode.toString(staffUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        color: { dark: "#2b211c", light: "#ffffff" },
      });

  return (
    <main className="page">
      <div className="hero">
        <Logo />
        <h1>{voucher.branch_name}</h1>
        <p>Hi {voucher.customer_name}, here is your voucher</p>
      </div>

      <div className={`voucher${used ? " used" : ""}`}>
        <p className="reward">🥤 {voucher.reward_text}</p>
        {voucher.branch_reward_note && <p className="reward-note">{voucher.branch_reward_note}, your choice</p>}
        <div className="code">{voucher.code}</div>
        {qrSvg && (
          <div
            className="voucher-qr"
            data-staff-url={staffUrl}
            role="img"
            aria-label={`QR code for voucher ${voucher.code}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        {voucher.redeemed_at ? (
          <p>Redeemed on {formatDateTime(voucher.redeemed_at)}. Enjoy!</p>
        ) : expired ? (
          <p>This voucher expired on {formatDateTime(voucher.expires_at)}.</p>
        ) : (
          <p>
            Show this screen at the counter so staff can scan the QR code.
            <br />
            Valid until {formatDateTime(voucher.expires_at)}.
          </p>
        )}
        {!expired && voucher.branch_review_url && (
          <div className="voucher-review">
            <p>While you wait, tell us how we did on Google</p>
            <ReviewButton slug={voucher.branch_slug} url={voucher.branch_review_url} />
            <p className="small">Optional. Your {voucher.reward_text.toLowerCase()} is yours either way.</p>
          </div>
        )}
      </div>

      <p className="center small muted" style={{ marginTop: 16 }}>
        Tip: take a screenshot so you have it handy. Valid at {voucher.branch_name} only.
      </p>
    </main>
  );
}
