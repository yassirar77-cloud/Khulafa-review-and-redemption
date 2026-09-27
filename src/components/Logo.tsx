import Image from "next/image";
import logo from "../../public/logo.png";

/** Khulafa logo mark, used in page headers and on the printed QR poster. */
export function Logo({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={logo}
      alt="Khulafa"
      width={Math.round((size * logo.width) / logo.height)}
      height={size}
      priority
      className={`logo-img ${className}`.trim()}
    />
  );
}
