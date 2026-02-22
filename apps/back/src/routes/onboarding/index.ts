import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { getOnboardingStatus } from "./handlers/status.js";
import { checkUsername } from "./handlers/check-username.js";
import { completeOnboarding } from "./handlers/complete.js";

export async function onboardingRoutes(app: FastifyInstance) {
  app.get("/status", getOnboardingStatus);
  app.post("/check-username", checkUsername);

  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.post("/complete", completeOnboarding);
  });
}
