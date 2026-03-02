import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import type { ApiResponse, VaultFavoriteStatus } from "@repo/shared";
import * as favoriteRepo from "../../../store/vault-favorite.repository.js";

type FavoriteStatusRequest = FastifyRequest<{
  Params: { id: string };
}>;

export async function getFavoriteStatus(
  request: FavoriteStatusRequest,
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

  const favorite = await favoriteRepo.findFavorite(user.id, id);

  return {
    success: true,
    data: { isFavorited: !!favorite },
  } satisfies ApiResponse<VaultFavoriteStatus>;
}
