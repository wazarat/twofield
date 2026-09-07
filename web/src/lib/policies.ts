import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, type Agent } from "@/db/schema";
import {
  AGENTIC_COMMERCE,
  ARC_CHAIN_ID,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  USDC,
  VALIDATION_REGISTRY,
  toUsdc6,
  toWei,
} from "@/lib/arc";
import { authorizationContext, masterWallet, privy } from "@/lib/privy";

export const BUYER_POLICY_VERSION = 5;
export const PREVIEW_CAP_USDC = "0.01";

const chain = { field_source: "ethereum_transaction" as const, field: "chain_id" as const, operator: "eq" as const, value: String(ARC_CHAIN_ID) };
const zeroValue = { field_source: "ethereum_transaction" as const, field: "value" as const, operator: "lte" as const, value: "0" };

const approveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function to(addresses: string[]) {
  return { field_source: "ethereum_transaction" as const, field: "to" as const, operator: "in" as const, value: addresses };
}

// A buyer wallet may register its identity, approve the escrow for at most its per job
// cap, call the escrow and reputation contracts, and return its balance to the master
// wallet when archived. Nothing else is signable.
export function buyerRules(agent: Agent) {
  const cap6 = toUsdc6(agent.maxBudgetPerJob).toString();
  const capWei = toWei(agent.maxBudgetPerJob).toString();
  const groups = [
    {
      name: "Identity registry within cap",
      conditions: [chain, to([IDENTITY_REGISTRY]), { ...zeroValue, value: capWei }],
    },
    {
      name: "Approve escrow up to max per job",
      conditions: [
        chain,
        to([USDC]),
        zeroValue,
        { field_source: "ethereum_calldata" as const, abi: approveAbi, field: "approve.spender", operator: "eq" as const, value: AGENTIC_COMMERCE },
        { field_source: "ethereum_calldata" as const, abi: approveAbi, field: "approve.amount", operator: "lte" as const, value: cap6 },
      ],
    },
    {
      name: "Escrow and reputation calls",
      conditions: [chain, to([AGENTIC_COMMERCE, REPUTATION_REGISTRY]), zeroValue],
    },
    {
      name: "Return unspent balance to platform",
      conditions: [chain, to([masterWallet().address])],
    },
  ];
  const transactionRules = groups.flatMap((g) =>
    (["eth_signTransaction", "eth_sendTransaction"] as const).map((method) => ({
      name: `${g.name} (${method === "eth_signTransaction" ? "sign" : "send"})`,
      method,
      action: "ALLOW" as const,
      conditions: g.conditions,
    })),
  );
  // x402 preview payments are EIP-3009 authorizations on USDC, signed as typed data.
  // The types map must equal the signing request exactly, and adding a chain id domain
  // condition next to a message condition makes Privy deny every request, so the rule
  // pins the verifying contract and caps the value only.
  const authorizationRule = {
    name: "USDC authorization up to the preview price",
    method: "eth_signTypedData_v4" as const,
    action: "ALLOW" as const,
    conditions: [
      { field_source: "ethereum_typed_data_domain" as const, field: "verifyingContract" as const, operator: "eq" as const, value: USDC },
      {
        field_source: "ethereum_typed_data_message" as const,
        field: "value",
        operator: "lte" as const,
        value: toUsdc6(PREVIEW_CAP_USDC).toString(),
        typed_data: {
          primary_type: "TransferWithAuthorization",
          types: {
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
        },
      },
    ],
  };
  return [...transactionRules, authorizationRule];
}

// Evaluator and seller wallets only talk to the marketplace contracts with zero value.
export function contractOnlyRules(addresses: string[]) {
  return (["eth_signTransaction", "eth_sendTransaction"] as const).map((method) => ({
    name: `Marketplace contracts (${method === "eth_signTransaction" ? "sign" : "send"})`,
    method,
    action: "ALLOW" as const,
    conditions: [chain, to(addresses), zeroValue],
  }));
}

export const sellerAllowlist = [IDENTITY_REGISTRY, AGENTIC_COMMERCE, REPUTATION_REGISTRY, VALIDATION_REGISTRY];
export const evaluatorAllowlist = [AGENTIC_COMMERCE, VALIDATION_REGISTRY];

// Brings an existing buyer policy up to the current rule set. Idempotent.
export async function ensureBuyerPolicy(agent: Agent) {
  if (!agent.policyId) throw new Error("Agent has no policy");
  if (agent.policyVersion >= BUYER_POLICY_VERSION) return agent;
  await privy().policies().update(agent.policyId, {
    rules: buyerRules(agent),
    authorization_context: authorizationContext(),
  });
  const [row] = await db()
    .update(agents)
    .set({ policyVersion: BUYER_POLICY_VERSION })
    .where(eq(agents.id, agent.id))
    .returning();
  return row;
}
