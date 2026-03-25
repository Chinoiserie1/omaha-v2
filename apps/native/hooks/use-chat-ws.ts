import { useEffect, useRef, useCallback, useState } from "react";
import { usePrivy } from "@privy-io/expo";
import { WS_BASE } from "../lib/api-url";

const RECONNECT_DELAY = 5_000;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface PortfolioProposal {
  thesisSummary: string;
  allocations: Array<{
    asset: string;
    percentage: number;
    conviction: string;
    reasoning: string;
  }>;
  changes: string[];
}

export interface VaultDeployAction {
  action: "create_vault";
}

interface UseChatWsReturn {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  isConnected: boolean;
  sessionId: string | null;
  pendingProposal: PortfolioProposal | null;
  pendingVaultDeploy: VaultDeployAction | null;
  sendMessage: (content: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  createNewSession: () => void;
  clearProposal: () => void;
  clearVaultDeploy: () => void;
}

export function useChatWs(): UseChatWsReturn {
  const { getAccessToken } = usePrivy();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] =
    useState<PortfolioProposal | null>(null);
  const [pendingVaultDeploy, setPendingVaultDeploy] =
    useState<VaultDeployAction | null>(null);

  const connect = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const ws = new WebSocket(`${WS_BASE}/ws/chat?token=${token}`);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            event: string;
            data: {
              content?: string;
              messageId?: string;
              error?: string;
              sessionId?: string;
              thesisSummary?: string;
              allocations?: PortfolioProposal["allocations"];
              changes?: string[];
              action?: string;
            };
          };

          switch (msg.event) {
            case "chat:session":
              if (msg.data.sessionId) {
                setSessionId(msg.data.sessionId);
              }
              break;

            case "chat:session_created":
              if (msg.data.sessionId) {
                setSessionId(msg.data.sessionId);
                setMessages([]);
                setPendingProposal(null);
                setPendingVaultDeploy(null);
              }
              break;

            case "chat:chunk":
              setStreamingContent((prev) => prev + (msg.data.content ?? ""));
              break;

            case "chat:done":
              setMessages((prev) => [
                ...prev,
                {
                  id: msg.data.messageId ?? Date.now().toString(),
                  role: "assistant",
                  content: msg.data.content ?? "",
                  createdAt: new Date().toISOString(),
                },
              ]);
              setStreamingContent("");
              setIsStreaming(false);
              break;

            case "chat:portfolio_proposal":
              if (
                msg.data.thesisSummary &&
                msg.data.allocations &&
                msg.data.changes
              ) {
                setPendingProposal({
                  thesisSummary: msg.data.thesisSummary,
                  allocations: msg.data.allocations,
                  changes: msg.data.changes,
                });
              }
              break;

            case "chat:vault_deploy":
              if (msg.data.action === "create_vault") {
                setPendingVaultDeploy({ action: "create_vault" });
              }
              break;

            case "chat:error":
              setStreamingContent("");
              setIsStreaming(false);
              break;
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    }
  }, [getAccessToken]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (isStreaming) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setStreamingContent("");
      setPendingProposal(null);
      setPendingVaultDeploy(null);

      wsRef.current.send(
        JSON.stringify({ event: "chat:message", data: { content } }),
      );
    },
    [isStreaming],
  );

  const createNewSession = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isStreaming) return;

    wsRef.current.send(
      JSON.stringify({ event: "chat:new_session", data: {} }),
    );
  }, [isStreaming]);

  const clearProposal = useCallback(() => {
    setPendingProposal(null);
  }, []);

  const clearVaultDeploy = useCallback(() => {
    setPendingVaultDeploy(null);
  }, []);

  return {
    messages,
    streamingContent,
    isStreaming,
    isConnected,
    sessionId,
    pendingProposal,
    pendingVaultDeploy,
    sendMessage,
    setMessages,
    createNewSession,
    clearProposal,
    clearVaultDeploy,
  };
}
