"use client";

import { PrivyProvider } from "@privy-io/react-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

if (!appId) {
  throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to web/.env.local or the Vercel project.");
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={appId as string}
      config={{
        loginMethods: ["email", "google"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "light",
          accentColor: "#000000",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
