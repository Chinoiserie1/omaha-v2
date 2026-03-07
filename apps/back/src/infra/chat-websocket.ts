import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { verifyPrivyTokenRaw } from "../middleware/auth-utils.js";
import { logger } from "../utils/logger.js";
import { streamChat } from "../services/chat.service.js";

const HEARTBEAT_INTERVAL = 30_000;

export async function registerChatWebSocket(app: FastifyInstance): Promise<void> {
  app.get(
    "/ws/chat",
    { websocket: true },
    async (socket, request) => {
      const query = request.query as Record<string, string>;
      const token = query["token"] ?? "";
      const privyUserId = await verifyPrivyTokenRaw(token);

      if (!privyUserId) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const user = await prisma.user.findUnique({
        where: { privyId: privyUserId },
        select: { id: true },
      });

      if (!user) {
        socket.close(4002, "User not found");
        return;
      }

      const userId = user.id;

      logger.info({ userId }, "Chat WebSocket connected");

      let isStreaming = false;

      // Heartbeat
      const ping = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.ping();
        }
      }, HEARTBEAT_INTERVAL);

      socket.on("message", async (raw: Buffer | ArrayBuffer | Buffer[]) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            event: string;
            data: { content?: string };
          };

          if (msg.event !== "chat:message" || !msg.data.content?.trim()) {
            return;
          }

          if (isStreaming) {
            socket.send(
              JSON.stringify({
                event: "chat:error",
                data: { error: "Please wait for the current response to finish." },
              }),
            );
            return;
          }

          isStreaming = true;

          await streamChat(
            userId,
            msg.data.content.trim(),
            (chunk) => {
              if (socket.readyState === socket.OPEN) {
                socket.send(
                  JSON.stringify({ event: "chat:chunk", data: { content: chunk } }),
                );
              }
            },
            (fullText, messageId) => {
              isStreaming = false;
              if (socket.readyState === socket.OPEN) {
                socket.send(
                  JSON.stringify({
                    event: "chat:done",
                    data: { messageId, content: fullText },
                  }),
                );
              }
            },
            (error) => {
              isStreaming = false;
              if (socket.readyState === socket.OPEN) {
                socket.send(
                  JSON.stringify({ event: "chat:error", data: { error } }),
                );
              }
            },
          );
        } catch {
          // Ignore malformed messages
        }
      });

      socket.on("close", () => {
        clearInterval(ping);
        logger.info({ userId }, "Chat WebSocket disconnected");
      });

      socket.on("error", (err: Error) => {
        logger.error({ userId, err }, "Chat WebSocket error");
      });
    },
  );
}
