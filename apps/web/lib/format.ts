export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString("en-US");
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "0%";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
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
    reaffirm: "Reaffirm",
  };
  return labels[type] ?? type;
}
