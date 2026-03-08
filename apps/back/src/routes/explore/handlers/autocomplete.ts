import type { FastifyReply, FastifyRequest } from "fastify";
import { assetAutocompleteQuerySchema } from "@repo/shared";
import type { AssetSuggestion } from "@repo/shared";
import { CURATED_ASSETS } from "../../../data/curated-assets.js";

export async function autocompleteAssets(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = assetAutocompleteQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    });
  }

  const query = parsed.data.q.toUpperCase();

  const matches: AssetSuggestion[] = CURATED_ASSETS
    .filter(
      (a) =>
        a.symbol.toUpperCase().startsWith(query) ||
        a.name.toUpperCase().includes(query),
    )
    .slice(0, 10)
    .map((a) => ({
      symbol: a.symbol,
      name: a.name,
      category: a.category,
    }));

  return matches;
}
