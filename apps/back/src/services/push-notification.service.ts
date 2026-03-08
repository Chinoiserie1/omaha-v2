import { prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import { findTokensByUserIds } from "../store/push-token.repository.js";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;
const SIGNIFICANT_CATEGORIES = ["investment_call", "thesis_update"];
const MIN_SIGNIFICANCE_SCORE = 15;
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function notifyFollowersOfSignificantTweets(
  quantId: string,
  snapshotId: string,
): Promise<void> {
  // 1. Check snapshot is recent (skip retroactive backfills)
  const snapshot = await prisma.portfolioSnapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    logger.warn({ quantId, snapshotId }, "Snapshot not found for push notification");
    return;
  }

  const age = Date.now() - snapshot.createdAt.getTime();
  if (age > MAX_AGE_MS) {
    logger.info(
      { quantId, snapshotId, ageMinutes: Math.round(age / 60_000) },
      "Snapshot too old for push notification, skipping",
    );
    return;
  }

  // 2. Query significant TweetImpact records for this snapshot
  const impacts = await prisma.tweetImpact.findMany({
    where: {
      snapshotId,
      category: { in: SIGNIFICANT_CATEGORIES },
      significanceScore: { gte: MIN_SIGNIFICANCE_SCORE },
    },
  });

  if (impacts.length === 0) {
    logger.info({ quantId, snapshotId }, "No significant tweets for push notification");
    return;
  }

  // 3. Find the quant's userId and username
  const quant = await prisma.quant.findUnique({
    where: { id: quantId },
    include: { user: { select: { id: true, twitterUsername: true } } },
  });

  if (!quant) {
    logger.warn({ quantId }, "Quant not found for push notification");
    return;
  }

  // 4. Find followers
  const follows = await prisma.follow.findMany({
    where: { followingId: quant.userId },
    select: { followerId: true },
  });

  if (follows.length === 0) {
    logger.info({ quantId }, "No followers to notify");
    return;
  }

  const followerIds = follows.map((f) => f.followerId);

  // 5. Get push tokens for followers
  const pushTokens = await findTokensByUserIds(followerIds);

  if (pushTokens.length === 0) {
    logger.info({ quantId, followerCount: followerIds.length }, "No push tokens for followers");
    return;
  }

  // 6. Build notification
  const username = quant.user.twitterUsername ?? "Quant";
  const allAssets = [...new Set(impacts.flatMap((i) => i.assets))];
  const category = impacts[0]!.category.replace(/_/g, " ");
  const body =
    allAssets.length > 0
      ? `New ${category}: ${allAssets.join(", ")}`
      : `New ${category}`;

  const messages: ExpoPushMessage[] = pushTokens.map((pt) => ({
    to: pt.token,
    title: `@${username}`,
    body,
    data: { quantId, type: "significant_tweet" },
    sound: "default" as const,
  }));

  // 7. Send in batches
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn(
          { quantId, status: response.status, body: text },
          "Expo push API returned non-OK",
        );
      } else {
        logger.info(
          { quantId, sent: batch.length, batchIndex: i / BATCH_SIZE },
          "Push notifications sent",
        );
      }
    } catch (err) {
      logger.warn({ err, quantId }, "Failed to send push notification batch");
    }
  }
}
