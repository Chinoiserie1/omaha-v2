import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@repo/database";
import {
  completeOnboardingSchema,
  type ApiResponse,
  type User,
} from "@repo/shared";

type CompleteRequest = FastifyRequest<{
  Body: {
    privyId: string;
    email?: string;
    username: string;
    twitterId?: string;
    twitterUsername?: string;
    profileImageUrl?: string;
    name?: string;
  };
}>;

export async function completeOnboarding(
  request: CompleteRequest,
  reply: FastifyReply
): Promise<ApiResponse<User> | ApiResponse<never>> {
  const result = completeOnboardingSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      success: false,
      error: result.error.errors.map((e) => e.message).join(", "),
    } satisfies ApiResponse<never>);
  }

  const { privyId, email, username, twitterId, twitterUsername, profileImageUrl, name } =
    result.data;

  // Check username uniqueness
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUsername && existingUsername.privyId !== privyId) {
    return reply.status(409).send({
      success: false,
      error: "Username is already taken",
    } satisfies ApiResponse<never>);
  }

  const user = await prisma.user.upsert({
    where: { privyId },
    create: {
      privyId,
      email: email ?? null,
      username,
      name: name ?? null,
      twitterId: twitterId ?? null,
      twitterUsername: twitterUsername ?? null,
      profileImageUrl: profileImageUrl ?? null,
      onboardingCompleted: true,
    },
    update: {
      email: email ?? null,
      username,
      name: name ?? null,
      twitterId: twitterId ?? null,
      twitterUsername: twitterUsername ?? null,
      profileImageUrl: profileImageUrl ?? null,
      onboardingCompleted: true,
    },
  });

  return { success: true, data: user } satisfies ApiResponse<User>;
}
