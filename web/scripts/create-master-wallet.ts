import { PrivyClient } from "@privy-io/node";

// Creates the platform master wallet once. Run with node --env-file=.env.local.
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;
const publicKey = process.env.PRIVY_AUTHORIZATION_PUBLIC_KEY;

if (process.env.MASTER_WALLET_ID) {
  console.log(`MASTER_WALLET_ID is already set to ${process.env.MASTER_WALLET_ID}. Nothing to do.`);
  process.exit(0);
}
if (!appId || !appSecret || !publicKey) {
  console.error("Set NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET and PRIVY_AUTHORIZATION_PUBLIC_KEY in web/.env.local first.");
  process.exit(1);
}

const privy = new PrivyClient({ appId, appSecret });
const wallet = await privy.wallets().create({
  chain_type: "ethereum",
  display_name: "twofield master wallet",
  owner: { public_key: publicKey },
});

console.log("");
console.log("Master wallet created. Add these to web/.env.local and to the Vercel project.");
console.log("");
console.log(`MASTER_WALLET_ID=${wallet.id}`);
console.log(`MASTER_WALLET_ADDRESS=${wallet.address}`);
console.log("");
console.log(`Fund it with Arc Testnet USDC at https://faucet.circle.com using the address above.`);
console.log(`Explorer https://testnet.arcscan.app/address/${wallet.address}`);
