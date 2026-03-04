import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse, VaultFavoriteStatus } from "@repo/shared";
import * as favoriteRepo from "../../../store/vault-favorite.repository.js";

type ToggleFavoriteRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function toggleFavorite(
  request: ToggleFavoriteRequest,
  reply: FastifyReply,
) {
  const { id } = request.params;

  const user = await prisma.user.findUnique({
    where: { privyId: request.privyUserId },
  });

  if (!user) {
    return reply.status(404).send({
      success: false,
      error: "User not found",
    } satisfies ApiResponse<never>);
  }

  const existing = await favoriteRepo.findFavorite(user.id, id);

  if (existing) {
    await favoriteRepo.deleteFavorite(user.id, id);
    return {
      success: true,
      data: { isFavorited: false },
    } satisfies ApiResponse<VaultFavoriteStatus>;
  }

  await favoriteRepo.createFavorite(user.id, id);
  return {
    success: true,
    data: { isFavorited: true },
  } satisfies ApiResponse<VaultFavoriteStatus>;
}
