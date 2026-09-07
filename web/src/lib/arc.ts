import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import { arcTestnet } from "viem/chains";

export { arcTestnet };

export const ARC_CHAIN_ID = arcTestnet.id;
export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;
export const VALIDATION_REGISTRY = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" as const;
export const AGENTIC_COMMERCE = "0x0747EEf0706327138c69792bF28Cd525089e4583" as const;
export const USDC = "0x3600000000000000000000000000000000000000" as const;
export const GAS_BUFFER_USDC = "0.1";
export const SELLER_GAS_USDC = "0.05";
export const EVALUATOR_GAS_USDC = "0.2";
export const JOB_GAS_RESERVE_USDC = "0.02";

// USDC on the ERC-20 interface uses 6 decimals.
export function toUsdc6(usdc: string | number) {
  return parseUnits(String(usdc), 6);
}

export function fromUsdc6(units: bigint) {
  return formatUnits(units, 6);
}
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
