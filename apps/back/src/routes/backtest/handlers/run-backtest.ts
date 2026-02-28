import type { FastifyReply, FastifyRequest } from "fastify";
import * as kolRepo from "../../../store/kol.repository.js";
import { runBacktest } from "../../../services/backtest.service.js";

type RunBacktestRequest = FastifyRequest<{
  Params: { kolId: string };
}>;

export async function runBacktestHandler(
  request: RunBacktestRequest,
  reply: FastifyReply
) {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) {
    return reply.status(404).send({ error: "KOL not found" });
  }

  try {
    const result = await runBacktest(kol.id);
    return result;
  } catch (err) {
    request.log.error({ err, kolId: kol.id }, "Backtest computation failed");
    return {
      kolId: kol.id,
      snapshotCount: 0,
      periods: [],
      totalReturn: 0,
      latestCumulativeValue: 1,
    };
  }
}
