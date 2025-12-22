import type { FastifyInstance } from "fastify";
import { listUsers } from "./handlers/list.js";
import { getUser } from "./handlers/get.js";
import { createUser } from "./handlers/create.js";
import { updateUser } from "./handlers/update.js";
import { deleteUser } from "./handlers/delete.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/", listUsers);
  app.get("/:id", getUser);
  app.post("/", createUser);
  app.patch("/:id", updateUser);
  app.delete("/:id", deleteUser);
}
