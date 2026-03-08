import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiResponse } from "@repo/shared";
import { getRedis, isRedisAvailable } from "../../../infra/redis.js";

type SetupStatus =
  | "pending"
  | "syncing_profile"
  | "fetching_tweets"
  | "classifying"
  | "synthesizing"
  | "complete"
  | "failed";

interface SetupStatusResponse {
  status: SetupStatus;
  error?: string;
}

type SetupStatusRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function getSetupStatus(
  request: SetupStatusRequest,
  reply: FastifyReply,
): Promise<ApiResponse<SetupStatusResponse>> {
  const { quantId } = request.params;

  if (!isRedisAvailable()) {
    return reply.status(503).send({
      success: false,
      error: "Status tracking unavailable",
    } satisfies ApiResponse<never>);
  }

  const redis = getRedis();
  const data = await redis.hgetall(`quant:setup:${quantId}`);

  if (!data || !data["status"]) {
    return {
      success: true,
      data: { status: "complete" as SetupStatus },
    };
  }

  const response: SetupStatusResponse = {
    status: data["status"] as SetupStatus,
  };

  if (data["error"]) {
    response.error = data["error"];
  }

  return { success: true, data: response };
}
