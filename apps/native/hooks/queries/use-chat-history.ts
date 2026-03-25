import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatHistoryResponse {
  sessionId: string;
  messages: ChatMessageData[];
}

export function useChatHistory(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.chat.history(sessionId),
    queryFn: () => {
      const params = sessionId
        ? `?limit=50&sessionId=${sessionId}`
        : "?limit=50";
      return apiClient.get<ChatHistoryResponse>(`/api/chat/history${params}`);
    },
    enabled: sessionId !== null,
  });
}
