import { PrivyClient } from "@privy-io/node";

let cached: PrivyClient | undefined;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to web/.env.local or the Vercel project.`);
  return value;
}

export function privy() {
  if (cached) return cached;
  cached = new PrivyClient({ appId: required("NEXT_PUBLIC_PRIVY_APP_ID"), appSecret: required("PRIVY_APP_SECRET") });
  return cached;
}

export function ownerPublicKey() {
  return required("PRIVY_AUTHORIZATION_PUBLIC_KEY");
}

export function authorizationContext() {
  return { authorization_private_keys: [required("PRIVY_AUTHORIZATION_KEY")] };
}

export function masterWallet() {
  return {
    id: required("MASTER_WALLET_ID"),
    address: required("MASTER_WALLET_ADDRESS") as `0x${string}`,
  };
}
