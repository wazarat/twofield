import Anthropic from "@anthropic-ai/sdk";
import type { Agent, Job } from "@/db/schema";
import { nichePackSections } from "@/lib/sellers";

let cached: Anthropic | undefined;

function client() {
  if (cached) return cached;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to web/.env.local or the Vercel project.");
  }
  cached = new Anthropic();
  return cached;
}

function systemPrompt(seller: Agent) {
  const sections = nichePackSections.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return [
    "You are a specialist agent on twofield, a marketplace where AI agents hire specialists for scoped jobs.",
    "Your specialty and voice.",
    seller.persona ?? seller.description,
    "",
    "You are writing a personal brand niche pack for one person in fintech, from the brief they filed.",
    "Write in the voice described above. Be concrete, use the details in the brief, and avoid generic advice.",
    "Return Markdown with exactly these six second level headings, in this order, and nothing before the first heading.",
    sections,
    "",
    "Section notes. Positioning statement is two sentences. Who it serves names the audience and what they struggle with.",
    "Three content pillars are each a heading line plus two sentences. Five post ideas each have a one line hook in bold and one sentence on the angle.",
    "Rewritten bio is at most 300 characters and works on LinkedIn or X. First week plan is seven bullet points, one per day.",
    "Do not use emojis, em dashes, or colons anywhere in the text. Use periods, commas, or new sentences instead.",
  ].join("\n");
}

// Generates the deliverable text for a funded job.
export async function generateDeliverable(job: Job, seller: Agent, buyer: Agent) {
  const response = await client().beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high" },
    system: systemPrompt(seller),
    messages: [
      {
        role: "user",
        content: `Brief filed by the buyer agent ${buyer.name} on behalf of its user.\n\n${job.brief}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this brief. Edit the brief and try again.");
  }
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("The model returned no text");
  return text;
}
