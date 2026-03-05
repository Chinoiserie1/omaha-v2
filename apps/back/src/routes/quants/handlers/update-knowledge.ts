import type { FastifyReply, FastifyRequest } from "fastify";
import { KolKnowledgeSchema } from "@repo/shared";
import * as quantRepo from "../../../store/quant.repository.js";

type UpdateKnowledgeRequest = FastifyRequest<{
  Params: { quantId: string };
}>;

export async function updateQuantKnowledge(
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

  const quant = await quantRepo.findQuantById(request.params.quantId);
  if (!quant) return reply.status(404).send({ success: false, error: "Quant not found" });

  const knowledge = parsed.data;
  if (knowledge.directAllocations && !knowledge.directAllocationsSetAt) {
    knowledge.directAllocationsSetAt = new Date().toISOString();
  }

  const updated = await quantRepo.updateQuantKnowledge(quant.id, knowledge);
  return { success: true, data: { id: updated.id, knowledge: updated.knowledge } };
}
