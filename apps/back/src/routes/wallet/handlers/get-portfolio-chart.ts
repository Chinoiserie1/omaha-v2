import type { FastifyReply, FastifyRequest } from "fastify";
import {
  walletAddressSchema,
  type ApiResponse,
  type PortfolioChartPeriod,
  type PortfolioChartResponse,
} from "@repo/shared";
import * as snapshotRepo from "../../../store/portfolio-snapshot.repository.js";
import { captureSnapshotIfChanged } from "../../../services/portfolio-snapshot.service.js";
import { logger } from "../../../utils/logger.js";

type ChartRequest = FastifyRequest<{
  Params: { address: string };
  Querystring: { period?: string; maxPoints?: string };
}>;

const PERIOD_MS: Record<PortfolioChartPeriod, number | null> = {
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

function isValidPeriod(value: string): value is PortfolioChartPeriod {
  return value in PERIOD_MS;
}

export async function getPortfolioChart(
  request: ChartRequest,
  reply: FastifyReply,
): Promise<ApiResponse<PortfolioChartResponse> | ApiResponse<never>> {
  const paramResult = walletAddressSchema.safeParse(request.params);

  if (!paramResult.success) {
    return reply.status(400).send({
      success: false,
      error: paramResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const address = paramResult.data.address;
  const rawPeriod = request.query.period ?? "7d";
  const period: PortfolioChartPeriod = isValidPeriod(rawPeriod)
    ? rawPeriod
    : "7d";

  const periodMs = PERIOD_MS[period];
  const since = periodMs ? new Date(Date.now() - periodMs) : new Date(0);
  const maxPoints =
    Number.parseInt(request.query.maxPoints ?? "", 10) || undefined;

  // Capture live on-chain snapshot (stores only if value changed)
  let liveValue: number | null = null;
  try {
    liveValue = await captureSnapshotIfChanged(address);
  } catch (err) {
    logger.warn({ err, address }, "Failed to fetch live portfolio for chart");
  }

  // Fetch stored history (includes the just-stored snapshot if value changed)
  const rows = await snapshotRepo.getChartHistory(address, since, maxPoints);

  const points = rows.map((r) => ({
    timestamp: r.snapshotDate.getTime(),
    value: r.totalValueUsd,
  }));

  // Append virtual "now" point if live value differs from last stored point
  if (liveValue !== null) {
    const lastStored = points.length > 0 ? points[points.length - 1]! : null;
    const alreadyCurrent =
      lastStored !== null &&
      Math.abs(Date.now() - lastStored.timestamp) < 60_000;

    if (!alreadyCurrent) {
      points.push({ timestamp: Date.now(), value: liveValue });
    }
  }

  const startValue = points.length > 0 ? points[0]!.value : null;
  const currentValue =
    liveValue ?? (points.length > 0 ? points[points.length - 1]!.value : null);

  const percentChange =
    startValue !== null && currentValue !== null && startValue > 0
      ? ((currentValue - startValue) / startValue) * 100
      : null;

  return {
    success: true,
    data: {
      period,
      points,
      currentValue,
      startValue,
      percentChange,
    },
  } satisfies ApiResponse<PortfolioChartResponse>;
}
