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
import { authorizationContext, masterWallet, ownerPublicKey, privy } from "@/lib/privy";

export class WalletError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
}

async function save(id: string, patch: Partial<Agent>) {
  const [row] = await db().update(agents).set(patch).where(eq(agents.id, id)).returning();
  return row;
}

async function ensurePolicy(agent: Agent) {
  if (agent.policyId) return agent.policyId;
  const cap = toWei(agent.maxBudgetPerJob).toString();
  const source = "ethereum_transaction" as const;
  const conditions = [
    { field_source: source, field: "chain_id" as const, operator: "eq" as const, value: String(ARC_CHAIN_ID) },
    { field_source: source, field: "to" as const, operator: "in" as const, value: [IDENTITY_REGISTRY as string] },
    { field_source: source, field: "value" as const, operator: "lte" as const, value: cap },
  ];
  const policy = await privy().policies().create({
    version: "1.0",
    chain_type: "ethereum",
    name: `twofield agent ${agent.id.slice(0, 8)}`,
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
    display_name: `twofield agent ${agent.id.slice(0, 8)}`,
    owner: { public_key: ownerPublicKey() },
    policy_ids: [policyId],
  });
  await save(agent.id, { walletId: wallet.id, walletAddress: wallet.address });
  return { id: wallet.id, address: wallet.address as `0x${string}` };
}

async function fund(agent: Agent, to: `0x${string}`) {
  const master = masterWallet();
  const amount = toWei(agent.maxTotalBudget) + toWei(GAS_BUFFER_USDC);
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
export async function createAgentWallet(agent: Agent) {
  if (agent.status !== "draft") throw new WalletError("This agent already has a wallet", 409);
  const policyId = await ensurePolicy(agent);
  const wallet = await ensureWallet(agent, policyId);
  const hash = await fund(agent, wallet.address);
  return save(agent.id, { fundingTx: hash, status: "wallet_ready" });
}

export async function agentBalance(address: string) {
  const wei = await publicClient.getBalance({ address: address as `0x${string}` });
  return fromWei(wei);
}
