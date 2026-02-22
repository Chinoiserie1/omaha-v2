import Fastify from "fastify";
import cors from "@fastify/cors";
import { userRoutes } from "./routes/users/index.js";
import { onboardingRoutes } from "./routes/onboarding/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "development" ? "debug" : "info",
    },
  });

  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(onboardingRoutes, { prefix: "/api/onboarding" });

  return app;
}
