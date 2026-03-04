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

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function impactLabel(type: string): string {
  const labels: Record<string, string> = {
    new_position: "New Position",
    increase: "Increase",
    decrease: "Decrease",
    exit: "Exit",
    reinforcement: "Reinforcement",
  };
  return labels[type] ?? type;
}
