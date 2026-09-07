"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/user-context";

const pill = "rounded-full px-5 py-2 text-sm font-medium transition";

export function AuthButton() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { user: me } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const { login } = useLogin({
    onComplete: () => {
      if (pathname === "/") router.push("/agents");
    },
  });

  if (!ready) {
    return <span className={`${pill} invisible bg-ink text-white`}>Sign in</span>;
  }

  if (!authenticated) {
    return (
      <button type="button" onClick={() => login()} className={`${pill} bg-ink text-white hover:bg-ink/85`}>
        Sign in
      </button>
    );
  }

  const label = me?.username ?? user?.email?.address ?? "Signed in";

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[200px] truncate font-mono text-xs text-ink-muted sm:inline">{label}</span>
      <button type="button" onClick={logout} className={`${pill} border border-ink hover:bg-ink hover:text-white`}>
        Sign out
      </button>
    </div>
  );
}
