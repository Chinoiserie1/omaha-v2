import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import { followListQuerySchema, type ApiResponse, type PaginatedResponse, type FollowerUser } from "@repo/shared";

type FollowersRequest = FastifyRequest<{ Querystring: { userId: string; page?: string; pageSize?: string } }>;

export async function getFollowers(
  request: FollowersRequest,
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
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, username: true, name: true, profileImageUrl: true },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.count({ where: { followingId: userId } }),
  ]);

  return {
    success: true,
    data: {
      items: follows.map((f) => f.follower),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  } satisfies ApiResponse<PaginatedResponse<FollowerUser>>;
}
