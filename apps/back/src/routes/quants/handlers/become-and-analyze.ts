import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";
import { logger } from "../../../utils/logger.js";
import { getRedis, isRedisAvailable } from "../../../infra/redis.js";
import { syncQuantTweets, syncQuantProfile } from "../../../services/quant.service.js";
import { classifyUnclassifiedTweets } from "../../../services/classifier.service.js";
import { synthesizeThesis } from "../../../services/thesis.service.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type BecomeAndAnalyzeResponse = { quantId: string };

function redisKey(quantId: string): string {
  return `quant:setup:${quantId}`;
}

async function setSetupStatus(
  quantId: string,
  status: string,
  error?: string,
): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = getRedis();
    const data: Record<string, string> = { status };
    if (error) data["error"] = error;
    await redis.hset(redisKey(quantId), data);
    await redis.expire(redisKey(quantId), 3600);
  } catch (err) {
    logger.warn({ quantId, err }, "Failed to set setup status in Redis");
  }
}

async function createDefaultUsdcSnapshot(
  quantId: string,
  reason: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await portfolioRepo.createSnapshot({
    quantId,
    thesisSummary: reason,
    allocations: [
      {
        asset: "USDC",
        percentage: 100,
        conviction: "high",
        reasoning: "Default — " + reason.toLowerCase(),
        since: today,
        lastSignal: today,
      },
    ],
    changes: ["Initial portfolio: 100% USDC"],
    sourceTweetIds: [],
  });
}

async function ensureDefaultPortfolio(quantId: string): Promise<void> {
  const existing = await portfolioRepo.findLatestSnapshot(quantId);
  if (!existing) {
    await createDefaultUsdcSnapshot(
      quantId,
      "Currently holding USDC. Use the AI chat to build your portfolio strategy.",
    );
  }
}

async function runSetupPipeline(quantId: string): Promise<void> {
  try {
    await setSetupStatus(quantId, "syncing_profile");
    await syncQuantProfile(quantId);

    await setSetupStatus(quantId, "fetching_tweets");
    await syncQuantTweets(quantId);

    await setSetupStatus(quantId, "classifying");
    await classifyUnclassifiedTweets(quantId);

    await setSetupStatus(quantId, "synthesizing");
    const didUpdate = await synthesizeThesis(quantId);

    if (!didUpdate) {
      await createDefaultUsdcSnapshot(
        quantId,
        "No crypto trading signals detected. Currently holding USDC.",
      );
    }

    await setSetupStatus(quantId, "complete");
    logger.info({ quantId }, "Quant setup pipeline complete");
  } catch (err) {
    logger.error({ quantId, err }, "Quant setup pipeline failed");

    // Always ensure a usable portfolio exists even on error
    try {
      await ensureDefaultPortfolio(quantId);
    } catch (snapshotErr) {
      logger.error({ quantId, snapshotErr }, "Failed to create fallback USDC snapshot");
    }

    await setSetupStatus(quantId, "complete");
  }
}

function launchPipeline(quantId: string): void {
  setSetupStatus(quantId, "pending").catch(() => {});
  runSetupPipeline(quantId).catch((err) => {
    logger.error({ quantId, err }, "Setup pipeline unhandled error");
  });
}

export async function becomeAndAnalyze(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<BecomeAndAnalyzeResponse> | ApiResponse<never>> {
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
    include: { quant: { select: { id: true } } },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  // User already has a quant — check if they need the pipeline re-run
  if (user.quant) {
    const quantId = user.quant.id;
    const existing = await portfolioRepo.findLatestSnapshot(quantId);

    if (existing) {
      // Already has a portfolio, nothing to do
      return reply.status(200).send({
        success: true,
        data: { quantId },
      } satisfies ApiResponse<BecomeAndAnalyzeResponse>);
    }

    // Has quant but no portfolio — run the pipeline
    await prisma.quant.update({
      where: { id: quantId },
      data: { isActive: true },
    });

    launchPipeline(quantId);

    return reply.status(202).send({
      success: true,
      data: { quantId },
    } satisfies ApiResponse<BecomeAndAnalyzeResponse>);
  }

  // New quant
  const quant = await prisma.quant.create({
    data: {
      userId: user.id,
      isActive: true,
      algoEnabled: false,
    },
  });

  launchPipeline(quant.id);

  return reply.status(202).send({
    success: true,
    data: { quantId: quant.id },
  } satisfies ApiResponse<BecomeAndAnalyzeResponse>);
}
