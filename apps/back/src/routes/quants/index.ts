import type { FastifyInstance } from "fastify";
import { listQuants } from "./handlers/list.js";
import { getQuant } from "./handlers/get.js";
import { syncProfilesHandler } from "./handlers/sync-profiles.js";
import { instantRunAlgo } from "./handlers/instant-run-algo.js";
import { updateQuantKnowledge } from "./handlers/update-knowledge.js";
import { becomeQuant } from "./handlers/become.js";
import { becomeAndAnalyze } from "./handlers/become-and-analyze.js";
import { getSetupStatus } from "./handlers/setup-status.js";
import { getVaultByQuantId } from "./handlers/get-vault.js";
import { acceptProposal } from "./handlers/accept-proposal.js";
import { verifyPrivyToken } from "../../middleware/auth.js";

export async function quantRoutes(app: FastifyInstance) {
  app.get("/", listQuants);
  app.get("/:id", getQuant);
  app.post("/sync-profiles", syncProfilesHandler);
  app.post("/:quantId/instant-run-algo", instantRunAlgo);
  app.patch("/:quantId/knowledge", updateQuantKnowledge);
  app.get("/:quantId/setup-status", getSetupStatus);
  app.get("/:quantId/vault", getVaultByQuantId);

  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.post("/become", becomeQuant);
    authRoutes.post("/become-and-analyze", becomeAndAnalyze);
    authRoutes.post("/:quantId/accept-proposal", acceptProposal);
  });
}
