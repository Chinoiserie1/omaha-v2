import type { FastifyInstance } from "fastify";
import { checkUsername } from "./handlers/check-username.js";
import { completeOnboarding } from "./handlers/complete.js";

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/check-username", checkUsername);
  app.post("/complete", completeOnboarding);
}
