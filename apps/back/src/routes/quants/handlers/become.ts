import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse } from "@repo/shared";

type BecomeQuantResponse = { quantId: string };

export async function becomeQuant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiResponse<BecomeQuantResponse> | ApiResponse<never>> {
  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
    include: { quant: { select: { id: true } } },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  if (user.quant) {
    return reply.status(409).send({
      success: false,
      error: "User is already a Quant",
      data: { quantId: user.quant.id },
    } as ApiResponse<BecomeQuantResponse>);
  }

  const quant = await prisma.quant.create({
    data: {
      userId: user.id,
      isActive: false,
      algoEnabled: false,
    },
  });

  return reply.status(201).send({
    success: true,
    data: { quantId: quant.id },
  } satisfies ApiResponse<BecomeQuantResponse>);
}
