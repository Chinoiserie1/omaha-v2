import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";

type StatusRequest = FastifyRequest<{
  Querystring: { privyId: string };
}>;

interface OnboardingStatus {
  exists: boolean;
  onboardingCompleted: boolean;
}

export async function getOnboardingStatus(
  request: StatusRequest,
  reply: FastifyReply
): Promise<ApiResponse<OnboardingStatus>> {
  const { privyId } = request.query;

  if (!privyId) {
    return reply.status(400).send({
      success: false,
      error: "privyId query parameter is required",
    } satisfies ApiResponse<never>);
  }

  const user = await prisma.user.findUnique({
    where: { privyId },
    select: { onboardingCompleted: true },
  });

  return reply.send({
    success: true,
    data: {
      exists: !!user,
      onboardingCompleted: user?.onboardingCompleted ?? false,
    },
  } satisfies ApiResponse<OnboardingStatus>);
}
