import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import {
  paginationSchema,
  type PaginatedResponse,
  type User,
  type ApiResponse,
} from "@repo/shared";

type ListRequest = FastifyRequest<{
  Querystring: { page?: string; pageSize?: string };
}>;

export async function listUsers(
  request: ListRequest,
  reply: FastifyReply
): Promise<PaginatedResponse<User> | ApiResponse<never>> {
  const paginationResult = paginationSchema.safeParse(request.query);

  if (!paginationResult.success) {
    return reply.status(400).send({
      success: false,
      error: paginationResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { page, pageSize } = paginationResult.data;
  const skip = (page - 1) * pageSize;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);

  return {
    items: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  } satisfies PaginatedResponse<User>;
}
