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

  const result = await runBacktest(kol.id);
  return result;
}
