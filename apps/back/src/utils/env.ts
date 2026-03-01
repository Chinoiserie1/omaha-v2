import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Auth
  PRIVY_APP_SECRET: z.string().optional(),

  // KOL Pipeline — Twitter
  RAPIDAPI_KEY: z.string().min(1),
  RAPIDAPI_HOST: z.string().default("twitter241.p.rapidapi.com"),
  FETCH_DELAY_MS: z.coerce.number().default(1500),

  // KOL Pipeline — AI
  ANTHROPIC_API_KEY: z.string().min(1),

  // KOL Pipeline — Jupiter
  JUPITER_API_KEY: z.string().min(1),

  // KOL Pipeline — Birdeye (price data)
  BIRDEYE_API_KEY: z.string().min(1),

  // KOL Pipeline — Solana (optional — crons work without these)
  SOLANA_RPC_URL: z.string().optional(),
  KEEPER_PRIVATE_KEY: z.string().optional(),
  GLAM_PROGRAM_ID: z
    .string()
    .default("GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"),

  // KOL Pipeline — Rebalancing
  REBALANCE_DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((v: string) => v === "true"),
  MAX_PRICE_IMPACT_BPS: z.coerce.number().default(100),
  MIN_SWAP_USD: z.coerce.number().default(5),
  MAX_SWAP_EQUITY_PCT: z.coerce.number().default(25),
  SNAPSHOT_STALENESS_H: z.coerce.number().default(24),

  // KOL Pipeline — Cron schedules
  CRON_FETCH_TWEETS: z.string().default("*/15 * * * *"),
  CRON_RUN_ALGO: z.string().default("*/30 * * * *"),
  CRON_REBALANCE_VAULTS: z.string().default("0 */6 * * *"),

  // KOL Pipeline — Profile sync
  CRON_SYNC_PROFILES: z.string().default("0 3 * * 0"),

  // Token prices — Cron schedule
  CRON_FETCH_PRICES: z.string().default("* * * * *"),

  // Health monitor — Telegram alerts
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  CRON_HEALTH_CHECK: z.string().default("0 */6 * * *"),

  // Withdrawal queue
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WITHDRAWAL_BATCH_WINDOW_MS: z.coerce.number().default(600_000), // 10 min
  WITHDRAWAL_MAX_RETRIES: z.coerce.number().default(3),
  CRON_RECOVERY_WITHDRAWALS: z.string().default("*/5 * * * *"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map(
        (issue: { path: (string | number)[]; message: string }) =>
          `  ${issue.path.join(".")}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }

  return parsed.data;
}

export const env = validateEnv();
