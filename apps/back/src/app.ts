import Fastify from "fastify";
import cors from "@fastify/cors";
import { userRoutes } from "./routes/users/index.js";
import { onboardingRoutes } from "./routes/onboarding/index.js";
import { quantRoutes } from "./routes/quants/index.js";
import { tweetRoutes, quantTweetRoutes } from "./routes/tweets/index.js";
import { portfolioRoutes } from "./routes/portfolio/index.js";
import { backtestRoutes } from "./routes/backtest/index.js";
import { vaultRoutes } from "./routes/vaults/index.js";
import { profileRoutes } from "./routes/profile/index.js";
import { followRoutes } from "./routes/follows/index.js";
import { walletRoutes } from "./routes/wallet/index.js";
import { contentRoutes } from "./routes/content/index.js";
import { withdrawalRoutes } from "./routes/withdrawals/index.js";
import { swapRoutes } from "./routes/swap/index.js";
import { exploreRoutes } from "./routes/explore/index.js";
import { cronPlugin } from "./cron/index.js";
import { registerWebSocket } from "./infra/websocket.js";
import { connectRedis, closeRedis } from "./infra/redis.js";
import {
  startWithdrawalWorker,
  stopWithdrawalWorker,
} from "./queue/withdrawal-worker.js";
import { closeWithdrawalQueue } from "./queue/withdrawal-queue.js";
export async function buildApp() {
  const app = Fastify({
    logger: { level: "info" },
  });

  await app.register(cors, {
    origin: true,
  });

  app.decorateRequest("privyUserId", "");

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Existing routes
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(onboardingRoutes, { prefix: "/api/onboarding" });

  // Quant pipeline routes
  await app.register(quantRoutes, { prefix: "/api/quants" });
  await app.register(tweetRoutes, { prefix: "/api/tweets" });
  await app.register(quantTweetRoutes, { prefix: "/api/quants" });
  await app.register(portfolioRoutes, { prefix: "/api/quants" });
  await app.register(backtestRoutes, { prefix: "/api/quants" });

  // Content ingestion
  await app.register(contentRoutes, { prefix: "/api/content" });

  // Vault routes
  await app.register(vaultRoutes, { prefix: "/api/vaults" });

  // Profile & Follow routes
  await app.register(profileRoutes, { prefix: "/api/profile" });
  await app.register(followRoutes, { prefix: "/api/follows" });

  // Wallet routes
  await app.register(walletRoutes, { prefix: "/api/wallet" });

  // Swap routes
  await app.register(swapRoutes, { prefix: "/api/swap" });

  // Explore routes
  await app.register(exploreRoutes, { prefix: "/api/explore" });

  // Withdrawal routes (queued)
  await app.register(withdrawalRoutes, { prefix: "/api/withdrawals" });

  // WebSocket for real-time withdrawal updates
  await registerWebSocket(app);

  // Redis + BullMQ withdrawal worker
  const redisConnected = await connectRedis();
  if (redisConnected) {
    startWithdrawalWorker();
  } else {
    app.log.warn("Redis not available — withdrawal worker not started");
  }

  // Cron jobs
  await app.register(cronPlugin);

  // Graceful shutdown
  app.addHook("onClose", async () => {
    await stopWithdrawalWorker();
    await closeWithdrawalQueue();
    await closeRedis();
  });

  return app;
}
