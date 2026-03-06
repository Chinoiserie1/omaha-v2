import type { PortfolioSnapshot } from "@/lib/api";
import { formatDate } from "@/lib/format";

const convictionColors: Record<string, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-zinc-100 text-zinc-600",
  stale: "bg-red-100 text-red-600",
};

export function PortfolioSection({
  snapshot,
}: {
  snapshot: PortfolioSnapshot;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Portfolio</h2>

      {snapshot.thesisSummary && (
        <blockquote className="mb-4 border-l-4 border-zinc-300 pl-4 text-sm italic text-zinc-600">
          {snapshot.thesisSummary}
        </blockquote>
      )}

      {snapshot.allocations.length === 0 ? (
        <p className="text-sm text-zinc-500">No allocations.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">%</th>
                <th className="pb-2 pr-4 font-medium">Conviction</th>
                <th className="pb-2 pr-4 font-medium">Reasoning</th>
                <th className="pb-2 font-medium">Since</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.allocations.map((a) => (
                <tr key={a.asset} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 font-medium">{a.asset}</td>
                  <td className="py-2 pr-4">{a.percentage}%</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${convictionColors[a.conviction] ?? "bg-zinc-100 text-zinc-600"}`}
                    >
                      {a.conviction}
                    </span>
                  </td>
                  <td className="max-w-xs truncate py-2 pr-4 text-zinc-600">
                    {a.reasoning}
                  </td>
                  <td className="py-2 text-zinc-500">{formatDate(a.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
