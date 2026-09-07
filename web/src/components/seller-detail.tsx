"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/agents";
import { IDENTITY_REGISTRY, explorerAddress, explorerTx } from "@/lib/arc";
import { getCategory } from "@/lib/categories";
import type { PublicSeller } from "@/lib/public-seller";
import { nichePackSections } from "@/lib/sellers";
import { HireButton } from "@/components/hire-button";

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function SellerDetail({ id }: { id: string }) {
  const [seller, setSeller] = useState<PublicSeller | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/sellers/${id}`)
      .then(async (r) => {
        const data = (await r.json()) as { seller?: PublicSeller; error?: string };
        if (!r.ok || !data.seller) throw new Error(data.error ?? "Seller not found");
        return data.seller;
      })
      .then((s) => {
        if (active) setSeller(s);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load seller");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-panel border border-line bg-card p-8">
        <p className="text-sm">{error}</p>
        <Link href="/categories" className="mt-4 inline-block text-sm font-medium underline">
          Back to categories
        </Link>
      </div>
    );
  }
  if (!seller) return <div className="h-64 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;

  const category = seller.categorySlug ? getCategory(seller.categorySlug) : undefined;

  return (
    <>
      {category ? (
        <Link href={`/categories/${category.slug}`} className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted hover:text-ink">
          {category.name}
        </Link>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">{seller.name}</h1>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {seller.attestedAt ? "Attested" : "Unattested"}
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">{seller.tagline}</p>

      <div className="mt-12 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">What you get</p>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            A niche pack written in this specialist&apos;s voice, from the brief your agent files.
          </p>
          <ol className="mt-6 divide-y divide-line">
            {nichePackSections.map((section, i) => (
              <li key={section} className="flex items-center gap-4 py-3">
                <span className="font-mono text-sm text-ink-faint">0{i + 1}</span>
                <span className="font-display text-lg font-medium tracking-[-0.02em]">{section}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-panel border border-line bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Price per job</p>
            <p className="mt-4 font-display text-3xl font-medium tracking-[-0.03em]">{formatUsdc(seller.priceUsdc)}</p>
            <div className="mt-6">
              <HireButton sellerId={seller.id} sellerName={seller.name} priceUsdc={seller.priceUsdc} size="lg" />
            </div>
          </div>
          <div className="rounded-panel border border-line bg-card p-8 font-mono text-xs text-ink-muted">
            <p className="uppercase tracking-[0.2em]">Onchain</p>
            <dl className="mt-4 flex flex-col gap-2">
              {seller.onchainAgentId ? (
                <div className="flex justify-between gap-4">
                  <dt>ERC-8004 id</dt>
                  <dd>
                    <a href={`${explorerAddress(IDENTITY_REGISTRY)}?tab=read_contract`} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                      {seller.onchainAgentId}
                    </a>
                  </dd>
                </div>
              ) : null}
              {seller.walletAddress ? (
                <div className="flex justify-between gap-4">
                  <dt>Wallet</dt>
                  <dd>
                    <a href={explorerAddress(seller.walletAddress)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                      {shorten(seller.walletAddress)}
                    </a>
                  </dd>
                </div>
              ) : null}
              {seller.registrationTx ? (
                <div className="flex justify-between gap-4">
                  <dt>Registration</dt>
                  <dd>
                    <a href={explorerTx(seller.registrationTx)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                      transaction
                    </a>
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt>Reputation</dt>
                <dd>{seller.reputationCount > 0 ? `${seller.reputationScore} from ${seller.reputationCount}` : "none yet"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
