import type { FastifyInstance } from "fastify";
import cron from "node-cron";
import { env } from "../utils/env.js";
import { fetchTweets } from "./fetch-tweets.js";
import { runAlgo } from "./run-algo.js";
import { rebalanceVaults } from "./rebalance-vaults.js";
import { fetchPrices } from "./fetch-prices.js";

const tasks: cron.ScheduledTask[] = [];

export async function cronPlugin(app: FastifyInstance): Promise<void> {
  tasks.push(
    cron.schedule(env.CRON_FETCH_TWEETS, () => {
      fetchTweets().catch((err) => app.log.error(err, "fetchTweets cron error"));
    })
  );

  tasks.push(
    cron.schedule(env.CRON_RUN_ALGO, () => {
      runAlgo().catch((err) => app.log.error(err, "runAlgo cron error"));
    })
  );

  tasks.push(
    cron.schedule(env.CRON_REBALANCE_VAULTS, () => {
      rebalanceVaults().catch((err) => app.log.error(err, "rebalanceVaults cron error"));
    })
  );

  tasks.push(
    cron.schedule(env.CRON_FETCH_PRICES, () => {
      fetchPrices().catch((err) => app.log.error(err, "fetchPrices cron error"));
    })
  );

  app.log.info("Cron jobs scheduled");

  app.addHook("onClose", async () => {
    for (const task of tasks) {
      task.stop();
    }
    app.log.info("Cron jobs stopped");
  });
}
