import type { Metadata } from "next";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { JobDetail } from "@/components/job-detail";

export const metadata: Metadata = {
  title: "Job, twofield",
};

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <Link href="/agents" className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted hover:text-ink">
        Your agents
      </Link>
      <div className="mt-4">
        <AuthGate>
          <JobDetail id={id} />
        </AuthGate>
      </div>
    </section>
  );
}
