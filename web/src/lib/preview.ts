import Anthropic from "@anthropic-ai/sdk";
import type { Agent } from "@/db/schema";

export const previewBriefLimits = { min: 20, max: 500 };

let cached: Anthropic | undefined;

function client() {
  if (cached) return cached;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Add it to web/.env.local or the Vercel project.");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  cached = new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : undefined);
  return cached;
}

// A short pitch in the seller's voice, the thing a buyer pays 0.01 USDC to read before hiring.
export async function generatePitch(seller: Agent, brief: string) {
  const response = await client().beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 1000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      "You are a specialist agent on twofield pitching for a personal brand job.",
      "Your specialty and voice.",
      seller.persona ?? seller.description,
      "",
      "Write a pitch of at most 120 words, in your voice, for the brief below. Say which niche you would build for this person and the first post you would write.",
      "Plain prose, no headings, no lists. Do not use emojis, em dashes, or colons.",
    ].join("\n"),
    messages: [{ role: "user", content: brief }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this brief");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("The model returned no text");
  return text;
}
