import Fastify from "fastify";
import cors from "@fastify/cors";
import { userRoutes } from "./routes/users.js";

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

  return app;
}
