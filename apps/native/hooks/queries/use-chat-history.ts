import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function useChatHistory() {
  return useQuery({
    queryKey: queryKeys.chat.history(),
    queryFn: () =>
      apiClient.get<ChatMessageData[]>("/api/chat/history?limit=50"),
  });
}
