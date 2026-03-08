import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { registerPushToken } from "./handlers/register.js";
import { unregisterPushToken } from "./handlers/unregister.js";

export async function pushTokenRoutes(app: FastifyInstance) {
  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.post("/register", registerPushToken);
    authRoutes.post("/unregister", unregisterPushToken);
  });
}
