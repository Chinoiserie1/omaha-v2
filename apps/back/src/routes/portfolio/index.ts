import type { FastifyInstance } from "fastify";
import { getLatestPortfolio } from "./handlers/get-latest.js";
import { getPortfolioHistory } from "./handlers/get-history.js";
import { createSnapshot } from "./handlers/create-snapshot.js";

export async function portfolioRoutes(app: FastifyInstance) {
  app.get("/:kolId/portfolio", getLatestPortfolio);
  app.get("/:kolId/portfolio/history", getPortfolioHistory);
  app.post("/:kolId/portfolio", createSnapshot);
}
