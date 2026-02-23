import Fastify from "fastify";
import cors from "@fastify/cors";
import { userRoutes } from "./routes/users/index.js";
import { onboardingRoutes } from "./routes/onboarding/index.js";
import { kolRoutes } from "./routes/kols/index.js";
import { tweetRoutes, kolTweetRoutes } from "./routes/tweets/index.js";
import { portfolioRoutes } from "./routes/portfolio/index.js";
import { vaultRoutes } from "./routes/vaults/index.js";
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

  // Vault routes
  await app.register(vaultRoutes, { prefix: "/api/vaults" });

  // Cron jobs
  await app.register(cronPlugin);

  return app;
}
