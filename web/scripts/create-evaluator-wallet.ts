import { createWalletClient, http } from "viem";
import { createViemAccount } from "@privy-io/node/viem";
import { EVALUATOR_GAS_USDC, arcTestnet, publicClient, toWei } from "@/lib/arc";
import { contractOnlyRules, evaluatorAllowlist } from "@/lib/policies";
import { authorizationContext, masterWallet, ownerPublicKey, privy } from "@/lib/privy";

// Creates the platform evaluator wallet once. It completes or rejects ERC-8183 jobs
// and answers ERC-8004 validation requests. Run with pnpm wallet:evaluator.
if (process.env.EVALUATOR_WALLET_ID) {
  console.log(`EVALUATOR_WALLET_ID is already set to ${process.env.EVALUATOR_WALLET_ID}. Nothing to do.`);
  process.exit(0);
}

const client = privy();
const policy = await client.policies().create({
  version: "1.0",
  chain_type: "ethereum",
  name: "twofield evaluator",
  owner: { public_key: ownerPublicKey() },
  rules: contractOnlyRules(evaluatorAllowlist),
});
const wallet = await client.wallets().create({
  chain_type: "ethereum",
  display_name: "twofield evaluator",
  owner: { public_key: ownerPublicKey() },
  policy_ids: [policy.id],
});

const master = masterWallet();
const account = createViemAccount(client, { walletId: master.id, address: master.address, authorizationContext: authorizationContext() });
const hash = await createWalletClient({ account, chain: arcTestnet, transport: http() }).sendTransaction({
  to: wallet.address as `0x${string}`,
  value: toWei(EVALUATOR_GAS_USDC),
});
await publicClient.waitForTransactionReceipt({ hash });

console.log("");
console.log("Evaluator wallet created and funded with gas. Add these to web/.env.local and to the Vercel project.");
console.log("");
console.log(`EVALUATOR_WALLET_ID=${wallet.id}`);
console.log(`EVALUATOR_WALLET_ADDRESS=${wallet.address}`);
console.log("");
console.log(`Funding https://testnet.arcscan.app/tx/${hash}`);
