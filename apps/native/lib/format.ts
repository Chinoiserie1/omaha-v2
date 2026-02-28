/**
 * Format a number as USD currency.
 * Values >= $1 show 2 decimals, values < $1 show 4 decimals.
 */
export function formatUsd(value: number): string {
  return value >= 1
    ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${value.toFixed(4)}`;
}

/**
 * Format a token amount with compact notation for large values.
 */
export function formatTokenAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value >= 1 ? value.toFixed(2) : value.toFixed(4);
}
