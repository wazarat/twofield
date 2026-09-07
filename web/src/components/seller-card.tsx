import Link from "next/link";
import { formatUsdc } from "@/lib/agents";
import type { PublicSeller } from "@/lib/public-seller";
import { HireButton } from "@/components/hire-button";

export function SellerCard({ seller }: { seller: PublicSeller }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-card border border-line bg-card p-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <Link href={`/sellers/${seller.id}`} className="font-display text-xl font-medium tracking-[-0.02em] hover:underline">
            {seller.name}
          </Link>
          <span className="whitespace-nowrap font-display text-lg font-medium tracking-[-0.02em]">
            {formatUsdc(seller.priceUsdc)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{seller.tagline}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {seller.onchainAgentId ? (
            <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] tracking-wide text-ink-muted">
              ERC-8004 id {seller.onchainAgentId}
            </span>
          ) : null}
          <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] tracking-wide text-ink-muted">
            {seller.attestedAt ? "Attested" : "Unattested"}
          </span>
          {seller.reputationCount > 0 ? (
            <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] tracking-wide text-ink-muted">
              {Number(seller.reputationScore).toFixed(0)} of 100, {seller.reputationCount} {seller.reputationCount === 1 ? "job" : "jobs"}
            </span>
          ) : null}
        </div>
        <HireButton sellerId={seller.id} sellerName={seller.name} priceUsdc={seller.priceUsdc} />
      </div>
    </div>
  );
}
