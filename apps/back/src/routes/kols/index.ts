import type { FastifyInstance } from "fastify";
import { listKols } from "./handlers/list.js";
import { getKol } from "./handlers/get.js";
import { syncProfilesHandler } from "./handlers/sync-profiles.js";

export async function kolRoutes(app: FastifyInstance) {
  app.get("/", listKols);
  app.get("/:id", getKol);
  app.post("/sync-profiles", syncProfilesHandler);
}
