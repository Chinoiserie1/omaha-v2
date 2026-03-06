import { notFound } from "next/navigation";
import {
  fetchKols,
  fetchPortfolio,
  fetchSignificantTweets,
  fetchBacktest,
} from "@/lib/api";
import { KolHeader } from "./components/KolHeader";
import { BacktestSummary } from "./components/BacktestSummary";
import { PortfolioSection } from "./components/PortfolioSection";
import { SignificantTweets } from "./components/SignificantTweets";

export const dynamic = "force-dynamic";

export default async function KolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [kolsRes, portfolioRes, tweetsRes, backtestRes] =
    await Promise.allSettled([
      fetchKols().then((kols) => kols.find((k) => k.id === id)),
      fetchPortfolio(id),
      fetchSignificantTweets(id, 10),
      fetchBacktest(id),
    ]);

  const kol = kolsRes.status === "fulfilled" ? kolsRes.value : undefined;
  if (!kol) return notFound();

  const portfolio =
    portfolioRes.status === "fulfilled" ? portfolioRes.value : null;
  const tweets =
    tweetsRes.status === "fulfilled"
      ? tweetsRes.value.significantTweets
      : [];
  const backtest =
    backtestRes.status === "fulfilled" ? backtestRes.value : null;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <KolHeader kol={kol} />

      <BacktestSummary backtest={backtest} />

      {portfolio && <PortfolioSection snapshot={portfolio.snapshot} />}

      <SignificantTweets tweets={tweets} />
    </main>
  );
}
