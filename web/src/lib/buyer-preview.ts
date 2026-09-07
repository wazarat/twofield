import { createViemAccount } from "@privy-io/node/viem";
import { x402Client } from "@x402/core/client";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { Agent } from "@/db/schema";
import { USDC, toUsdc6 } from "@/lib/arc";
import { AppError } from "@/lib/errors";
import { ensureBuyerPolicy } from "@/lib/policies";
import { authorizationContext, privy } from "@/lib/privy";
import { ARC_NETWORK, PREVIEW_PRICE_USDC } from "@/lib/x402";

export class PreviewError extends AppError {}

export type PreviewResult = {
  pitch: string;
  seller: { id: string; name: string };
  payment: { transaction: string; payer?: string; amount?: string; network?: string };
};

// The buyer agent pays for a seller's preview over plain HTTP with x402. Its Privy wallet
// signs the USDC authorization, the platform settles it, and the pitch comes back.
export async function buyPreview(buyer: Agent, seller: Agent, brief: string, base: string): Promise<PreviewResult> {
  if (!buyer.walletId || !buyer.walletAddress) throw new PreviewError("The buyer agent has no wallet", 409);
  await ensureBuyerPolicy(buyer);

  // Same wiring as Privy's createX402Client, without its Solana import.
  const account = createViemAccount(privy(), {
    walletId: buyer.walletId,
    address: buyer.walletAddress as `0x${string}`,
    authorizationContext: authorizationContext(),
  });
  // USDC on Arc is not in the client's default asset list, so allow it explicitly and
  // cap each payment at the preview price as a second guard beside the wallet policy.
  const client = registerExactEvmScheme(
    new x402Client().setSpendControls({
      allowedAssets: [{ network: ARC_NETWORK, asset: USDC, maxAmountPerPayment: toUsdc6(PREVIEW_PRICE_USDC).toString() }],
    }),
    { signer: toClientEvmSigner(account as unknown as Parameters<typeof toClientEvmSigner>[0]) },
  );
  const paidFetch = wrapFetchWithPayment(fetch, client);
  const url = `${base}/api/sellers/${seller.id}/preview?brief=${encodeURIComponent(brief)}`;

  const response = await paidFetch(url, { headers: { accept: "application/json" } });
  const data = (await response.json().catch(() => ({}))) as Partial<PreviewResult> & { error?: string };
  if (!response.ok) throw new PreviewError(data.error ?? `Preview failed with ${response.status}`, response.status === 402 ? 402 : 502);

  const header = response.headers.get("payment-response");
  const settled = header ? decodePaymentResponseHeader(header) : undefined;
  return {
    pitch: data.pitch ?? "",
    seller: data.seller ?? { id: seller.id, name: seller.name },
    payment: { transaction: settled?.transaction ?? data.payment?.transaction ?? "", payer: settled?.payer, amount: settled?.amount, network: settled?.network },
  };
}
