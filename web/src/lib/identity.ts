import { createViemAccount } from "@privy-io/node/viem";
import { eq } from "drizzle-orm";
import { createWalletClient, http, parseAbi, parseEventLogs } from "viem";
import { db } from "@/db";
import { agents, type Agent } from "@/db/schema";
import { IDENTITY_REGISTRY, arcTestnet, publicClient } from "@/lib/arc";
import { AppError } from "@/lib/errors";
import { metadataUrl } from "@/lib/metadata";
import { authorizationContext, privy } from "@/lib/privy";

export class IdentityError extends AppError {}

export const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

// Registers the agent on the ERC-8004 IdentityRegistry from its own wallet, so the
// agent owns its identity token. Gas comes from the wallet's funding buffer.
export async function registerAgent(agent: Agent, base: string) {
  if (agent.status === "registered") throw new IdentityError("This agent is already registered", 409);
  if (agent.status !== "wallet_ready" || !agent.walletId || !agent.walletAddress) {
    throw new IdentityError("Create the agent's wallet before registering its identity", 409);
  }

  const uri = metadataUrl(base, agent.id);
  const account = createViemAccount(privy(), {
    walletId: agent.walletId,
    address: agent.walletAddress as `0x${string}`,
    authorizationContext: authorizationContext(),
  });
  const client = createWalletClient({ account, chain: arcTestnet, transport: http() });

  const hash = await client.writeContract({
    address: IDENTITY_REGISTRY,
    abi: identityAbi,
    functionName: "register",
    args: [uri],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new IdentityError("Registration transaction reverted", 502, { tx: hash });

  const [event] = parseEventLogs({ abi: identityAbi, eventName: "Registered", logs: receipt.logs });
  if (!event) throw new IdentityError("Registration confirmed but no Registered event was found", 502, { tx: hash });

  const [row] = await db()
    .update(agents)
    .set({ onchainAgentId: event.args.agentId.toString(), registrationTx: hash, metadataUri: uri, status: "registered" })
    .where(eq(agents.id, agent.id))
    .returning();
  return row;
}
