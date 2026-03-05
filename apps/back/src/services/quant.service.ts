import type { Quant, Tweet } from "@repo/database";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";
import { delay } from "../utils/delay.js";
import { RateLimitError } from "../utils/errors.js";
import * as twitterService from "./twitter.service.js";
import * as quantRepo from "../store/quant.repository.js";
import * as tweetRepo from "../store/tweet.repository.js";
import type { TweetResult } from "@repo/shared";
import type { CreateTweetInput } from "../store/tweet.repository.js";

export function mapTweetResultToInput(
  tweet: TweetResult,
  quantId: string,
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
    quantId: quantId,
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

export async function syncQuantProfile(quantId: string): Promise<void> {
  const quant = await quantRepo.findQuantById(quantId);
  if (!quant) {
    logger.warn({ quantId }, "Quant not found");
    return;
  }

  if (!quant.user.twitterUsername) {
    logger.warn({ quantId }, "Quant user has no twitterUsername, skipping profile sync");
    return;
  }

  const user = await twitterService.fetchUserDetails(quant.user.twitterUsername);
  if (!user) {
    logger.warn({ username: quant.user.twitterUsername }, "Could not fetch user details");
    return;
  }

  const avatarUrl =
    user.avatar?.image_url ?? user.legacy.profile_image_url_https;

  await quantRepo.updateUserProfile(quant.userId, {
    twitterId: user.rest_id,
    ...(user.legacy.name !== undefined
      ? { name: user.legacy.name }
      : {}),
    ...(user.legacy.followers_count !== undefined
      ? { twitterFollowerCount: user.legacy.followers_count }
      : {}),
    ...(avatarUrl !== undefined ? { profileImageUrl: avatarUrl } : {}),
    ...(user.legacy.description !== undefined
      ? { bio: user.legacy.description }
      : {}),
  });

  logger.info(
    { username: quant.user.twitterUsername, restId: user.rest_id },
    "Quant profile synced",
  );
}

async function syncQuantThreads(
  quantId: string,
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
    { quantId, candidates: candidates.length, fetching: toFetch.length },
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
        const input = mapTweetResultToInput(tweet, quantId, { isThread: true });
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

export async function syncQuantTweets(quantId: string): Promise<number> {
  let quant = await quantRepo.findQuantById(quantId);
  if (!quant) {
    logger.warn({ quantId }, "Quant not found");
    return 0;
  }

  if (!quant.user.twitterId) {
    logger.warn(
      { username: quant.user.twitterUsername },
      "Quant has no restId, syncing profile first",
    );
    await syncQuantProfile(quantId);

    quant = await quantRepo.findQuantById(quantId);
    if (!quant?.user.twitterId) {
      logger.error(
        { quantId },
        "Could not resolve restId for Quant",
      );
      return 0;
    }
  }

  const freshQuant = quant;
  if (!freshQuant.user.twitterId) return 0;

  const { tweets } = await twitterService.fetchUserTweets(freshQuant.user.twitterId);
  logger.info(
    { username: freshQuant.user.twitterUsername, count: tweets.length },
    "Fetched tweets from API",
  );

  let newCount = 0;
  for (const tweet of tweets) {
    const input = mapTweetResultToInput(tweet, freshQuant.id);
    await tweetRepo.upsertTweet(input);
    newCount++;
  }

  // Fetch full threads for any detected thread starters
  const userIdStr = freshQuant.user.twitterId;
  const threadCount = await syncQuantThreads(freshQuant.id, tweets, userIdStr);

  await quantRepo.updateQuantLastFetched(freshQuant.id);

  logger.info(
    {
      username: freshQuant.user.twitterUsername,
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
): Promise<{ quant: Quant & { user: { twitterUsername: string | null } }; tweet: Tweet }> {
  const match = url.match(TWEET_URL_REGEX);
  if (!match) {
    throw new Error(
      "Invalid tweet URL. Expected format: https://x.com/username/status/123456",
    );
  }

  const username = match[1]!;
  const tweetId = match[2]!;

  // Find-or-create the Quant
  const quant = await quantRepo.upsertQuantByUsername(username);

  // Ensure Quant has a restId (needed for profile data)
  if (!quant.user.twitterId) {
    await syncQuantProfile(quant.id);
  }

  // Fetch tweet data from Twitter
  const tweetResults = await twitterService.fetchTweetDetail(tweetId);
  const target = tweetResults.find((t) => t.legacy.id_str === tweetId);
  if (!target) {
    throw new Error(`Tweet ${tweetId} not found on Twitter`);
  }

  const input = mapTweetResultToInput(target, quant.id);
  const tweet = await tweetRepo.upsertTweet(input);

  // Re-fetch Quant to get potentially updated profile
  const freshQuant = await quantRepo.findQuantById(quant.id);

  logger.info({ username, tweetId }, "Tweet added by URL");

  return { quant: freshQuant ?? quant, tweet };
}

export async function backfillQuantTweets(
  quantId: string,
  maxPages: number,
): Promise<{ totalUpserted: number; oldestDate: Date | null }> {
  let quant = await quantRepo.findQuantById(quantId);
  if (!quant) {
    throw new Error(`Quant "${quantId}" not found`);
  }

  if (!quant.user.twitterId) {
    await syncQuantProfile(quantId);
    quant = await quantRepo.findQuantById(quantId);
    if (!quant?.user.twitterId) {
      throw new Error(
        `Quant "${quantId}" has no restId and profile sync failed`,
      );
    }
  }

  const freshQuant = quant;
  if (!freshQuant.user.twitterId) {
    throw new Error(`Quant "${quantId}" has no restId after sync`);
  }

  logger.info(
    { username: freshQuant.user.twitterUsername, restId: freshQuant.user.twitterId, maxPages },
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
      freshQuant.user.twitterId,
      cursor ?? undefined,
    );

    if (result.tweets.length === 0) {
      logger.info({ page }, "No tweets returned, stopping backfill");
      break;
    }

    let pageUpserted = 0;
    for (const tweet of result.tweets) {
      const input = mapTweetResultToInput(tweet, freshQuant.id);
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
      username: freshQuant.user.twitterUsername,
      totalUpserted,
      oldest: oldestDate?.toISOString() ?? "N/A",
    },
    "Backfill complete",
  );

  return { totalUpserted, oldestDate };
}

export async function syncAllQuants(): Promise<void> {
  const quants = await quantRepo.findActiveQuants();
  logger.info({ count: quants.length }, "Starting sync for all active Quants");

  let synced = 0;
  for (const quant of quants) {
    if (!quant.user.hasTwitter) {
      logger.info({ username: quant.user.twitterUsername }, "Skipping non-Twitter Quant");
      continue;
    }

    if (!quant.algoEnabled) {
      logger.info({ username: quant.user.twitterUsername }, "Algo disabled, skipping tweet fetch");
      continue;
    }

    try {
      logger.info({ username: quant.user.twitterUsername }, "Syncing Quant");

      if (!quant.user.twitterId) {
        await syncQuantProfile(quant.id);
        await delay(env.FETCH_DELAY_MS);
      }

      await syncQuantTweets(quant.id);
      synced++;
      await delay(env.FETCH_DELAY_MS);
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.warn(
          {
            username: quant.user.twitterUsername,
            synced,
            remaining: quants.length - synced,
            retryAfterMs: error.retryAfterMs,
          },
          "Rate limited, aborting batch",
        );
        return;
      }
      logger.error(
        {
          username: quant.user.twitterUsername,
          error: error instanceof Error ? error.message : error,
        },
        "Failed to sync Quant, continuing with next",
      );
    }
  }

  logger.info({ synced }, "All Quants synced");
}

export async function syncAllQuantProfiles(): Promise<void> {
  const quants = await quantRepo.findActiveQuants();
  logger.info(
    { count: quants.length },
    "Starting profile sync for all active Quants",
  );

  let synced = 0;
  for (const quant of quants) {
    if (!quant.user.hasTwitter) {
      logger.info({ username: quant.user.twitterUsername }, "Skipping non-Twitter Quant");
      continue;
    }

    try {
      await syncQuantProfile(quant.id);
      synced++;

      await delay(env.FETCH_DELAY_MS);
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.warn(
          {
            username: quant.user.twitterUsername,
            synced,
            remaining: quants.length - synced,
            retryAfterMs: error.retryAfterMs,
          },
          "Rate limited during profile sync, aborting batch",
        );
        return;
      }
      logger.error(
        {
          username: quant.user.twitterUsername,
          error: error instanceof Error ? error.message : error,
        },
        "Failed to sync Quant profile, continuing with next",
      );
    }
  }

  logger.info({ synced }, "All Quant profiles synced");
}
