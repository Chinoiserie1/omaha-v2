import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@repo/database";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { createChatMessage, getSessionMessages } from "../store/chat.repository.js";
import * as portfolioRepo from "../store/portfolio.repository.js";
import { getCuratedAssetSymbols } from "../data/curated-assets.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MAX_CONTEXT_MESSAGES = 20;

function buildPortfolioSystemPrompt(
  thesisSummary: string,
  allocationsText: string,
  availableAssets: string[],
  hasVault: boolean,
): string {
  const vaultContext = hasVault
    ? "VAULT STATUS: You have an active vault deployed on-chain. Portfolio changes will trigger automatic rebalancing."
    : `VAULT STATUS: You do NOT have a vault deployed on-chain yet. Without a vault, your portfolio strategy is simulation-only.

VAULT DEPLOYMENT:
- If the user asks to deploy, create, or launch their vault, include the vault_deploy block below.
- If the user has set up allocations but has no vault, proactively suggest deploying their vault so their strategy goes live on-chain.
- Only suggest vault deployment when it's contextually relevant (e.g. after setting up a portfolio, or when discussing going live).

VAULT DEPLOY FORMAT:
When suggesting or confirming vault deployment, include this block at the end of your message:

\`\`\`vault_deploy
{ "action": "create_vault" }
\`\`\``;

  return `You are the Omaha AI portfolio strategist. You help users refine their crypto trading strategy and optimize their portfolio allocations.

CURRENT PORTFOLIO:
Thesis: ${thesisSummary}
Allocations:
${allocationsText}

${vaultContext}

AVAILABLE ASSETS: ${availableAssets.join(", ")}

RULES:
1. ONLY discuss portfolio strategy, trading thesis, and asset allocation.
2. If the user asks about something unrelated to portfolio management, politely redirect them back to portfolio topics.
3. When proposing portfolio changes, you MUST include a structured portfolio block using the exact format below.
4. All allocations must sum to 100%. USDC is the remainder/cash position.
5. Only use assets from the AVAILABLE ASSETS list above.
6. Each allocation needs: asset symbol, percentage (integer), conviction (low/medium/high), and reasoning.
7. Keep responses concise and actionable.

PORTFOLIO PROPOSAL FORMAT:
When you suggest portfolio changes, include this block at the end of your message:

\`\`\`portfolio
{
  "thesisSummary": "Updated thesis summary here",
  "allocations": [
    { "asset": "SOL", "percentage": 35, "conviction": "high", "reasoning": "reason" },
    { "asset": "USDC", "percentage": 65, "conviction": "high", "reasoning": "remainder" }
  ],
  "changes": ["Increased SOL from 20% to 35%", "Reduced USDC from 80% to 65%"]
}
\`\`\`

Only include the portfolio block when you are actually proposing specific allocation changes, not for general discussion.`;
}

function formatAllocations(
  allocations: Array<{
    asset: string;
    percentage: number;
    conviction: string;
  }>,
): string {
  return allocations
    .map((a) => `  ${a.asset} ${a.percentage}% (${a.conviction})`)
    .join("\n");
}

export function parsePortfolioProposal(
  text: string,
): {
  thesisSummary: string;
  allocations: Array<{
    asset: string;
    percentage: number;
    conviction: string;
    reasoning: string;
  }>;
  changes: string[];
} | null {
  const match = text.match(/```portfolio\s*\n([\s\S]*?)\n```/);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (
      parsed.thesisSummary &&
      Array.isArray(parsed.allocations) &&
      Array.isArray(parsed.changes)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function stripPortfolioBlock(text: string): string {
  return text.replace(/\n*```portfolio\s*\n[\s\S]*?\n```\s*/g, "").trim();
}

export function parseVaultDeployAction(
  text: string,
): { action: "create_vault" } | null {
  const match = text.match(/```vault_deploy\s*\n([\s\S]*?)\n```/);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.action === "create_vault") {
      return { action: "create_vault" };
    }
    return null;
  } catch {
    return null;
  }
}

export function stripVaultDeployBlock(text: string): string {
  return text.replace(/\n*```vault_deploy\s*\n[\s\S]*?\n```\s*/g, "").trim();
}

export async function streamPortfolioChat(
  sessionId: string,
  userId: string,
  quantId: string,
  userMessage: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string, messageId: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    await createChatMessage(sessionId, userId, "user", userMessage);

    const [history, snapshot, vault] = await Promise.all([
      getSessionMessages(sessionId, MAX_CONTEXT_MESSAGES),
      portfolioRepo.findLatestSnapshot(quantId),
      prisma.vault.findUnique({ where: { quantId }, select: { id: true } }),
    ]);

    const messages = history.reverse().map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const availableAssets = getCuratedAssetSymbols();

    const thesisSummary = snapshot?.thesisSummary ?? "No portfolio configured yet.";
    const allocations = snapshot?.allocationRows.map((r) => ({
      asset: r.asset,
      percentage: r.percentage,
      conviction: r.conviction,
    })) ?? [];
    const allocationsText =
      allocations.length > 0
        ? formatAllocations(allocations)
        : "  No allocations set";

    const systemPrompt = buildPortfolioSystemPrompt(
      thesisSummary,
      allocationsText,
      availableAssets,
      vault !== null,
    );

    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    let fullText = "";

    stream.on("text", (text) => {
      fullText += text;
      onChunk(text);
    });

    stream.on("end", async () => {
      try {
        const saved = await createChatMessage(sessionId, userId, "assistant", fullText);
        onDone(fullText, saved.id);
      } catch (err) {
        logger.error({ err }, "Failed to save assistant message");
        onDone(fullText, "");
      }
    });

    stream.on("error", (err) => {
      logger.error({ err, userId }, "Portfolio chat stream error");
      onError("Failed to generate response. Please try again.");
    });
  } catch (err) {
    logger.error({ err, userId }, "Portfolio chat service error");
    onError("An unexpected error occurred.");
  }
}
