import axios, { type AxiosError } from "axios";
import { logger } from "./logger.js";
import { RateLimitError } from "./errors.js";
import { sendTelegramAlert } from "../services/telegram.service.js";

function formatRateLimitAlert(context: string, error: RateLimitError): string {
  const retryAfter = error.retryAfterMs
    ? `${Math.round(error.retryAfterMs / 1000)}s`
    : "unknown";
  return [
    "\u{1F534} <b>RATE LIMIT</b>",
    `<b>Context:</b> ${context}`,
    `<b>Status:</b> ${error.statusCode}`,
    `<b>Retry after:</b> ${retryAfter}`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join("\n");
}

function formatAxiosAlert(
  context: string,
  error: AxiosError,
): string {
  const responseBody = error.response?.data
    ? JSON.stringify(error.response.data).slice(0, 200)
    : "N/A";
  return [
    "\u{1F534} <b>API ERROR</b>",
    `<b>Context:</b> ${context}`,
    `<b>URL:</b> ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
    `<b>Status:</b> ${error.response?.status ?? "no response"}`,
    `<b>Body:</b> <code>${responseBody}</code>`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join("\n");
}

function formatGenericAlert(context: string, error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error);
  return [
    "\u{1F534} <b>ERROR</b>",
    `<b>Context:</b> ${context}`,
    `<b>Message:</b> ${message}`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join("\n");
}

function buildDedupKey(context: string, error: unknown): string {
  if (error instanceof RateLimitError) return `ratelimit:${context}`;
  if (axios.isAxiosError(error)) return `axios:${context}:${error.response?.status ?? "noresponse"}`;
  return `error:${context}`;
}

export async function alertOnError(
  context: string,
  error: unknown,
): Promise<void> {
  logger.error({ err: error, context }, `Error in ${context}`);

  let message: string;
  if (error instanceof RateLimitError) {
    message = formatRateLimitAlert(context, error);
  } else if (axios.isAxiosError(error)) {
    message = formatAxiosAlert(context, error);
  } else {
    message = formatGenericAlert(context, error);
  }

  const dedupKey = buildDedupKey(context, error);
  await sendTelegramAlert(message, dedupKey);
}
