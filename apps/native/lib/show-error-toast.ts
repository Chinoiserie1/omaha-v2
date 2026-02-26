import Toast from "react-native-toast-message";
import { ApiError } from "./api-client";

const CANCEL_PATTERNS = ["cancel", "cancelled", "canceled"];

function isCancellation(message: string): boolean {
  const lower = message.toLowerCase();
  return CANCEL_PATTERNS.some((pattern) => lower.includes(pattern));
}

function extractMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, string> | null;
    return body?.error ?? `Server error (${error.status})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

export function showErrorToast(title: string, error: unknown): void {
  const message = extractMessage(error);

  console.error(`[${title}]`, error);

  if (isCancellation(message)) return;

  Toast.show({ type: "error", text1: title, text2: message });
}
