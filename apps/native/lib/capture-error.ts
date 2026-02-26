import { posthogClient } from "./posthog";
import { ApiError } from "./api-client";

const CANCEL_PATTERNS = ["cancel", "cancelled", "canceled"];

function isCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const lower = error.message.toLowerCase();
  return CANCEL_PATTERNS.some((pattern) => lower.includes(pattern));
}

interface CaptureErrorOptions {
  source: string;
}

/**
 * Sends a caught error to PostHog via `captureException`.
 * Silently ignores cancellation errors (user-dismissed flows).
 * Enriches ApiError instances with HTTP status and response body.
 */
export function captureError(error: unknown, { source }: CaptureErrorOptions): void {
  if (isCancellation(error)) return;

  const properties: Record<string, string | number> = {
    $exception_source: source,
  };

  if (error instanceof ApiError) {
    properties.http_status = error.status;
    properties.api_error_body = JSON.stringify(error.body);
  }

  posthogClient.captureException(error, properties);
}
