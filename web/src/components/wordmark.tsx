import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";

const hasLogo = existsSync(join(process.cwd(), "public", "logo.png"));

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center ${className}`} aria-label="twofield home">
      {hasLogo ? (
        <Image src="/logo.png" alt="twofield" width={112} height={40} priority className="h-8 w-auto" />
      ) : (
        <span className="font-wordmark text-2xl leading-none tracking-tight lowercase">twofield</span>
      )}
    </Link>
  );
}
