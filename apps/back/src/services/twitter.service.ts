import axios from "axios";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { RateLimitError } from "../utils/errors.js";
import {
  UserDetailsResponseSchema,
  TweetResultSchema,
  type TwitterUser,
  type TweetResult,
} from "@repo/shared";

const apiClient = axios.create({
  baseURL: `https://${env.RAPIDAPI_HOST}`,
  headers: {
    "x-rapidapi-key": env.RAPIDAPI_KEY,
    "x-rapidapi-host": env.RAPIDAPI_HOST,
  },
});

export async function fetchUserDetails(
  username: string,
): Promise<TwitterUser | null> {
  try {
    const response = await apiClient.get("/user", {
      params: { username },
    });

    const parsed = UserDetailsResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      logger.warn(
        { username, errors: parsed.error.issues },
        "Failed to parse user details response",
      );
      return null;
    }

    return parsed.data.result.data.user.result;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new RateLimitError(
        429,
        error.response.headers["retry-after"] ?? null,
      );
    }
    logger.error(
      {
        username,
        ...(axios.isAxiosError(error)
          ? {
              statusCode: error.response?.status,
              url: error.config?.url,
              method: error.config?.method,
            }
          : { error: error instanceof Error ? error.message : error }),
      },
      "Failed to fetch user details",
    );
    throw error;
  }
}

function extractTweetsFromResponse(data: unknown): TweetResult[] {
  const tweets: TweetResult[] = [];
  const timeline = (data as Record<string, unknown>)?.["result"] as
    | Record<string, unknown>
    | undefined;
  const instructions = (
    timeline?.["timeline"] as Record<string, unknown> | undefined
  )?.["instructions"] as unknown[] | undefined;

  if (!Array.isArray(instructions)) return tweets;

  for (const instruction of instructions) {
    const instr = instruction as Record<string, unknown>;

    // Handle pinned tweet
    const pinnedEntry = instr["entry"] as Record<string, unknown> | undefined;
    if (pinnedEntry) {
      const content = pinnedEntry["content"] as
        | Record<string, unknown>
        | undefined;
      const itemContent = content?.["itemContent"] as
        | Record<string, unknown>
        | undefined;
      const tweetResults = itemContent?.["tweet_results"] as
        | Record<string, unknown>
        | undefined;
      if (tweetResults?.["result"]) {
        const parsed = TweetResultSchema.safeParse(tweetResults["result"]);
        if (parsed.success) tweets.push(parsed.data);
      }
    }

    // Handle normal entries
    const entries = instr["entries"] as unknown[] | undefined;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const e = entry as Record<string, unknown>;
        const content = e["content"] as Record<string, unknown> | undefined;
        const itemContent = content?.["itemContent"] as
          | Record<string, unknown>
          | undefined;
        const tweetResults = itemContent?.["tweet_results"] as
          | Record<string, unknown>
          | undefined;
        if (tweetResults?.["result"]) {
          const parsed = TweetResultSchema.safeParse(tweetResults["result"]);
          if (parsed.success) {
            tweets.push(parsed.data);
          } else {
            logger.debug(
              { errors: parsed.error.issues },
              "Skipping malformed tweet entry",
            );
          }
        }
      }
    }
  }

  return tweets;
}

export async function fetchUserTweets(restId: string): Promise<TweetResult[]> {
  try {
    const response = await apiClient.get("/user-tweets", {
      params: { user: restId, count: "40" },
    });

    return extractTweetsFromResponse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new RateLimitError(
        429,
        error.response.headers["retry-after"] ?? null,
      );
    }
    logger.error(
      {
        restId,
        ...(axios.isAxiosError(error)
          ? {
              statusCode: error.response?.status,
              url: error.config?.url,
              method: error.config?.method,
            }
          : { error: error instanceof Error ? error.message : error }),
      },
      "Failed to fetch user tweets",
    );
    throw error;
  }
}

function extractTweetsFromDetailResponse(data: unknown): TweetResult[] {
  const tweets: TweetResult[] = [];
  const result = (data as Record<string, unknown>)?.["result"] as
    | Record<string, unknown>
    | undefined;
  const instructions = (
    result?.["timeline"] as Record<string, unknown> | undefined
  )?.["instructions"] as unknown[] | undefined;

  if (!Array.isArray(instructions)) return tweets;

  for (const instruction of instructions) {
    const instr = instruction as Record<string, unknown>;
    const entries = instr["entries"] as unknown[] | undefined;
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      const e = entry as Record<string, unknown>;
      const content = e["content"] as Record<string, unknown> | undefined;

      // tweet-detail returns items inside a "items" array for conversation threads
      const items = content?.["items"] as unknown[] | undefined;
      if (Array.isArray(items)) {
        for (const item of items) {
          const itemObj = item as Record<string, unknown>;
          const itemContent = (
            itemObj["item"] as Record<string, unknown> | undefined
          )?.["itemContent"] as Record<string, unknown> | undefined;
          const tweetResults = itemContent?.["tweet_results"] as
            | Record<string, unknown>
            | undefined;
          if (tweetResults?.["result"]) {
            const parsed = TweetResultSchema.safeParse(tweetResults["result"]);
            if (parsed.success) tweets.push(parsed.data);
          }
        }
      }

      // Also check direct itemContent (focal tweet)
      const itemContent = content?.["itemContent"] as
        | Record<string, unknown>
        | undefined;
      const tweetResults = itemContent?.["tweet_results"] as
        | Record<string, unknown>
        | undefined;
      if (tweetResults?.["result"]) {
        const parsed = TweetResultSchema.safeParse(tweetResults["result"]);
        if (parsed.success) tweets.push(parsed.data);
      }
    }
  }

  return tweets;
}

export async function fetchTweetDetail(
  tweetId: string,
): Promise<TweetResult[]> {
  try {
    const response = await apiClient.get("/tweet-detail", {
      params: { pid: tweetId },
    });

    return extractTweetsFromDetailResponse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new RateLimitError(
        429,
        error.response.headers["retry-after"] ?? null,
      );
    }
    logger.error(
      {
        tweetId,
        ...(axios.isAxiosError(error)
          ? {
              statusCode: error.response?.status,
              url: error.config?.url,
              method: error.config?.method,
            }
          : { error: error instanceof Error ? error.message : error }),
      },
      "Failed to fetch tweet detail",
    );
    throw error;
  }
}
