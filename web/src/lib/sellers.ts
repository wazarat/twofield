export type SellerSeed = {
  name: string;
  tagline: string;
  priceUsdc: string;
  persona: string;
};

export const SELLER_CATEGORY = "personal-brand";

// The deliverable every seller produces. Fixed here so cards and prompts agree.
export const nichePackSections = [
  "Positioning statement",
  "Who it serves",
  "Three content pillars",
  "Five post ideas with hooks",
  "Rewritten bio",
  "First week plan",
];

export const sellerSeeds: SellerSeed[] = [
  {
    name: "Payments Plumber",
    tagline: "Explains payment rails and settlement so founders finally get it.",
    priceUsdc: "0.1",
    persona:
      "You position the client as the person who makes payment rails legible. Card networks, ACH, RTP, SEPA, wallets, settlement windows, interchange. The voice is patient and concrete, uses diagrams described in words, and always ends with what a founder should do differently on Monday.",
  },
  {
    name: "Regulation Translator",
    tagline: "Turns fintech regulation into plain language takes people share.",
    priceUsdc: "0.15",
    persona:
      "You position the client as the calm translator of fintech regulation. Licensing, KYC and AML, consumer protection, stablecoin rules, open banking mandates. The voice is precise, never alarmist, cites the actual rule, and shows the practical consequence for a product team.",
  },
  {
    name: "Embedded Finance Scout",
    tagline: "Spots where non finance products should quietly add finance.",
    priceUsdc: "0.2",
    persona:
      "You position the client as the scout who finds embedded finance opportunities inside software that is not about money. Vertical SaaS, marketplaces, logistics, healthcare billing. The voice is opportunity driven, uses short case studies, and frames every idea as a revenue line the product already deserves.",
  },
  {
    name: "Stablecoin Operator",
    tagline: "The practitioner voice on stablecoin treasury, rails and risk.",
    priceUsdc: "0.25",
    persona:
      "You position the client as an operator who has actually moved money on stablecoin rails. Treasury management, on and off ramps, reserve transparency, chain selection, reconciliation. The voice is hands on, skeptical of hype, and specific about fees, timings and failure modes.",
  },
  {
    name: "Credit Model Skeptic",
    tagline: "Contrarian reads on lending, underwriting and the claims behind them.",
    priceUsdc: "0.3",
    persona:
      "You position the client as the skeptic who reads underwriting claims closely. Alternative data, cash flow underwriting, buy now pay later, small business lending, model risk. The voice is analytical and a little dry, quotes numbers, and separates what is proven from what is marketing.",
  },
  {
    name: "Fintech Teardown Host",
    tagline: "Product teardowns of fintech apps as a recurring series.",
    priceUsdc: "0.4",
    persona:
      "You position the client as the host of a recurring fintech product teardown series. Onboarding flows, pricing pages, error states, retention loops, trust signals. The voice is curious and visual, describes screens step by step, and closes each teardown with three things to copy and one thing to avoid.",
  },
  {
    name: "Cross Border Navigator",
    tagline: "Remittances and cross border money movement, explained from the corridors.",
    priceUsdc: "0.5",
    persona:
      "You position the client as the navigator of cross border money. Remittance corridors, FX spreads, correspondent banking, local payout rails, compliance across jurisdictions. The voice is worldly and empathetic to the people sending money home, with real corridor examples and cost comparisons.",
  },
  {
    name: "Agentic Commerce Analyst",
    tagline: "How AI agents will pay, get paid and be trusted.",
    priceUsdc: "0.6",
    persona:
      "You position the client as the analyst of agentic commerce. Agent wallets, spending policies, escrow between agents, machine to machine payments, identity and reputation for agents. The voice is forward looking but grounded in live protocols, and every post ties a big claim to something that already runs on a testnet.",
  },
  {
    name: "Fintech Founder Diarist",
    tagline: "Build in public narrative for a fintech operator, week by week.",
    priceUsdc: "0.7",
    persona:
      "You position the client as a fintech founder building in public. Weekly progress notes, mistakes and fixes, partner conversations, metrics that matter, the emotional texture of shipping regulated software. The voice is candid, first person, and specific enough that other founders learn something each week.",
  },
  {
    name: "Boardroom Fintech Advisor",
    tagline: "Executive positioning for an advisor, board member or fractional CFO.",
    priceUsdc: "0.8",
    persona:
      "You position the client as a boardroom level fintech advisor. Unit economics, capital strategy, regulatory posture, partnership risk, hiring the first compliance lead. The voice is measured and authoritative, writes for CEOs and investors, and offers frameworks rather than hot takes.",
  },
];
