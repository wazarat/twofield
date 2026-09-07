import { createViemAccount } from "@privy-io/node/viem";
import { createWalletClient, http, parseAbi, parseEventLogs, type Hex } from "viem";
import { AGENTIC_COMMERCE, USDC, arcTestnet, publicClient } from "@/lib/arc";
import { authorizationContext, privy } from "@/lib/privy";

export const escrowAbi = parseAbi([
  "function createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook) returns (uint256)",
  "function setBudget(uint256 jobId, uint256 amount, bytes optParams)",
  "function fund(uint256 jobId, bytes optParams)",
  "function submit(uint256 jobId, bytes32 deliverable, bytes optParams)",
  "function complete(uint256 jobId, bytes32 reason, bytes optParams)",
  "function reject(uint256 jobId, bytes32 reason, bytes optParams)",
  "function claimRefund(uint256 jobId)",
  "function getJob(uint256 jobId) view returns ((uint256 id, address client, address provider, address evaluator, string description, uint256 budget, uint256 expiredAt, uint8 status, address hook))",
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)",
  "event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount)",
  "event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable)",
  "event JobCompleted(uint256 indexed jobId, address indexed evaluator, bytes32 reason)",
  "event JobRejected(uint256 indexed jobId, address indexed rejector, bytes32 reason)",
  "event Refunded(uint256 indexed jobId, address indexed client, uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const onchainJobStatus = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"] as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type WalletRef = { id: string; address: `0x${string}` };

export function walletClientFor(wallet: WalletRef) {
  const account = createViemAccount(privy(), {
    walletId: wallet.id,
    address: wallet.address,
    authorizationContext: authorizationContext(),
  });
  return createWalletClient({ account, chain: arcTestnet, transport: http() });
}

async function confirmed(hash: Hex, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} transaction reverted (${hash})`);
  return receipt;
}

export async function escrowCreateJob(buyer: WalletRef, provider: `0x${string}`, evaluator: `0x${string}`, expiredAt: bigint, description: string) {
  const hash = await walletClientFor(buyer).writeContract({
    address: AGENTIC_COMMERCE,
    abi: escrowAbi,
    functionName: "createJob",
    args: [provider, evaluator, expiredAt, description, ZERO_ADDRESS],
  });
  const receipt = await confirmed(hash, "createJob");
  const [event] = parseEventLogs({ abi: escrowAbi, eventName: "JobCreated", logs: receipt.logs });
  if (!event) throw new Error("createJob confirmed but no JobCreated event was found");
  return { hash, jobId: event.args.jobId };
}

export async function escrowSetBudget(seller: WalletRef, jobId: bigint, amount6: bigint) {
  const hash = await walletClientFor(seller).writeContract({
    address: AGENTIC_COMMERCE,
    abi: escrowAbi,
    functionName: "setBudget",
    args: [jobId, amount6, "0x"],
  });
  await confirmed(hash, "setBudget");
  return hash;
}

export async function escrowApprove(buyer: WalletRef, amount6: bigint) {
  const hash = await walletClientFor(buyer).writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [AGENTIC_COMMERCE, amount6],
  });
  await confirmed(hash, "approve");
  return hash;
}

export async function escrowFund(buyer: WalletRef, jobId: bigint) {
  const hash = await walletClientFor(buyer).writeContract({
    address: AGENTIC_COMMERCE,
    abi: escrowAbi,
    functionName: "fund",
    args: [jobId, "0x"],
  });
  await confirmed(hash, "fund");
  return hash;
}

export async function readEscrowJob(jobId: bigint) {
  const job = await publicClient.readContract({ address: AGENTIC_COMMERCE, abi: escrowAbi, functionName: "getJob", args: [jobId] });
  return { ...job, statusName: onchainJobStatus[Number(job.status)] ?? "Unknown" };
}
