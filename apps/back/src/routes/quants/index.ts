import type { FastifyInstance } from "fastify";
import { listQuants } from "./handlers/list.js";
import { getQuant } from "./handlers/get.js";
import { syncProfilesHandler } from "./handlers/sync-profiles.js";
import { instantRunAlgo } from "./handlers/instant-run-algo.js";
import { updateQuantKnowledge } from "./handlers/update-knowledge.js";

export async function quantRoutes(app: FastifyInstance) {
  app.get("/", listQuants);
  app.get("/:id", getQuant);
  app.post("/sync-profiles", syncProfilesHandler);
  app.post("/:quantId/instant-run-algo", instantRunAlgo);
  app.patch("/:quantId/knowledge", updateQuantKnowledge);
}
