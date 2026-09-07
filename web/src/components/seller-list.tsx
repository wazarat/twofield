"use client";

import { useEffect, useState } from "react";
import type { PublicSeller } from "@/lib/public-seller";
import { SellerCard } from "@/components/seller-card";

export function SellerList({ category, fallback }: { category: string; fallback: React.ReactNode }) {
  const [sellers, setSellers] = useState<PublicSeller[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/sellers?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((data: { sellers?: PublicSeller[] }) => {
        if (active) setSellers(data.sellers ?? []);
      })
      .catch(() => {
        if (active) setSellers([]);
      });
    return () => {
      active = false;
    };
  }, [category]);

  if (sellers === null) {
    return <div className="h-48 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;
  }
  if (sellers.length === 0) return <>{fallback}</>;

  return (
    <div>
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
        {sellers.length} specialists, priced per job
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sellers.map((seller) => (
          <SellerCard key={seller.id} seller={seller} />
        ))}
      </div>
    </div>
  );
}
