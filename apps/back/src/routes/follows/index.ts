import type { FastifyInstance } from "fastify";
import { verifyPrivyToken } from "../../middleware/auth.js";
import { followUser } from "./handlers/follow.js";
import { unfollowUser } from "./handlers/unfollow.js";
import { getFollowers } from "./handlers/get-followers.js";
import { getFollowing } from "./handlers/get-following.js";
import { getFollowCounts } from "./handlers/get-counts.js";
import { getFollowStatus } from "./handlers/get-status.js";

export async function followRoutes(app: FastifyInstance) {
  // Public routes
  app.get("/followers", getFollowers);
  app.get("/following", getFollowing);
  app.get("/counts", getFollowCounts);

  // Authenticated routes
  app.register(async (authRoutes) => {
    authRoutes.addHook("preHandler", verifyPrivyToken);
    authRoutes.post("/follow", followUser);
    authRoutes.post("/unfollow", unfollowUser);
    authRoutes.get("/status", getFollowStatus);
  });
}
