export class RateLimitError extends Error {
  public readonly statusCode: number;
  public readonly retryAfterMs: number | null;

  constructor(statusCode: number, retryAfter: string | null) {
    super(`Rate limited (HTTP ${statusCode})`);
    this.name = "RateLimitError";
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : null;
  }
}
