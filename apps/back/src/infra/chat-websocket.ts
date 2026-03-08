import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { verifyPrivyTokenRaw } from "../middleware/auth-utils.js";
import { logger } from "../utils/logger.js";
import { streamChat } from "../services/chat.service.js";
import {
  streamPortfolioChat,
  parsePortfolioProposal,
  stripPortfolioBlock,
} from "../services/portfolio-chat.service.js";

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
        select: { id: true, quant: { select: { id: true } } },
      });

      if (!user) {
        socket.close(4002, "User not found");
        return;
      }

      const userId = user.id;
      const quantId = user.quant?.id ?? null;

      logger.info({ userId, quantId }, "Chat WebSocket connected");

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

          const onChunk = (chunk: string) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(
                JSON.stringify({ event: "chat:chunk", data: { content: chunk } }),
              );
            }
          };

          const onDone = (fullText: string, messageId: string) => {
            isStreaming = false;

            // Check for portfolio proposal in the response
            const proposal = quantId ? parsePortfolioProposal(fullText) : null;
            const displayText = proposal ? stripPortfolioBlock(fullText) : fullText;

            if (socket.readyState === socket.OPEN) {
              socket.send(
                JSON.stringify({
                  event: "chat:done",
                  data: { messageId, content: displayText },
                }),
              );

              if (proposal) {
                socket.send(
                  JSON.stringify({
                    event: "chat:portfolio_proposal",
                    data: proposal,
                  }),
                );
              }
            }
          };

          const onError = (error: string) => {
            isStreaming = false;
            if (socket.readyState === socket.OPEN) {
              socket.send(
                JSON.stringify({ event: "chat:error", data: { error } }),
              );
            }
          };

          if (quantId) {
            await streamPortfolioChat(
              userId,
              quantId,
              msg.data.content.trim(),
              onChunk,
              onDone,
              onError,
            );
          } else {
            await streamChat(
              userId,
              msg.data.content.trim(),
              onChunk,
              onDone,
              onError,
            );
          }
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
