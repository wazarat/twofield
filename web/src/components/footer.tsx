import { Wordmark } from "@/components/wordmark";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
        <Wordmark />
        <p>Built on Arc testnet for ETHOnline 2026.</p>
        <a
          href="https://github.com/wazarat/twofield"
          className="font-mono text-xs uppercase tracking-wide transition hover:text-ink"
        >
          github.com/wazarat/twofield
        </a>
      </div>
    </footer>
  );
}
