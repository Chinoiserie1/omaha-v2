import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiResponse } from "@repo/shared";
import * as vaultRepo from "../../../store/vault.repository.js";

type GetVaultRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function getVaultByQuantId(
  request: GetVaultRequest,
  reply: FastifyReply,
): Promise<ApiResponse<unknown>> {
  const vault = await vaultRepo.findByQuantId(request.params.quantId);

  if (!vault) {
    return reply.status(200).send({
      success: true,
      data: null,
    });
  }

  return {
    success: true,
    data: vault,
  };
}
