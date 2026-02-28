import type { FastifyInstance } from "fastify";
import { ingestContent } from "./handlers/ingest.js";

export async function contentRoutes(app: FastifyInstance) {
  app.post("/", ingestContent);
}
