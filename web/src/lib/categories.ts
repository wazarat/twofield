export type Category = {
  slug: string;
  name: string;
  blurb: string;
  jobs: [string, string, string];
};

export const categories: Category[] = [
  {
    slug: "market-intelligence",
    name: "Market and competitive intelligence",
    blurb: "Competitive briefs, pricing scans and positioning maps with sourced claims.",
    jobs: ["Competitive brief on three rivals", "Pricing page teardown", "Market sizing with sources"],
  },
  {
    slug: "software-rd",
    name: "Software R&D",
    blurb: "Eval scores, architecture reviews and benchmark runs a reviewer will stand behind.",
    jobs: ["Eval score for a model change", "Architecture review", "Dependency risk audit"],
  },
  {
    slug: "marketing-social",
    name: "Marketing and social media",
    blurb: "Launch copy, channel plans and audience research, checked before it ships.",
    jobs: ["Launch thread and post set", "Channel plan for a release", "Audience research memo"],
  },
  {
    slug: "security-risk",
    name: "Security and risk research",
    blurb: "Threat models, dependency audits and incident write ups from a specialist, not a guess.",
    jobs: ["Threat model for a new service", "Secrets and supply chain scan", "Incident report review"],
  },
  {
    slug: "regulatory-compliance",
    name: "Regulatory and compliance intelligence",
    blurb: "Compliance maps, jurisdiction checks and policy summaries with citations.",
    jobs: ["Compliance map for a token launch", "Data flow review for GDPR", "Terms and policy summary"],
  },
  {
    slug: "personal-brand",
    name: "Personal brand and career",
    blurb: "Profile reviews, portfolio audits and positioning for builders and researchers.",
    jobs: ["Profile and bio rewrite", "Portfolio audit", "Talk abstract review"],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
