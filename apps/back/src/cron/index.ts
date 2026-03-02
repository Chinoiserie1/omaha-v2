import type { FastifyInstance } from "fastify";
import cron from "node-cron";
import { env } from "../utils/env.js";
import { alertOnError } from "../utils/alert.js";
import {
  startTelegramBot,
  stopTelegramBot,
} from "../services/telegram.service.js";
import { fetchTweets } from "./fetch-tweets.js";
import { runAlgo } from "./run-algo.js";
import { rebalanceVaults } from "./rebalance-vaults.js";
import { fetchPrices } from "./fetch-prices.js";
import { syncProfiles } from "./sync-profiles.js";
import { healthCheck } from "./health-check.js";
import { recoverWithdrawals } from "./recovery-withdrawals.js";
import { snapshotPortfolios } from "./snapshot-portfolios.js";

const tasks: cron.ScheduledTask[] = [];

export async function cronPlugin(app: FastifyInstance): Promise<void> {
  await startTelegramBot();

  tasks.push(
    cron.schedule(env.CRON_FETCH_TWEETS, () => {
      fetchTweets().catch((err) => alertOnError("cron:fetch-tweets", err));
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_RUN_ALGO, () => {
      runAlgo().catch((err) => alertOnError("cron:run-algo", err));
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_REBALANCE_VAULTS, () => {
      rebalanceVaults().catch((err) =>
        alertOnError("cron:rebalance-vaults", err),
      );
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_FETCH_PRICES, () => {
      fetchPrices().catch((err) => alertOnError("cron:fetch-prices", err));
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_SYNC_PROFILES, () => {
      syncProfiles().catch((err) => alertOnError("cron:sync-profiles", err));
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_HEALTH_CHECK, () => {
      healthCheck().catch((err) => alertOnError("cron:health-check", err));
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_RECOVERY_WITHDRAWALS, () => {
      recoverWithdrawals().catch((err) =>
        app.log.error(err, "recoverWithdrawals cron error"),
      );
    }),
  );

  tasks.push(
    cron.schedule(env.CRON_SNAPSHOT_PORTFOLIOS, () => {
      snapshotPortfolios().catch((err) =>
        alertOnError("cron:snapshot-portfolios", err),
      );
    }),
  );

  app.log.info("Cron jobs scheduled");

  app.addHook("onClose", async () => {
    for (const task of tasks) {
      task.stop();
    }
    await stopTelegramBot();
    app.log.info("Cron jobs stopped");
  });
}
