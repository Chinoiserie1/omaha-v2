import {
  BPS_DENOMINATOR,
  MAX_ENTRY_EXIT_FEE_BPS,
  MAX_MANAGEMENT_FEE_BPS,
  MAX_PERFORMANCE_FEE_BPS,
  SECONDS_PER_YEAR,
} from "./constants.js";

/**
 * Split a gross amount into (net, fee) given a fee rate in BPS.
 * Fee is rounded DOWN (favors the user).
 */
export function applyFee(
  gross: bigint,
  feeBps: number,
): { net: bigint; fee: bigint } {
  if (feeBps === 0) {
    return { net: gross, fee: 0n };
  }
  const fee = (gross * BigInt(feeBps)) / BPS_DENOMINATOR;
  const net = gross - fee;
  return { net, fee };
}

/**
 * Calculate management fee shares to mint.
 *
 * Formula: `totalSupply * mgmtBps * elapsed / (BPS * SECONDS_PER_YEAR)`
 *
 * Uses bigint to prevent overflow with large supplies.
 */
export function managementFeeShares(
  totalSupply: bigint,
  managementFeeBps: number,
  elapsedSeconds: bigint,
): bigint {
  if (managementFeeBps === 0 || elapsedSeconds === 0n || totalSupply === 0n) {
    return 0n;
  }
  const numerator =
    totalSupply * BigInt(managementFeeBps) * elapsedSeconds;
  const denominator = BPS_DENOMINATOR * SECONDS_PER_YEAR;
  return numerator / denominator;
}

/**
 * Calculate performance fee shares to mint.
 *
 * Only produces shares when `sharePrice > highWaterMark`.
 *
 * Formula: `(price - hwm) * totalSupply * perfBps / (price * BPS)`
 */
export function performanceFeeShares(
  sharePrice: bigint,
  highWaterMark: bigint,
  totalSupply: bigint,
  performanceFeeBps: number,
): bigint {
  if (
    performanceFeeBps === 0 ||
    totalSupply === 0n ||
    sharePrice <= highWaterMark
  ) {
    return 0n;
  }
  const priceIncrease = sharePrice - highWaterMark;
  const numerator =
    priceIncrease * totalSupply * BigInt(performanceFeeBps);
  const denominator = sharePrice * BPS_DENOMINATOR;
  return numerator / denominator;
}

/**
 * Validate that all fee BPS values are within allowed maximums.
 */
export function validateFeeBps(
  entryFeeBps: number,
  exitFeeBps: number,
  managementFeeBps: number,
  performanceFeeBps: number,
): boolean {
  return (
    entryFeeBps <= MAX_ENTRY_EXIT_FEE_BPS &&
    exitFeeBps <= MAX_ENTRY_EXIT_FEE_BPS &&
    managementFeeBps <= MAX_MANAGEMENT_FEE_BPS &&
    performanceFeeBps <= MAX_PERFORMANCE_FEE_BPS
  );
}
