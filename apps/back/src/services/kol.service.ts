import type { Kol, Tweet } from "@repo/database";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";
import { delay } from "../utils/delay.js";
import { RateLimitError } from "../utils/errors.js";
import * as twitterService from "./twitter.service.js";
import * as kolRepo from "../store/kol.repository.js";
import * as kolVaultRepo from "../store/kol-vault.repository.js";
import * as tweetRepo from "../store/tweet.repository.js";
import type { TweetResult } from "@repo/shared";
import type { CreateTweetInput } from "../store/tweet.repository.js";

export function mapTweetResultToInput(
  tweet: TweetResult,
  kolId: string,
  opts?: { isThread?: boolean },
): CreateTweetInput {
  const isRetweet = tweet.legacy.retweeted_status_result !== undefined;
  const isReply =
    tweet.legacy.in_reply_to_status_id_str !== undefined &&
    tweet.legacy.in_reply_to_status_id_str !== null;

  const viewsRaw = tweet.views?.count;
  const viewsCount =
    typeof viewsRaw === "string"
      ? parseInt(viewsRaw, 10) || 0
      : (viewsRaw ?? 0);

  return {
    tweetId: tweet.legacy.id_str,
    kolId,
    fullText: tweet.legacy.full_text,
    postedAt: new Date(tweet.legacy.created_at),
    favoriteCount: tweet.legacy.favorite_count,
    retweetCount: tweet.legacy.retweet_count,
    replyCount: tweet.legacy.reply_count,
    bookmarkCount: tweet.legacy.bookmark_count,
    viewsCount,
    isRetweet,
    isReply,
    isThread: opts?.isThread ?? false,
    conversationId: tweet.legacy.conversation_id_str,
    rawJson: tweet as unknown,
  };
}

/**
 * Finds potential thread starters from a timeline batch.
 * A candidate is any tweet where conversation_id === id_str (it started a conversation)
 * AND reply_count > 0 (it has replies — possibly self-replies forming a thread).
 *
 * Twitter's /user-tweets API collapses threads, only returning the starter tweet,
 * so we can't rely on seeing self-replies in the same batch.
 */
function findThreadCandidates(tweets: TweetResult[]): TweetResult[] {
  return tweets.filter(
    (t) =>
      t.legacy.conversation_id_str === t.legacy.id_str &&
      t.legacy.reply_count > 0,
  );
}

export async function syncKolProfile(kolId: string): Promise<void> {
  const kol = await kolRepo.findKolById(kolId);
  if (!kol) {
    logger.warn({ kolId }, "KOL not found");
    return;
  }

  const user = await twitterService.fetchUserDetails(kol.username);
  if (!user) {
    logger.warn({ username: kol.username }, "Could not fetch user details");
    return;
  }

  const avatarUrl =
    user.avatar?.image_url ?? user.legacy.profile_image_url_https;

  await kolRepo.updateKolProfile(kolId, {
    restId: user.rest_id,
    ...(user.legacy.name !== undefined
      ? { displayName: user.legacy.name }
      : {}),
    ...(user.legacy.followers_count !== undefined
      ? { followersCount: user.legacy.followers_count }
      : {}),
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    ...(user.legacy.description !== undefined
      ? { bio: user.legacy.description }
      : {}),
  });

  logger.info(
    { username: kol.username, restId: user.rest_id },
    "KOL profile synced",
  );
}

async function syncKolThreads(
  kolId: string,
  tweets: TweetResult[],
  userIdStr: string,
): Promise<number> {
  const candidates = findThreadCandidates(tweets);
  if (candidates.length === 0) return 0;

  // Check which candidates already have thread data in the DB
  const toFetch: TweetResult[] = [];
  for (const candidate of candidates) {
    const existing = await tweetRepo.findThreadByConversationId(
      candidate.legacy.id_str,
    );
    if (existing.length >= 2) continue; // Already have thread data
    toFetch.push(candidate);
  }

  logger.info(
    { kolId, candidates: candidates.length, fetching: toFetch.length },
    "Fetching potential threads",
  );

  if (toFetch.length === 0) return 0;

  let threadTweetCount = 0;

  for (const starter of toFetch) {
    try {
      await delay(env.FETCH_DELAY_MS);
      const threadTweets = await twitterService.fetchTweetDetail(
        starter.legacy.id_str,
      );

      // Filter to only tweets by the same user (the thread author)
      const selfTweets = threadTweets.filter(
        (t) => t.legacy.user_id_str === userIdStr,
      );

      // Skip false positives: if only 1 self-tweet (the starter itself), not a thread
      if (selfTweets.length < 2) {
        logger.debug(
          { tweetId: starter.legacy.id_str },
          "Not a self-thread, skipping",
        );
        continue;
      }

      for (const tweet of selfTweets) {
        const input = mapTweetResultToInput(tweet, kolId, { isThread: true });
        await tweetRepo.upsertTweet(input);
        threadTweetCount++;
      }

      logger.debug(
        {
          tweetId: starter.legacy.id_str,
          threadLength: selfTweets.length,
        },
        "Thread synced",
      );
    } catch (error) {
      if (error instanceof RateLimitError) throw error;
      logger.warn(
        {
          tweetId: starter.legacy.id_str,
          error: error instanceof Error ? error.message : error,
        },
        "Failed to fetch thread detail, skipping",
      );
    }
  }

  return threadTweetCount;
}

export async function syncKolTweets(kolId: string): Promise<number> {
  const kol = await kolRepo.findKolById(kolId);
  if (!kol) {
    logger.warn({ kolId }, "KOL not found");
    return 0;
  }

  if (!kol.restId) {
    logger.warn(
      { username: kol.username },
      "KOL has no restId, syncing profile first",
    );
    await syncKolProfile(kolId);

    const updated = await kolRepo.findKolById(kolId);
    if (!updated?.restId) {
      logger.error(
        { username: kol.username },
        "Could not resolve restId for KOL",
      );
      return 0;
    }
  }

  const freshKol = await kolRepo.findKolById(kolId);
  if (!freshKol?.restId) return 0;

  const { tweets } = await twitterService.fetchUserTweets(freshKol.restId);
  logger.info(
    { username: freshKol.username, count: tweets.length },
    "Fetched tweets from API",
  );

  let newCount = 0;
  for (const tweet of tweets) {
    const input = mapTweetResultToInput(tweet, freshKol.id);
    await tweetRepo.upsertTweet(input);
    newCount++;
  }

  // Fetch full threads for any detected thread starters
  const userIdStr = freshKol.restId;
  const threadCount = await syncKolThreads(freshKol.id, tweets, userIdStr);

  await kolRepo.updateKolLastFetched(freshKol.id);

  logger.info(
    {
      username: freshKol.username,
      upserted: newCount,
      threadTweets: threadCount,
    },
    "Tweets synced",
  );
  return newCount;
}

const TWEET_URL_REGEX = /(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;

export async function addTweetByUrl(
  url: string,
): Promise<{ kol: Kol; tweet: Tweet }> {
  const match = url.match(TWEET_URL_REGEX);
  if (!match) {
    throw new Error(
      "Invalid tweet URL. Expected format: https://x.com/username/status/123456",
    );
  }

  const username = match[1]!;
  const tweetId = match[2]!;

  // Find-or-create the KOL
  const kol = await kolRepo.upsertKol(username);

  // Ensure KOL has a restId (needed for profile data)
  if (!kol.restId) {
    await syncKolProfile(kol.id);
  }

  // Fetch tweet data from Twitter241
  const tweetResults = await twitterService.fetchTweetDetail(tweetId);
  const target = tweetResults.find((t) => t.legacy.id_str === tweetId);
  if (!target) {
    throw new Error(`Tweet ${tweetId} not found on Twitter`);
  }

  const input = mapTweetResultToInput(target, kol.id);
  const tweet = await tweetRepo.upsertTweet(input);

  // Re-fetch KOL to get potentially updated profile
  const freshKol = await kolRepo.findKolById(kol.id);

  logger.info({ username, tweetId }, "Tweet added by URL");

  return { kol: freshKol ?? kol, tweet };
}

export async function backfillKolTweets(
  kolId: string,
  maxPages: number,
): Promise<{ totalUpserted: number; oldestDate: Date | null }> {
  const kol = await kolRepo.findKolById(kolId);
  if (!kol) {
    throw new Error(`KOL "${kolId}" not found`);
  }

  if (!kol.restId) {
    await syncKolProfile(kolId);
    const updated = await kolRepo.findKolById(kolId);
    if (!updated?.restId) {
      throw new Error(
        `KOL "${kol.username}" has no restId and profile sync failed`,
      );
    }
    kol.restId = updated.restId;
  }

  logger.info(
    { username: kol.username, restId: kol.restId, maxPages },
    "Starting tweet backfill",
  );

  let cursor: string | null = null;
  let totalUpserted = 0;
  let oldestDate: Date | null = null;

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) {
      await delay(env.FETCH_DELAY_MS);
    }

    const result = await twitterService.fetchUserTweets(
      kol.restId,
      cursor ?? undefined,
    );

    if (result.tweets.length === 0) {
      logger.info({ page }, "No tweets returned, stopping backfill");
      break;
    }

    let pageUpserted = 0;
    for (const tweet of result.tweets) {
      const input = mapTweetResultToInput(tweet, kol.id);
      await tweetRepo.upsertTweet(input);
      pageUpserted++;

      const tweetDate = new Date(tweet.legacy.created_at);
      if (!oldestDate || tweetDate < oldestDate) {
        oldestDate = tweetDate;
      }
    }

    totalUpserted += pageUpserted;
    logger.info(
      {
        page,
        pageUpserted,
        totalUpserted,
        oldest: oldestDate?.toISOString(),
      },
      "Backfill page complete",
    );

    cursor = result.cursor;
    if (!cursor) {
      logger.info("No more pages (cursor exhausted)");
      break;
    }
  }

  logger.info(
    {
      username: kol.username,
      totalUpserted,
      oldest: oldestDate?.toISOString() ?? "N/A",
    },
    "Backfill complete",
  );

  return { totalUpserted, oldestDate };
}

export async function syncAllKols(): Promise<void> {
  const kols = await kolRepo.findActiveKols();
  logger.info({ count: kols.length }, "Starting sync for all active KOLs");

  let synced = 0;
  for (const kol of kols) {
    if (!kol.hasTwitter) {
      logger.info({ username: kol.username }, "Skipping non-Twitter KOL");
      continue;
    }

    if (!kol.algoEnabled) {
      logger.info({ username: kol.username }, "Algo disabled, skipping tweet fetch");
      continue;
    }

    try {
      logger.info({ username: kol.username }, "Syncing KOL");

      if (!kol.restId) {
        await syncKolProfile(kol.id);
        await delay(env.FETCH_DELAY_MS);
      }

      await syncKolTweets(kol.id);
      synced++;
      await delay(env.FETCH_DELAY_MS);
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.warn(
          {
            username: kol.username,
            synced,
            remaining: kols.length - synced,
            retryAfterMs: error.retryAfterMs,
          },
          "Rate limited, aborting batch",
        );
        return;
      }
      logger.error(
        {
          username: kol.username,
          error: error instanceof Error ? error.message : error,
        },
        "Failed to sync KOL, continuing with next",
      );
    }
  }

  logger.info({ synced }, "All KOLs synced");
}

export async function syncAllKolProfiles(): Promise<void> {
  const kols = await kolRepo.findActiveKols();
  logger.info(
    { count: kols.length },
    "Starting profile sync for all active KOLs",
  );

  let synced = 0;
  for (const kol of kols) {
    if (!kol.hasTwitter) {
      logger.info({ username: kol.username }, "Skipping non-Twitter KOL");
      continue;
    }

    try {
      await syncKolProfile(kol.id);
      synced++;

      // Update denormalized fields on KolVault
      const freshKol = await kolRepo.findKolById(kol.id);
      if (freshKol) {
        const vaultData: {
          kolUsername: string;
          avatarUrl?: string;
          name?: string;
          description?: string;
        } = {
          kolUsername: freshKol.username,
        };
        if (freshKol.avatarUrl) vaultData.avatarUrl = freshKol.avatarUrl;
        if (freshKol.displayName) vaultData.name = freshKol.displayName;
        if (freshKol.bio) vaultData.description = freshKol.bio;
        await kolVaultRepo.updateVaultProfile(kol.id, vaultData);
      }

      await delay(env.FETCH_DELAY_MS);
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.warn(
          {
            username: kol.username,
            synced,
            remaining: kols.length - synced,
            retryAfterMs: error.retryAfterMs,
          },
          "Rate limited during profile sync, aborting batch",
        );
        return;
      }
      logger.error(
        {
          username: kol.username,
          error: error instanceof Error ? error.message : error,
        },
        "Failed to sync KOL profile, continuing with next",
      );
    }
  }

  logger.info({ synced }, "All KOL profiles synced");
}
