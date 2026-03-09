import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { listVaults } from "./handlers/list.js";
import { getVault } from "./handlers/get.js";
import { getVaultPerformance } from "./handlers/performance.js";
import { getVaultHoldingsHandler } from "./handlers/holdings.js";
import { snapshotHoldingsHandler } from "./handlers/snapshot-holdings.js";
import { subscribeToVault } from "./handlers/subscribe.js";
import { redeemFromVault } from "./handlers/redeem.js";
import { getInvestorStatus } from "./handlers/investor-status.js";
import { claimRedemption } from "./handlers/claim.js";
import { confirmSubscribe } from "./handlers/confirm-subscribe.js";
import { getFavoriteStatus } from "./handlers/favorite-status.js";
import { toggleFavorite } from "./handlers/toggle-favorite.js";
import { getRebalances } from "./handlers/rebalances.js";
import { createVault } from "./handlers/create.js";

export async function vaultRoutes(app: FastifyInstance) {
  app.get("/", listVaults);
  app.get("/:id", getVault);
  app.get("/:id/performance", getVaultPerformance);
  app.get("/:id/holdings", getVaultHoldingsHandler);
  app.get("/:id/rebalances", getRebalances);
  app.post("/:id/holdings/snapshot", snapshotHoldingsHandler);

  // Auth-protected routes
  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.post("/", createVault);
    authRoutes.get("/:id/investor-status", getInvestorStatus);
    authRoutes.post("/:id/subscribe", subscribeToVault);
    authRoutes.post("/:id/redeem", redeemFromVault);
    authRoutes.post("/:id/claim", claimRedemption);
    authRoutes.post("/:id/confirm-subscribe", confirmSubscribe);
    authRoutes.get("/:id/favorite", getFavoriteStatus);
    authRoutes.post("/:id/favorite", toggleFavorite);
  });
}
