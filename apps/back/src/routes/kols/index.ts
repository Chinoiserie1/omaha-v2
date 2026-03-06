import type { FastifyInstance } from "fastify";
import { listKols } from "./handlers/list.js";
import { getKol } from "./handlers/get.js";
import { syncProfilesHandler } from "./handlers/sync-profiles.js";
import { instantRunAlgo } from "./handlers/instant-run-algo.js";
import { updateKolKnowledge } from "./handlers/update-knowledge.js";

export async function kolRoutes(app: FastifyInstance) {
  app.get("/", listKols);
  app.get("/:id", getKol);
  app.post("/sync-profiles", syncProfilesHandler);
  app.post("/:kolId/instant-run-algo", instantRunAlgo);
  app.patch("/:kolId/knowledge", updateKolKnowledge);
}
