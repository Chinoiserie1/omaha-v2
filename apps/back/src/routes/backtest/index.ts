import type { FastifyInstance } from "fastify";
import { runBacktestHandler } from "./handlers/run-backtest.js";

export async function backtestRoutes(app: FastifyInstance) {
  app.get("/:kolId/backtest", runBacktestHandler);
}
