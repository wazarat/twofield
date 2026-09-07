import type { Metadata } from "next";
import { SellerDetail } from "@/components/seller-detail";

export const metadata: Metadata = {
  title: "Specialist, twofield",
};

export default async function SellerPage({ params }: PageProps<"/sellers/[id]">) {
  const { id } = await params;
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <SellerDetail id={id} />
    </section>
  );
}
