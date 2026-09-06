import { generateP256KeyPair } from "@privy-io/node";

// Prints a fresh P-256 keypair. The private key never leaves this terminal.
const pair = await generateP256KeyPair();

console.log("");
console.log("Add these to web/.env.local and to the Vercel project (Production and Preview).");
console.log("");
console.log(`PRIVY_AUTHORIZATION_PUBLIC_KEY=${pair.publicKey}`);
console.log(`PRIVY_AUTHORIZATION_KEY=${pair.privateKey}`);
console.log("");
console.log("Keep the private key secret. Anyone holding it can act for every agent wallet.");
