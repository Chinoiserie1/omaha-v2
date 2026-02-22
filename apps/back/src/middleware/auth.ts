import { PrivyClient } from "@privy-io/server-auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiResponse } from "@repo/shared";

declare module "fastify" {
  interface FastifyRequest {
    privyUserId: string;
  }
}

const privy = new PrivyClient(
  process.env["EXPO_PUBLIC_PRIVY_APP_ID"] ?? "",
  process.env["PRIVY_APP_SECRET"] ?? ""
);

export async function verifyPrivyToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: "Missing or invalid Authorization header",
    } satisfies ApiResponse<never>);
  }

  const token = authHeader.slice(7);

  try {
    const claims = await privy.verifyAuthToken(token);
    request.privyUserId = claims.userId;
  } catch {
    return reply.status(401).send({
      success: false,
      error: "Invalid or expired token",
    } satisfies ApiResponse<never>);
  }
}
