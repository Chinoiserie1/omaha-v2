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
 * Finds tweets that are thread starters — where conversation_id matches
 * the tweet's own id and the tweet has self-replies in the batch.
 */
function detectThreadStarters(
  tweets: TweetResult[],
  userIdStr: string,
): TweetResult[] {
  // Collect all conversation IDs that have self-replies
  const conversationsWithSelfReplies = new Set<string>();
  for (const tweet of tweets) {
    if (
      tweet.legacy.in_reply_to_status_id_str &&
      tweet.legacy.user_id_str === userIdStr &&
      tweet.legacy.conversation_id_str
    ) {
      conversationsWithSelfReplies.add(tweet.legacy.conversation_id_str);
    }
  }

  // Thread starters: own tweet where conversation_id === id_str and has self-replies
  return tweets.filter(
    (t) =>
      t.legacy.conversation_id_str === t.legacy.id_str &&
      conversationsWithSelfReplies.has(t.legacy.id_str),
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

  console.log("user", user);
  console.log("user.legacy", user.legacy);
  console.log("user.legacy.name", user.legacy.name);
  console.log("user.legacy.followers_count", user.legacy.followers_count);
  console.log(
    "user.legacy.profile_image_url_https",
    user.legacy.profile_image_url_https,
  );
  console.log("user.legacy.description", user.legacy.description);

  await kolRepo.updateKolProfile(kolId, {
    restId: user.rest_id,
    ...(user.legacy.name !== undefined
      ? { displayName: user.legacy.name }
      : {}),
    ...(user.legacy.followers_count !== undefined
      ? { followersCount: user.legacy.followers_count }
      : {}),
    ...(user.legacy.profile_image_url_https !== undefined
      ? { avatarUrl: user.legacy.profile_image_url_https }
      : {}),
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
  const threadStarters = detectThreadStarters(tweets, userIdStr);
  if (threadStarters.length === 0) return 0;

  logger.info(
    { kolId, threadCount: threadStarters.length },
    "Detected threads, fetching details",
  );

  let threadTweetCount = 0;

  for (const starter of threadStarters) {
    try {
      await delay(env.FETCH_DELAY_MS);
      const threadTweets = await twitterService.fetchTweetDetail(
        starter.legacy.id_str,
      );

      // Filter to only tweets by the same user (the thread author)
      const selfTweets = threadTweets.filter(
        (t) => t.legacy.user_id_str === userIdStr,
      );

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

  const tweets = await twitterService.fetchUserTweets(freshKol.restId);
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

export async function syncAllKols(): Promise<void> {
  const kols = await kolRepo.findActiveKols();
  logger.info({ count: kols.length }, "Starting sync for all active KOLs");

  let synced = 0;
  for (const kol of kols) {
    if (!kol.hasTwitter) {
      logger.info({ username: kol.username }, "Skipping non-Twitter KOL");
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
