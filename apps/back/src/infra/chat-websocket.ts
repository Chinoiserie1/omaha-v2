import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { verifyPrivyTokenRaw } from "../middleware/auth-utils.js";
import { logger } from "../utils/logger.js";
import { streamChat } from "../services/chat.service.js";
import { createSession, getLatestSession } from "../store/chat.repository.js";
import {
  streamPortfolioChat,
  parsePortfolioProposal,
  stripPortfolioBlock,
  parseVaultDeployAction,
  stripVaultDeployBlock,
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

      // Resolve latest session for this user
      let currentSession = await getLatestSession(userId);

      logger.info({ userId, quantId, sessionId: currentSession.id }, "Chat WebSocket connected");

      // Send current session id to client
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            event: "chat:session",
            data: { sessionId: currentSession.id },
          }),
        );
      }

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

          // Handle new session creation
          if (msg.event === "chat:new_session") {
            if (isStreaming) {
              socket.send(
                JSON.stringify({
                  event: "chat:error",
                  data: { error: "Cannot create session while streaming." },
                }),
              );
              return;
            }

            currentSession = await createSession(userId);
            logger.info({ userId, sessionId: currentSession.id }, "New chat session created via WS");

            if (socket.readyState === socket.OPEN) {
              socket.send(
                JSON.stringify({
                  event: "chat:session_created",
                  data: { sessionId: currentSession.id },
                }),
              );
            }
            return;
          }

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

            // Check for structured actions in the response
            const proposal = quantId ? parsePortfolioProposal(fullText) : null;
            const vaultDeploy = quantId ? parseVaultDeployAction(fullText) : null;

            let displayText = fullText;
            if (proposal) displayText = stripPortfolioBlock(displayText);
            if (vaultDeploy) displayText = stripVaultDeployBlock(displayText);

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

              if (vaultDeploy) {
                socket.send(
                  JSON.stringify({
                    event: "chat:vault_deploy",
                    data: vaultDeploy,
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
              currentSession.id,
              userId,
              quantId,
              msg.data.content.trim(),
              onChunk,
              onDone,
              onError,
            );
          } else {
            await streamChat(
              currentSession.id,
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
