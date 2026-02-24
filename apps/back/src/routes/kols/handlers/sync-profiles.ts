import type { FastifyReply, FastifyRequest } from "fastify";
import { syncAllKolProfiles } from "../../../services/kol.service.js";

export async function syncProfilesHandler(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  await syncAllKolProfiles();
  return { success: true, message: "KOL profiles synced" };
}
