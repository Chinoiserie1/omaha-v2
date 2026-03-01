import type { FastifyInstance } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type WebSocket from "ws";
import { verifyPrivyTokenRaw } from "../middleware/auth-utils.js";
import { logger } from "../utils/logger.js";

const userConnections = new Map<string, Set<WebSocket>>();
const HEARTBEAT_INTERVAL = 30_000;

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(fastifyWebsocket);

  app.get(
    "/ws/withdrawals",
    { websocket: true },
    async (socket, request) => {
      const query = request.query as Record<string, string>;
      const token = query["token"] ?? "";
      const userId = await verifyPrivyTokenRaw(token);

      if (!userId) {
        socket.close(4001, "Unauthorized");
        return;
      }

      // Track connection
      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
      }
      userConnections.get(userId)!.add(socket as unknown as WebSocket);

      logger.info({ userId }, "WebSocket connected");

      // Heartbeat
      const ping = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.ping();
        }
      }, HEARTBEAT_INTERVAL);

      socket.on("close", () => {
        clearInterval(ping);
        const conns = userConnections.get(userId);
        if (conns) {
          conns.delete(socket as unknown as WebSocket);
          if (conns.size === 0) userConnections.delete(userId);
        }
        logger.info({ userId }, "WebSocket disconnected");
      });

      socket.on("error", (err: Error) => {
        logger.error({ userId, err }, "WebSocket error");
      });
    },
  );
}

export function notifyUser(
  userId: string,
  event: string,
  data: unknown,
): void {
  const conns = userConnections.get(userId);
  if (!conns || conns.size === 0) return;

  const message = JSON.stringify({ event, data });

  for (const ws of conns) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}
