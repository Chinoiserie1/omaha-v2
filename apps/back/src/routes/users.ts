import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import {
  createUserSchema,
  updateUserSchema,
  paginationSchema,
  idParamSchema,
  type ApiResponse,
  type PaginatedResponse,
  type User,
} from "@repo/shared";

export async function userRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { page?: string; pageSize?: string };
  }>("/", async (request, reply) => {
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
  });

  app.get<{
    Params: { id: string };
  }>("/:id", async (request, reply) => {
    const paramsResult = idParamSchema.safeParse(request.params);

    if (!paramsResult.success) {
      return reply.status(400).send({
        success: false,
        error: paramsResult.error.errors.map((e) => e.message).join(", "),
      } satisfies ApiResponse<never>);
    }

    const user = await prisma.user.findUnique({
      where: { id: paramsResult.data.id },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    return { success: true, data: user } satisfies ApiResponse<User>;
  });

  app.post<{
    Body: { email: string; name?: string };
  }>("/", async (request, reply) => {
    const bodyResult = createUserSchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: bodyResult.error.errors.map((e) => e.message).join(", "),
      } satisfies ApiResponse<never>);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: bodyResult.data.email },
    });

    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: "User with this email already exists",
      } satisfies ApiResponse<never>);
    }

    const user = await prisma.user.create({
      data: {
        email: bodyResult.data.email,
        name: bodyResult.data.name ?? null,
      },
    });

    return reply
      .status(201)
      .send({ success: true, data: user } satisfies ApiResponse<User>);
  });

  app.patch<{
    Params: { id: string };
    Body: { email?: string; name?: string };
  }>("/:id", async (request, reply) => {
    const paramsResult = idParamSchema.safeParse(request.params);

    if (!paramsResult.success) {
      return reply.status(400).send({
        success: false,
        error: paramsResult.error.errors.map((e) => e.message).join(", "),
      } satisfies ApiResponse<never>);
    }

    const bodyResult = updateUserSchema.safeParse(request.body);

    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: bodyResult.error.errors.map((e) => e.message).join(", "),
      } satisfies ApiResponse<never>);
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: paramsResult.data.id },
    });

    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    const updateData: { email?: string; name?: string | null } = {};
    if (bodyResult.data.email !== undefined) {
      updateData.email = bodyResult.data.email;
    }
    if (bodyResult.data.name !== undefined) {
      updateData.name = bodyResult.data.name;
    }

    const user = await prisma.user.update({
      where: { id: paramsResult.data.id },
      data: updateData,
    });

    return { success: true, data: user } satisfies ApiResponse<User>;
  });

  app.delete<{
    Params: { id: string };
  }>("/:id", async (request, reply) => {
    const paramsResult = idParamSchema.safeParse(request.params);

    if (!paramsResult.success) {
      return reply.status(400).send({
        success: false,
        error: paramsResult.error.errors.map((e) => e.message).join(", "),
      } satisfies ApiResponse<never>);
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: paramsResult.data.id },
    });

    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    await prisma.user.delete({
      where: { id: paramsResult.data.id },
    });

    return reply.status(204).send();
  });
}
