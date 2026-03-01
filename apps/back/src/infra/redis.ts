import { Redis } from "ioredis";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  return redis;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.connect();
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis");
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info("Redis disconnected");
  }
}

export function isRedisAvailable(): boolean {
  return redis?.status === "ready";
}
