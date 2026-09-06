import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import { arcTestnet } from "viem/chains";

export { arcTestnet };

export const ARC_CHAIN_ID = arcTestnet.id;
export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const GAS_BUFFER_USDC = "0.1";
export const MASTER_RESERVE_USDC = "0.02";

const explorer = "https://testnet.arcscan.app";

export const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

// Arc's native gas token is USDC with 18 decimals at the transaction level.
export function toWei(usdc: string | number) {
  return parseUnits(String(usdc), 18);
}

export function fromWei(wei: bigint) {
  return formatUnits(wei, 18);
}

export function explorerAddress(address: string) {
  return `${explorer}/address/${address}`;
}

export function explorerTx(hash: string) {
  return `${explorer}/tx/${hash}`;
}
