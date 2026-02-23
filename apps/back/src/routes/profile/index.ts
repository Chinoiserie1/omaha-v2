import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { getMyProfile } from "./handlers/get-my-profile.js";
import { syncTwitter } from "./handlers/sync-twitter.js";

export async function profileRoutes(app: FastifyInstance) {
  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.get("/me", getMyProfile);
    authRoutes.patch("/sync-twitter", syncTwitter);
  });
}
