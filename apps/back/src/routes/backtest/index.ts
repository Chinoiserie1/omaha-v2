import type { FastifyInstance } from "fastify";
import { runBacktestHandler } from "./handlers/run-backtest.js";
import { getBacktestChartHandler } from "./handlers/get-backtest-chart.js";

export async function backtestRoutes(app: FastifyInstance) {
  app.get("/:kolId/backtest", runBacktestHandler);
  app.get("/:kolId/backtest/chart", getBacktestChartHandler);
}
