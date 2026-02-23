import type { FastifyReply, FastifyRequest } from "fastify";
import type { Prisma } from "@repo/database";
import { z } from "zod";
import { AllocationSchema } from "@repo/shared";
import * as kolRepo from "../../../store/kol.repository.js";
import * as portfolioRepo from "../../../store/portfolio.repository.js";

type CreateSnapshotRequest = FastifyRequest<{
  Params: { kolId: string };
  Body: {
    thesisSummary: string;
    allocations: unknown[];
    changes: string[];
  };
}>;

export async function createSnapshot(
  request: CreateSnapshotRequest,
  reply: FastifyReply
) {
  const kol = await kolRepo.findKolById(request.params.kolId);
  if (!kol) return reply.status(404).send({ error: "KOL not found" });

  const parsed = z.array(AllocationSchema).safeParse(request.body.allocations);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

  const snapshot = await portfolioRepo.createSnapshot({
    kolId: kol.id,
    thesisSummary: request.body.thesisSummary,
    allocations: parsed.data as unknown as Prisma.InputJsonValue,
    changes: request.body.changes,
    sourceTweetIds: [],
  });

  return reply.status(201).send(snapshot);
}
