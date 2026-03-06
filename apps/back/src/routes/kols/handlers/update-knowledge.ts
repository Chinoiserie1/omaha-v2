import type { FastifyReply, FastifyRequest } from "fastify";
import { KolKnowledgeSchema } from "@repo/shared";
import * as kolRepo from "../../../store/kol.repository.js";

type UpdateKnowledgeRequest = FastifyRequest<{
  Params: { kolId: string };
}>;

export async function updateKolKnowledge(
  request: UpdateKnowledgeRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const parsed = KolKnowledgeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) return reply.status(404).send({ success: false, error: "KOL not found" });

  const updated = await kolRepo.updateKolKnowledge(kol.id, parsed.data);
  return { success: true, data: { id: updated.id, username: updated.username, knowledge: updated.knowledge } };
}
