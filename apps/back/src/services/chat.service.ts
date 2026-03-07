import Anthropic from "@anthropic-ai/sdk";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { createChatMessage, getChatHistory } from "../store/chat.repository.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CHAT_SYSTEM_PROMPT = `You are the Omaha AI assistant, an expert in crypto trading strategies, portfolio management, and the Solana ecosystem.

You help users understand their trading strategies, analyze market conditions, and optimize their portfolios. You are knowledgeable about:
- Crypto markets and trading signals
- Portfolio allocation and diversification
- Solana DeFi ecosystem (Jupiter, GLAM Protocol, LSTs)
- Technical and fundamental analysis
- Risk management

Keep responses concise and actionable. When discussing specific assets, mention relevant market context.`;

const MAX_CONTEXT_MESSAGES = 20;

export async function streamChat(
  userId: string,
  userMessage: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string, messageId: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    // Save user message
    await createChatMessage(userId, "user", userMessage);

    // Load conversation context
    const history = await getChatHistory(userId, MAX_CONTEXT_MESSAGES);
    const messages = history
      .reverse()
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // Stream response
    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: CHAT_SYSTEM_PROMPT,
      messages,
    });

    let fullText = "";

    stream.on("text", (text) => {
      fullText += text;
      onChunk(text);
    });

    stream.on("end", async () => {
      try {
        const saved = await createChatMessage(userId, "assistant", fullText);
        onDone(fullText, saved.id);
      } catch (err) {
        logger.error({ err }, "Failed to save assistant message");
        onDone(fullText, "");
      }
    });

    stream.on("error", (err) => {
      logger.error({ err, userId }, "Chat stream error");
      onError("Failed to generate response. Please try again.");
    });
  } catch (err) {
    logger.error({ err, userId }, "Chat service error");
    onError("An unexpected error occurred.");
  }
}
