import { z } from "zod";
import { logger } from "./logger.js";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Auth
  PRIVY_APP_SECRET: z.string().optional(),

  // Quant Pipeline — Twitter
  RAPIDAPI_KEY: z.string().min(1),
  RAPIDAPI_HOST: z.string().default("twitter241.p.rapidapi.com"),
  FETCH_DELAY_MS: z.coerce.number().default(1500),

  // Quant Pipeline — AI
  ANTHROPIC_API_KEY: z.string().min(1),

  // Quant Pipeline — Jupiter
  JUPITER_API_KEY: z.string().min(1),

  // Quant Pipeline — Birdeye (price data)
  BIRDEYE_API_KEY: z.string().min(1),

  // Quant Pipeline — Solana (optional — crons work without these)
  SOLANA_RPC_URL: z.string().optional(),
  KEEPER_PRIVATE_KEY: z.string().optional(),
  FEE_PAYER_PRIVATE_KEY: z.string().optional(),
  FUND_SOL_FEE_PCT: z.coerce.number().default(2),
  GLAM_PROGRAM_ID: z
    .string()
    .default("GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"),

  // Quant Pipeline — Rebalancing
  REBALANCE_DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((v: string) => v === "true"),
  MAX_PRICE_IMPACT_BPS: z.coerce.number().default(100),
  MIN_SWAP_USD: z.coerce.number().default(0.1),
  MAX_SWAP_EQUITY_PCT: z.coerce.number().default(25),
  SNAPSHOT_STALENESS_H: z.coerce.number().default(24),

  // Quant Pipeline — Cron schedules
  CRON_FETCH_TWEETS: z.string().default("*/15 * * * *"),
  CRON_RUN_ALGO: z.string().default("*/30 * * * *"),
  CRON_REBALANCE_VAULTS: z.string().default("0 */6 * * *"),

  // Quant Pipeline — Profile sync
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

  // Portfolio snapshots (weekly safety-net)
  CRON_SNAPSHOT_PORTFOLIOS: z.string().default("0 0 * * 0"),
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

function findDefault(def: Record<string, unknown>): (() => unknown) | null {
  if (def["typeName"] === "ZodDefault" && typeof def["defaultValue"] === "function") {
    return def["defaultValue"] as () => unknown;
  }
  const inner = def["innerType"] as { _def?: unknown } | undefined;
  if (inner && typeof inner._def === "object") {
    return findDefault(inner._def as Record<string, unknown>);
  }
  return null;
}

function logMissingEnvVars(): void {
  for (const key of Object.keys(envSchema.shape)) {
    if (process.env[key] !== undefined) continue;

    const field = envSchema.shape[key as keyof typeof envSchema.shape];
    const isOptional = field.isOptional();
    const getDefault = findDefault(field._def as unknown as Record<string, unknown>);

    if (!isOptional && !getDefault) continue; // required — Zod already throws

    if (getDefault) {
      logger.info(`ENV ${key} is not set (using default: ${getDefault()})`);
    } else {
      logger.info(`ENV ${key} is not set`);
    }
  }
}

export const env = validateEnv();
logMissingEnvVars();
