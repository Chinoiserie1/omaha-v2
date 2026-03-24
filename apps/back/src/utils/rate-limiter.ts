/**
 * Token-bucket rate limiter.
 *
 * Allows up to `maxTokens` requests, refilling at `refillRate` tokens/second.
 * Call `acquire()` before each request — it resolves when a token is available.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;
  private readonly waiters: Array<() => void> = [];
  private refillTimer: ReturnType<typeof setInterval> | null = null;

  constructor(requestsPerMinute: number) {
    this.maxTokens = Math.max(1, Math.ceil(requestsPerMinute / 60));
    this.tokens = this.maxTokens;
    this.refillRate = requestsPerMinute / 60_000; // tokens per ms
    this.lastRefill = Date.now();
  }

  /** Wait until a token is available, then consume it. */
  acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
      this.ensureRefillTimer();
    });
  }

  /** Stop any active refill timer (for clean shutdown). */
  destroy(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;

    if (newTokens >= 1) {
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefill = now;
      this.drainWaiters();
    }
  }

  private drainWaiters(): void {
    while (this.waiters.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const waiter = this.waiters.shift()!;
      waiter();
    }

    if (this.waiters.length === 0 && this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  private ensureRefillTimer(): void {
    if (this.refillTimer) return;
    // Check for new tokens every 100ms
    this.refillTimer = setInterval(() => this.refill(), 100);
  }
}

/**
 * Simple concurrency limiter (semaphore).
 *
 * Limits the number of concurrent async operations.
 */
export class Semaphore {
  private permits: number;
  private readonly waiters: Array<() => void> = [];

  constructor(maxConcurrency: number) {
    this.permits = maxConcurrency;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits -= 1;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      waiter();
    } else {
      this.permits += 1;
    }
  }
}
