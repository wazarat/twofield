import { Wordmark } from "@/components/wordmark";
import { AuthButton } from "@/components/auth-button";
import { NavLinks } from "@/components/nav-links";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <NavLinks />
        <AuthButton />
      </div>
    </header>
  );
}
