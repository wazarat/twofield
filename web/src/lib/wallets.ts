import { createViemAccount } from "@privy-io/node/viem";
import { eq } from "drizzle-orm";
import { createWalletClient, http } from "viem";
import { db } from "@/db";
import { agents, type Agent } from "@/db/schema";
import {
  ARC_CHAIN_ID,
  GAS_BUFFER_USDC,
  IDENTITY_REGISTRY,
  MASTER_RESERVE_USDC,
  arcTestnet,
  fromWei,
  publicClient,
  toWei,
} from "@/lib/arc";
import { AppError } from "@/lib/errors";
import {
  AGENTIC_COMMERCE,
  REPUTATION_REGISTRY,
  SELLER_GAS_USDC,
  VALIDATION_REGISTRY,
} from "@/lib/arc";
import { walletClientFor } from "@/lib/escrow";
import { ensureBuyerPolicy } from "@/lib/policies";
import { authorizationContext, masterWallet, ownerPublicKey, privy } from "@/lib/privy";

export class WalletError extends AppError {}

async function save(id: string, patch: Partial<Agent>) {
  const [row] = await db().update(agents).set(patch).where(eq(agents.id, id)).returning();
  return row;
}

export type WalletOptions = {
  // Native USDC moved from the master wallet on creation.
  fundingUsdc: string;
  // Contracts the wallet may call.
  allowlist: string[];
  // Max native value per transaction.
  capUsdc: string;
};

export function walletOptionsFor(agent: Agent): WalletOptions {
  if (agent.kind === "seller") {
    return {
      fundingUsdc: SELLER_GAS_USDC,
      allowlist: [IDENTITY_REGISTRY, AGENTIC_COMMERCE, REPUTATION_REGISTRY, VALIDATION_REGISTRY],
      capUsdc: "0",
    };
  }
  return {
    fundingUsdc: (Number(agent.maxTotalBudget) + Number(GAS_BUFFER_USDC)).toFixed(6),
    allowlist: [IDENTITY_REGISTRY],
    capUsdc: agent.maxBudgetPerJob,
  };
}

async function ensurePolicy(agent: Agent, options: WalletOptions) {
  if (agent.policyId) return agent.policyId;
  const cap = toWei(options.capUsdc).toString();
  const source = "ethereum_transaction" as const;
  const conditions = [
    { field_source: source, field: "chain_id" as const, operator: "eq" as const, value: String(ARC_CHAIN_ID) },
    { field_source: source, field: "to" as const, operator: "in" as const, value: options.allowlist },
    { field_source: source, field: "value" as const, operator: "lte" as const, value: cap },
  ];
  const policy = await privy().policies().create({
    version: "1.0",
    chain_type: "ethereum",
    name: `twofield ${agent.kind} ${agent.id.slice(0, 8)}`,
    owner: { public_key: ownerPublicKey() },
    rules: [
      { name: "Sign within budget on Arc", method: "eth_signTransaction", action: "ALLOW", conditions },
      { name: "Send within budget on Arc", method: "eth_sendTransaction", action: "ALLOW", conditions },
    ],
  });
  await save(agent.id, { policyId: policy.id });
  return policy.id;
}

async function ensureWallet(agent: Agent, policyId: string) {
  if (agent.walletId && agent.walletAddress) return { id: agent.walletId, address: agent.walletAddress as `0x${string}` };
  const wallet = await privy().wallets().create({
    chain_type: "ethereum",
    display_name: `twofield ${agent.kind} ${agent.id.slice(0, 8)}`,
    owner: { public_key: ownerPublicKey() },
    policy_ids: [policyId],
  });
  await save(agent.id, { walletId: wallet.id, walletAddress: wallet.address });
  return { id: wallet.id, address: wallet.address as `0x${string}` };
}

async function fund(agent: Agent, to: `0x${string}`, options: WalletOptions) {
  return transferFromMaster(to, options.fundingUsdc);
}

// Moves USDC from the master wallet, keeping its reserve.
async function transferFromMaster(to: `0x${string}`, amountUsdc: string) {
  const master = masterWallet();
  const amount = toWei(amountUsdc);
  const needed = amount + toWei(MASTER_RESERVE_USDC);
  const balance = await publicClient.getBalance({ address: master.address });
  if (balance < needed) {
    throw new WalletError("The platform wallet does not hold enough USDC to fund this agent", 400, {
      masterAddress: master.address,
      masterBalance: fromWei(balance),
      needed: fromWei(needed),
      faucet: "https://faucet.circle.com",
    });
  }

  const account = createViemAccount(privy(), {
    walletId: master.id,
    address: master.address,
    authorizationContext: authorizationContext(),
  });
  const client = createWalletClient({ account, chain: arcTestnet, transport: http() });
  const hash = await client.sendTransaction({ to, value: amount });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// Creates the policy, the wallet, and the opening transfer. Each step is saved as it
// completes so a retry after a failure resumes instead of creating duplicates.
export async function createAgentWallet(agent: Agent, options: WalletOptions = walletOptionsFor(agent)) {
  if (agent.status !== "draft") throw new WalletError("This agent already has a wallet", 409);
  if (agent.archivedAt) throw new WalletError("This agent is archived", 409);
  const policyId = await ensurePolicy(agent, options);
  const wallet = await ensureWallet(agent, policyId);
  const hash = await fund(agent, wallet.address, options);
  return save(agent.id, { fundingTx: hash, status: "wallet_ready" });
}

export async function agentBalance(address: string) {
  const wei = await publicClient.getBalance({ address: address as `0x${string}` });
  return fromWei(wei);
}

// Adds to an existing wallet when the max total budget is raised.
export async function topUp(agent: Agent, amountUsdc: string) {
  if (!agent.walletAddress) throw new WalletError("This agent has no wallet", 409);
  const hash = await transferFromMaster(agent.walletAddress as `0x${string}`, amountUsdc);
  return save(agent.id, { topUpTx: hash });
}

// Sends everything but the transfer fee back to the master wallet. Returns the hash, or
// null when the balance does not cover a transfer. The wallet policy must be v5 or later.
export async function sweepToMaster(agent: Agent) {
  if (!agent.walletId || !agent.walletAddress) return null;
  const current = await ensureBuyerPolicy(agent);
  const address = current.walletAddress as `0x${string}`;
  const balance = await publicClient.getBalance({ address });
  const fees = await publicClient.estimateFeesPerGas();
  const gas = BigInt(21000);
  const fee = (gas * fees.maxFeePerGas * BigInt(120)) / BigInt(100);
  if (balance <= fee) return null;

  const hash = await walletClientFor({ id: current.walletId!, address }).sendTransaction({
    to: masterWallet().address,
    value: balance - fee,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new WalletError("The return transfer reverted", 502, { tx: hash });
  await save(agent.id, { sweepTx: hash });
  return hash;
}
