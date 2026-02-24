import type { FastifyInstance } from "fastify";
import { getBalances } from "./handlers/get-balances.js";
import { getPortfolio } from "./handlers/get-portfolio.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/balances/:address", getBalances);
  app.get("/portfolio/:address", getPortfolio);
}
