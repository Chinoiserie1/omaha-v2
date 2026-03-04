import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/expo";
import { queryKeys } from "../lib/query-keys";

const WS_BASE = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001").replace(
      "http",
      "ws",
    )
  : (
      process.env.EXPO_PUBLIC_API_URL_PROD ??
      process.env.EXPO_PUBLIC_API_URL ??
      "http://localhost:4001"
    ).replace("http", "ws");

const RECONNECT_DELAY = 5_000;

/**
 * Connects to the withdrawal WebSocket channel.
 * Invalidates React Query caches on status updates.
 * Falls back to polling via React Query refetchInterval.
 */
export function useWithdrawalWebSocket() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const ws = new WebSocket(
        `${WS_BASE}/ws/withdrawals?token=${token}`,
      );

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            event: string;
            data: { withdrawalId?: string };
          };

          if (msg.event === "withdrawal:status") {
            // Invalidate both the list and the specific detail
            queryClient.invalidateQueries({
              queryKey: queryKeys.withdrawals.all(),
            });
            if (msg.data.withdrawalId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.withdrawals.detail(
                  msg.data.withdrawalId,
                ),
              });
            }
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // Silently fail — polling fallback handles this
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    }
  }, [getAccessToken, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
