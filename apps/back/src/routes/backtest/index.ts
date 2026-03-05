import type { FastifyInstance } from "fastify";
import { runBacktestHandler } from "./handlers/run-backtest.js";
import { getBacktestChartHandler } from "./handlers/get-backtest-chart.js";

export async function backtestRoutes(app: FastifyInstance) {
  app.get("/:quantId/backtest", runBacktestHandler);
  app.get("/:quantId/backtest/chart", getBacktestChartHandler);
}
