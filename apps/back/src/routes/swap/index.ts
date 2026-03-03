import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { fundSol } from "./handlers/fund-sol.js";

export async function swapRoutes(app: FastifyInstance) {
  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.post("/fund-sol", fundSol);
  });
}
