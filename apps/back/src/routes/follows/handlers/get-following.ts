import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { followListQuerySchema, type ApiResponse, type PaginatedResponse, type FollowerUser } from "@repo/shared";

type FollowingRequest = FastifyRequest<{ Querystring: { userId: string; page?: string; pageSize?: string } }>;

export async function getFollowing(
  request: FollowingRequest,
  reply: FastifyReply
): Promise<ApiResponse<PaginatedResponse<FollowerUser>> | ApiResponse<never>> {
  const queryResult = followListQuerySchema.safeParse(request.query);

  if (!queryResult.success) {
    return reply.status(400).send({
      success: false,
      error: queryResult.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { userId, page, pageSize } = queryResult.data;
  const skip = (page - 1) * pageSize;

  const [follows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, username: true, name: true, profileImageUrl: true },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);

  return {
    success: true,
    data: {
      items: follows.map((f) => f.following),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  } satisfies ApiResponse<PaginatedResponse<FollowerUser>>;
}
