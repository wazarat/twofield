"use client";

import { usePrivy } from "@privy-io/react-auth";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type CurrentUser = { id: string; username: string };

type Value = {
  // The twofield account for the signed in Privy user, null until a username is set.
  user: CurrentUser | null;
  // True once Privy is ready and, when signed in, the account lookup has finished.
  loaded: boolean;
  setUser: (user: CurrentUser) => void;
};

const UserContext = createContext<Value>({ user: null, loaded: false, setUser: () => undefined });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const key = authenticated ? (privyUser?.id ?? "") : "";
  const [fetched, setFetched] = useState<{ key: string; user: CurrentUser | null } | null>(null);

  useEffect(() => {
    if (!ready || !key || fetched?.key === key) return;
    let active = true;
    api<{ user: CurrentUser | null }>("/api/me")
      .then((data) => {
        if (active) setFetched({ key, user: data.user });
      })
      .catch(() => {
        if (active) setFetched({ key, user: null });
      });
    return () => {
      active = false;
    };
  }, [ready, key, fetched]);

  const current = key && fetched?.key === key ? fetched.user : null;
  const loaded = ready && (!key || fetched?.key === key);

  return (
    <UserContext.Provider value={{ user: current, loaded, setUser: (user) => setFetched({ key, user }) }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}
