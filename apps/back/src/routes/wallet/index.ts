import type { FastifyInstance } from "fastify";
import { getBalances } from "./handlers/get-balances.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/balances/:address", getBalances);
}
