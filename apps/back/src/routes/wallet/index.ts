import type { FastifyInstance } from "fastify";
import { getBalances } from "./handlers/get-balances.js";
import { getPortfolio } from "./handlers/get-portfolio.js";
import { getPortfolioChart } from "./handlers/get-portfolio-chart.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/balances/:address", getBalances);
  app.get("/portfolio/:address", getPortfolio);
  app.get("/portfolio/:address/chart", getPortfolioChart);
}
