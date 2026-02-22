import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";
import { logger } from "./logger.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function llmComplete(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  logger.debug(
    { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    "LLM call completed"
  );

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text;
}
