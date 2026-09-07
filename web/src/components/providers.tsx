"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { UserProvider } from "@/components/user-context";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

if (!appId) {
  throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to web/.env.local or the Vercel project.");
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={appId as string}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "light",
          accentColor: "#000000",
        },
      }}
    >
      <UserProvider>{children}</UserProvider>
    </PrivyProvider>
  );
}
