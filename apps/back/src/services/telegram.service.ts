import { Bot } from "grammy";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

const DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const recentAlerts = new Map<string, number>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let botInstance: Bot | null = null;

function getBot(): Bot | null {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  if (!botInstance) botInstance = new Bot(env.TELEGRAM_BOT_TOKEN);
  return botInstance;
}

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentAlerts) {
      if (now - timestamp > DEDUP_WINDOW_MS) recentAlerts.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

function isDuplicate(dedupKey: string): boolean {
  const lastSent = recentAlerts.get(dedupKey);
  if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) return true;
  recentAlerts.set(dedupKey, Date.now());
  return false;
}

export async function sendTelegramAlert(
  message: string,
  dedupKey?: string,
): Promise<void> {
  const bot = getBot();
  if (!bot || !env.TELEGRAM_CHAT_ID) return;

  if (dedupKey && isDuplicate(dedupKey)) {
    logger.debug({ dedupKey }, "Telegram alert suppressed (duplicate)");
    return;
  }

  startCleanup();

  try {
    await bot.api.sendMessage(env.TELEGRAM_CHAT_ID, message, {
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.warn(
      { err: error },
      "Failed to send Telegram alert — continuing without notification",
    );
  }
}

export async function startTelegramBot(): Promise<void> {
  const bot = getBot();
  if (!bot || !env.TELEGRAM_CHAT_ID) {
    logger.info("Telegram bot disabled — missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  // Lazy import to avoid circular dependency at module load
  const { runProbes } = await import("./health-monitor.service.js");

  const { fetchRapidApiQuota } = await import("./twitter.service.js");

  bot.command("credits", async (ctx) => {
    try {
      await ctx.reply("Checking RapidAPI credits...");
      const quota = await fetchRapidApiQuota();

      const remainingNum = parseInt(quota.remaining, 10);
      const limitNum = parseInt(quota.limit, 10);
      let progressBar = "";
      let pct = "";

      if (!isNaN(remainingNum) && !isNaN(limitNum) && limitNum > 0) {
        const usedPct = ((limitNum - remainingNum) / limitNum) * 100;
        const filled = Math.round(usedPct / 6.67); // 15 chars total
        progressBar = "\u2588".repeat(filled) + "\u2591".repeat(15 - filled);
        pct = `${Math.round(usedPct)}%`;
      }

      const lines = [
        "\u{1F4CA} <b>RapidAPI Credits</b>",
        "",
        `<b>Remaining:</b> ${quota.remaining} / ${quota.limit}`,
        `<b>Used:</b> ${quota.used}`,
      ];

      if (progressBar) {
        lines.push(`<b>Usage:</b> ${progressBar} ${pct}`);
      }

      lines.push("", `<b>Time:</b> ${new Date().toISOString()}`);

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    } catch (error) {
      logger.error({ err: error }, "Error handling /credits command");
      await ctx.reply("Failed to fetch RapidAPI credits. Check server logs.");
    }
  });

  bot.command("health", async (ctx) => {
    try {
      await ctx.reply("Running health checks...");
      const results = await runProbes();
      const failures = results.filter((r) => !r.ok);

      const lines = results.map((r) => {
        const icon = r.ok ? "\u2705" : "\u274C";
        const detail = r.ok ? `OK (${r.durationMs}ms)` : `${r.error} (${r.durationMs}ms)`;
        return `${icon} <b>${r.name}</b>: ${detail}`;
      });

      const header = failures.length === 0
        ? "\u2705 <b>ALL SYSTEMS HEALTHY</b>"
        : `\u{1F534} <b>${failures.length}/${results.length} APIs DOWN</b>`;

      await ctx.reply([header, "", ...lines, "", `<b>Time:</b> ${new Date().toISOString()}`].join("\n"), {
        parse_mode: "HTML",
      });
    } catch (error) {
      logger.error({ err: error }, "Error handling /health command");
      await ctx.reply("Failed to run health check. Check server logs.");
    }
  });

  bot.start({
    onStart: () => logger.info("Telegram bot started — listening for commands"),
    drop_pending_updates: true,
  }).catch((err) => {
    logger.error({ err }, "Telegram bot polling failed — bot commands unavailable, alerts still work");
  });
}

export async function stopTelegramBot(): Promise<void> {
  if (botInstance) {
    await botInstance.stop();
    logger.info("Telegram bot stopped");
  }
}
