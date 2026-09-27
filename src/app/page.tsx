import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <div className="hero">
        <Logo />
        <h1>Khulafa Bistro</h1>
        <p>Scan the QR code at your table to claim your free drink.</p>
      </div>
      <p className="center small muted" style={{ marginTop: 32 }}>
        <Link href="/staff">Staff</Link> · <Link href="/admin">Owner</Link>
      </p>
    </main>
  );
}
