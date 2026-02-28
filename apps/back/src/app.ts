import Fastify from "fastify";
import cors from "@fastify/cors";
import { userRoutes } from "./routes/users/index.js";
import { onboardingRoutes } from "./routes/onboarding/index.js";
import { kolRoutes } from "./routes/kols/index.js";
import { tweetRoutes, kolTweetRoutes } from "./routes/tweets/index.js";
import { portfolioRoutes } from "./routes/portfolio/index.js";
import { backtestRoutes } from "./routes/backtest/index.js";
import { vaultRoutes } from "./routes/vaults/index.js";
import { profileRoutes } from "./routes/profile/index.js";
import { followRoutes } from "./routes/follows/index.js";
import { walletRoutes } from "./routes/wallet/index.js";
import { contentRoutes } from "./routes/content/index.js";
import { cronPlugin } from "./cron/index.js";
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

  // KOL pipeline routes
  await app.register(kolRoutes, { prefix: "/api/kols" });
  await app.register(tweetRoutes, { prefix: "/api/tweets" });
  await app.register(kolTweetRoutes, { prefix: "/api/kols" });
  await app.register(portfolioRoutes, { prefix: "/api/kols" });
  await app.register(backtestRoutes, { prefix: "/api/kols" });

  // Content ingestion
  await app.register(contentRoutes, { prefix: "/api/content" });

  // Vault routes
  await app.register(vaultRoutes, { prefix: "/api/vaults" });

  // Profile & Follow routes
  await app.register(profileRoutes, { prefix: "/api/profile" });
  await app.register(followRoutes, { prefix: "/api/follows" });

  // Wallet routes
  await app.register(walletRoutes, { prefix: "/api/wallet" });

  // Cron jobs
  await app.register(cronPlugin);

  return app;
}
