import type { FastifyInstance } from "fastify";
import { searchSignals } from "./handlers/search.js";
import { autocompleteAssets } from "./handlers/autocomplete.js";
import { getTrending } from "./handlers/trending.js";

export async function exploreRoutes(app: FastifyInstance) {
  app.get("/search", searchSignals);
  app.get("/assets", autocompleteAssets);
  app.get("/trending", getTrending);
}
