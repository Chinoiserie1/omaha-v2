import type { FastifyReply, FastifyRequest } from "fastify";
import * as quantRepo from "../../../store/quant.repository.js";
import { runBacktest } from "../../../services/backtest.service.js";

type RunBacktestRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function runBacktestHandler(
  request: RunBacktestRequest,
  reply: FastifyReply
) {
  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) {
    return reply.status(404).send({ error: "Quant not found" });
  }

  try {
    const result = await runBacktest(quant.id);
    return result;
  } catch (err) {
    request.log.error({ err, quantId: quant.id }, "Backtest computation failed");
    return {
      quantId: quant.id,
      snapshotCount: 0,
      periods: [],
      totalReturn: 0,
      latestCumulativeValue: 1,
    };
  }
}
