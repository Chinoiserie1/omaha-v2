import type { FastifyInstance } from "fastify";
import { listVaults } from "./handlers/list.js";
import { getVault } from "./handlers/get.js";

export async function vaultRoutes(app: FastifyInstance) {
  app.get("/", listVaults);
  app.get("/:id", getVault);
}
