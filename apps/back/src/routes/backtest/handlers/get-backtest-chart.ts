import type { FastifyReply, FastifyRequest } from "fastify";
import * as quantRepo from "../../../store/quant.repository.js";
import { runBacktest } from "../../../services/backtest.service.js";

type GetBacktestChartRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function getBacktestChartHandler(
  request: GetBacktestChartRequest,
  reply: FastifyReply
) {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ success: false, error: "Quant not found" });
  }

  try {
    const backtest = await runBacktest(quant.id);
    const { periods } = backtest;

    const points =
      periods.length > 0
        ? [
            {
              timestamp: new Date(periods[0]!.fromDate).getTime(),
              value: 1.0,
            },
            ...periods.map((p) => ({
              timestamp: new Date(p.toDate).getTime(),
              value: p.cumulativeValue,
            })),
          ]
        : [];

    return {
      success: true,
      data: {
        points,
        totalReturn: backtest.totalReturn,
        latestCumulativeValue: backtest.latestCumulativeValue,
        snapshotCount: backtest.snapshotCount,
        startValue: 1.0,
        currentValue: backtest.latestCumulativeValue,
        percentChange: backtest.totalReturn * 100,
        periods,
      },
    };
  } catch (err) {
    request.log.error(
      { err, quantId: quant.id },
      "Backtest chart computation failed"
    );
    return {
      success: true,
      data: {
        points: [],
        totalReturn: 0,
        latestCumulativeValue: 1,
        snapshotCount: 0,
        startValue: 1.0,
        currentValue: 1.0,
        percentChange: 0,
        periods: [],
      },
    };
  }
}
