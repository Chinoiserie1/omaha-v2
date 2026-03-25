import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { getChatHistoryHandler } from "./handlers/history.js";
import { createSessionHandler } from "./handlers/create-session.js";

export async function chatRoutes(app: FastifyInstance) {
  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.get("/history", getChatHistoryHandler);
    authRoutes.post("/sessions", createSessionHandler);
  });
}
