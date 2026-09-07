import { x402Facilitator } from "@x402/core/facilitator";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { createViemAccount } from "@privy-io/node/viem";
import { createWalletClient, http, publicActions } from "viem";
import type { Agent } from "@/db/schema";
import { ARC_CHAIN_ID, USDC, arcTestnet, toUsdc6 } from "@/lib/arc";
import { authorizationContext, masterWallet, privy } from "@/lib/privy";

export const ARC_NETWORK = `eip155:${ARC_CHAIN_ID}` as const;
export const PREVIEW_PRICE_USDC = "0.01";

// The public facilitators do not list Arc, so the platform settles x402 payments itself.
// The master wallet relays each signed USDC authorization and pays the gas.
let cached: x402Facilitator | undefined;

export function facilitator() {
  if (cached) return cached;
  const master = masterWallet();
  const account = createViemAccount(privy(), { walletId: master.id, address: master.address, authorizationContext: authorizationContext() });
  const client = createWalletClient({ account, chain: arcTestnet, transport: http() }).extend(publicActions);
  const signer = toFacilitatorEvmSigner({
    address: master.address,
    readContract: (args) => client.readContract(args as Parameters<typeof client.readContract>[0]),
    verifyTypedData: (args) => client.verifyTypedData(args as Parameters<typeof client.verifyTypedData>[0]),
    writeContract: (args) => client.writeContract({ ...(args as Parameters<typeof client.writeContract>[0]), account, chain: arcTestnet }),
    sendTransaction: (args) => client.sendTransaction({ ...args, account, chain: arcTestnet }),
    waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args),
    getCode: (args) => client.getCode(args),
  });
  cached = new x402Facilitator();
  registerExactEvmScheme(cached, { signer, networks: ARC_NETWORK });
  return cached;
}

// What a seller charges for one preview call, paid straight to its wallet.
export function previewRequirements(seller: Agent): PaymentRequirements {
  if (!seller.walletAddress) throw new Error("Seller has no wallet");
  return {
    scheme: "exact",
    network: ARC_NETWORK,
    asset: USDC,
    amount: toUsdc6(PREVIEW_PRICE_USDC).toString(),
    payTo: seller.walletAddress,
    maxTimeoutSeconds: 300,
    extra: { name: "USDC", version: "2" },
  };
}

export function paymentRequired(url: string, seller: Agent): { body: PaymentRequired; header: string } {
  const body: PaymentRequired = {
    x402Version: 2,
    resource: { url, description: `${seller.name} preview pitch, ${PREVIEW_PRICE_USDC} USDC`, mimeType: "application/json", serviceName: "twofield" },
    accepts: [previewRequirements(seller)],
  };
  return { body, header: encodePaymentRequiredHeader(body) };
}

function sameRequirements(a: PaymentRequirements, b: PaymentRequirements) {
  return (
    a.scheme === b.scheme &&
    a.network === b.network &&
    a.asset.toLowerCase() === b.asset.toLowerCase() &&
    a.amount === b.amount &&
    a.payTo.toLowerCase() === b.payTo.toLowerCase()
  );
}

export type Settlement = { transaction: string; payer?: string; amount?: string; header: string };

// Verifies the signed payment in the header against what this seller charges, then settles it.
export async function verifyAndSettle(header: string, seller: Agent): Promise<Settlement> {
  let payload: PaymentPayload;
  try {
    payload = decodePaymentSignatureHeader(header);
  } catch {
    throw new PaymentError("The payment header could not be decoded", 402);
  }
  const requirements = previewRequirements(seller);
  if (!sameRequirements(payload.accepted, requirements)) throw new PaymentError("The payment does not match this preview's price", 402);

  const verified = await facilitator().verify(payload, requirements);
  if (!verified.isValid) throw new PaymentError(verified.invalidMessage ?? verified.invalidReason ?? "Payment could not be verified", 402);

  const settled = await facilitator().settle(payload, requirements);
  if (!settled.success) throw new PaymentError(settled.errorMessage ?? settled.errorReason ?? "Payment could not be settled", 402);

  return { transaction: settled.transaction, payer: settled.payer, amount: settled.amount, header: encodePaymentResponseHeader(settled) };
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
