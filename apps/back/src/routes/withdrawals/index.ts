import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { requestWithdrawal } from "./handlers/request.js";
import { getWithdrawalStatus } from "./handlers/status.js";
import { listWithdrawals } from "./handlers/list.js";
import { claimWithdrawal } from "./handlers/claim.js";
import { confirmClaimHandler } from "./handlers/confirm-claim.js";
import { retryWithdrawal } from "./handlers/retry.js";

export async function withdrawalRoutes(app: FastifyInstance) {
  // All withdrawal routes require authentication
  app.addHook("preHandler", verifyPrivyToken);

  app.get("/", listWithdrawals);
  app.get("/:withdrawalId/status", getWithdrawalStatus);
  app.post("/:vaultId/request", requestWithdrawal);
  app.post("/:withdrawalId/claim", claimWithdrawal);
  app.post("/:withdrawalId/confirm-claim", confirmClaimHandler);
  app.post("/:withdrawalId/retry", retryWithdrawal);
}
