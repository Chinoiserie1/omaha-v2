import type { BacktestResult } from "@/lib/api";
import { formatPercent } from "@/lib/format";

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color ?? "text-zinc-900"}`}>
        {value}
      </p>
    </div>
  );
}

export function BacktestSummary({ backtest }: { backtest: BacktestResult }) {
  const returnColor =
    backtest.totalReturn >= 0 ? "text-green-600" : "text-red-600";

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Backtest Performance</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Return"
          value={formatPercent(backtest.totalReturn)}
          color={returnColor}
        />
        <StatCard
          label="Cumulative Value"
          value={`$${backtest.latestCumulativeValue.toFixed(2)}`}
        />
        <StatCard
          label="Periods"
          value={String(backtest.snapshotCount)}
        />
      </div>
    </section>
  );
}
