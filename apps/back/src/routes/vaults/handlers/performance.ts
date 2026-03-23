import type { FastifyReply, FastifyRequest } from "fastify";
import * as vaultRepo from "../../../store/vault.repository.js";
import * as tokenPriceRepo from "../../../store/token-price.repository.js";
import type {
  VaultPerformancePeriod,
  VaultPerformanceResponse,
} from "@repo/shared";

type GetPerformanceRequest = FastifyRequest<{
  Params: { id: string };
  Querystring: { period?: string; maxPoints?: string };
}>;

const PERIOD_MS: Record<VaultPerformancePeriod, number | null> = {
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

function isValidPeriod(value: string): value is VaultPerformancePeriod {
  return value in PERIOD_MS;
}

export async function getVaultPerformance(
  request: GetPerformanceRequest,
  reply: FastifyReply,
) {
  const vault = await vaultRepo.findVaultById(request.params.id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  const shareMint = vault.shareToken?.mint;
  if (!shareMint) {
    return emptyResponse(reply, "7d");
  }

  const token = await tokenPriceRepo.findTokenByMint(shareMint);
  if (!token) {
    return emptyResponse(reply, "7d");
  }

  const rawPeriod = request.query.period ?? "7d";
  const period: VaultPerformancePeriod = isValidPeriod(rawPeriod)
    ? rawPeriod
    : "7d";

  const periodMs = PERIOD_MS[period];
  const since = periodMs ? new Date(Date.now() - periodMs) : new Date(0);

  const maxPoints = Number.parseInt(request.query.maxPoints ?? "", 10) || undefined;
  const rows = await tokenPriceRepo.getPriceHistory(token.id, since, maxPoints);

  const points = rows.map((r) => ({
    timestamp: r.date.getTime(),
    value: r.usdPrice,
  }));

  const startPrice = points.length > 0 ? points[0]!.value : null;
  const currentPrice = points.length > 0 ? points[points.length - 1]!.value : null;

  const percentChange =
    startPrice !== null && currentPrice !== null && startPrice > 0
      ? ((currentPrice - startPrice) / startPrice) * 100
      : null;

  const response: VaultPerformanceResponse = {
    period,
    points,
    currentPrice,
    startPrice,
    percentChange,
  };

  return response;
}

function emptyResponse(reply: FastifyReply, period: VaultPerformancePeriod) {
  const response: VaultPerformanceResponse = {
    period,
    points: [],
    currentPrice: null,
    startPrice: null,
    percentChange: null,
  };
  return reply.send(response);
}
