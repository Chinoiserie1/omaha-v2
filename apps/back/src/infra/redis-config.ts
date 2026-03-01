import { env } from "../utils/env.js";

/**
 * Shared Redis connection config for BullMQ.
 * Using a plain config object avoids ioredis type conflicts
 * between BullMQ's bundled version and our direct dependency.
 */
export function getRedisConnectionConfig() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}
