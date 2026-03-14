import { describe, expect, it } from "vitest";

import { SECONDS_PER_YEAR } from "../src/constants.js";
import {
  applyFee,
  managementFeeShares,
  performanceFeeShares,
  validateFeeBps,
} from "../src/fees.js";

// ── applyFee (mirrors Rust apply_fee tests) ─────────────────────────────────

describe("applyFee", () => {
  it("zero bps returns full amount", () => {
    const { net, fee } = applyFee(1_000n, 0);
    expect(net).toBe(1_000n);
    expect(fee).toBe(0n);
  });

  it("1% fee", () => {
    const { net, fee } = applyFee(10_000n, 100);
    expect(net).toBe(9_900n);
    expect(fee).toBe(100n);
  });

  it("10% fee", () => {
    const { net, fee } = applyFee(10_000n, 1_000);
    expect(net).toBe(9_000n);
    expect(fee).toBe(1_000n);
  });

  it("rounds down (favors user)", () => {
    // 1% of 999 = 9.99 → 9
    const { net, fee } = applyFee(999n, 100);
    expect(net).toBe(990n);
    expect(fee).toBe(9n);
  });

  it("zero amount", () => {
    const { net, fee } = applyFee(0n, 500);
    expect(net).toBe(0n);
    expect(fee).toBe(0n);
  });

  it("small amount rounds fee to zero", () => {
    // 1 * 100 / 10_000 = 0
    const { net, fee } = applyFee(1n, 100);
    expect(net).toBe(1n);
    expect(fee).toBe(0n);
  });
});

// ── managementFeeShares (mirrors Rust management_fee_shares tests) ──────────

describe("managementFeeShares", () => {
  it("2% over 1 year = 20,000", () => {
    const result = managementFeeShares(1_000_000n, 200, SECONDS_PER_YEAR);
    expect(result).toBe(20_000n);
  });

  it("2% over half year = 10,000", () => {
    const result = managementFeeShares(
      1_000_000n,
      200,
      SECONDS_PER_YEAR / 2n,
    );
    expect(result).toBe(10_000n);
  });

  it("zero supply returns 0", () => {
    expect(managementFeeShares(0n, 200, SECONDS_PER_YEAR)).toBe(0n);
  });

  it("zero bps returns 0", () => {
    expect(managementFeeShares(1_000_000n, 0, SECONDS_PER_YEAR)).toBe(0n);
  });

  it("zero elapsed returns 0", () => {
    expect(managementFeeShares(1_000_000n, 200, 0n)).toBe(0n);
  });

  it("10% over 1 day matches Rust", () => {
    const oneDay = 86_400n;
    const result = managementFeeShares(1_000_000n, 1_000, oneDay);
    // Rust: 1_000_000 * 1_000 * 86_400 / (10_000 * 31_557_600) = 273
    const expected =
      (1_000_000n * 1_000n * 86_400n) / (10_000n * 31_557_600n);
    expect(result).toBe(expected);
  });
});

// ── performanceFeeShares (mirrors Rust performance_fee_shares tests) ────────

describe("performanceFeeShares", () => {
  it("no profit (price == hwm) returns 0", () => {
    expect(
      performanceFeeShares(1_000_000n, 1_000_000n, 100_000n, 2_000),
    ).toBe(0n);
  });

  it("below hwm returns 0", () => {
    expect(
      performanceFeeShares(900_000n, 1_000_000n, 100_000n, 2_000),
    ).toBe(0n);
  });

  it("price doubled, 20% fee", () => {
    // (2M - 1M) * 100M * 2000 / (2M * 10000) = 10M
    const result = performanceFeeShares(
      2_000_000n,
      1_000_000n,
      100_000_000n,
      2_000,
    );
    expect(result).toBe(10_000_000n);
  });

  it("zero supply returns 0", () => {
    expect(performanceFeeShares(2_000_000n, 1_000_000n, 0n, 2_000)).toBe(
      0n,
    );
  });

  it("zero bps returns 0", () => {
    expect(
      performanceFeeShares(2_000_000n, 1_000_000n, 100_000n, 0),
    ).toBe(0n);
  });

  it("tiny increase rounds down to 0", () => {
    // (1_000_001 - 1_000_000) * 1_000_000 * 2000 / (1_000_001 * 10_000) = 0
    const result = performanceFeeShares(
      1_000_001n,
      1_000_000n,
      1_000_000n,
      2_000,
    );
    expect(result).toBe(0n);
  });
});

// ── validateFeeBps (mirrors Rust validate_fee_bps tests) ────────────────────

describe("validateFeeBps", () => {
  it("all zero is valid", () => {
    expect(validateFeeBps(0, 0, 0, 0)).toBe(true);
  });

  it("at max is valid", () => {
    expect(validateFeeBps(1_000, 1_000, 1_000, 5_000)).toBe(true);
  });

  it("entry exceeds", () => {
    expect(validateFeeBps(1_001, 0, 0, 0)).toBe(false);
  });

  it("exit exceeds", () => {
    expect(validateFeeBps(0, 1_001, 0, 0)).toBe(false);
  });

  it("management exceeds", () => {
    expect(validateFeeBps(0, 0, 1_001, 0)).toBe(false);
  });

  it("performance exceeds", () => {
    expect(validateFeeBps(0, 0, 0, 5_001)).toBe(false);
  });
});
