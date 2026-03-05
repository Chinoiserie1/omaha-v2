import type { FastifyReply, FastifyRequest } from "fastify";
import { syncAllQuantProfiles } from "../../../services/quant.service.js";

export async function syncProfilesHandler(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  await syncAllQuantProfiles();
  return { success: true, message: "Quant profiles synced" };
}
