/**
 * Run backtest for a KOL and open an interactive HTML chart in the browser.
 *
 * Looks up the KOL by username, runs the full backtest via backtest.service,
 * then generates a self-contained HTML file (Chart.js CDN) with:
 *   - Cumulative portfolio value line chart
 *   - Per-period returns bar chart (green/red)
 *   - Stacked asset allocation bars with per-asset return legend
 *   - Summary stat cards (total return, portfolio value, duration, snapshots)
 *
 * The HTML is written to /tmp/backtest-<username>.html and opened in the default browser.
 *
 * Usage:
 *   set -a && source .env && set +a && pnpm --filter @repo/back exec tsx src/scripts/view-backtest.ts <username>
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/database";
import { runBacktest } from "../services/backtest.service.js";
import type { BacktestResult } from "../services/backtest.service.js";

const usernameArg = process.argv[2];
if (!usernameArg) {
  console.error("Usage: tsx src/scripts/view-backtest.ts <username>");
  process.exit(1);
}
const username: string = usernameArg;

function buildHtml(result: BacktestResult, displayName: string): string {
  const json = JSON.stringify(result);
  const firstDate = new Date(result.periods[0]!.fromDate);
  const lastDate = new Date(result.periods.at(-1)!.toDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayName} (@${username}) — Backtest Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e1e4e8; padding: 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
    .header .sub { color: #8b949e; font-size: 14px; }
    .stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 32px; flex-wrap: wrap; }
    .stat { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 16px 24px; min-width: 160px; text-align: center; }
    .stat .label { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .stat .value { font-size: 24px; font-weight: 700; }
    .stat .value.positive { color: #3fb950; }
    .stat .value.negative { color: #f85149; }
    .chart-container { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; margin-bottom: 24px; max-width: 960px; margin-left: auto; margin-right: auto; }
    .chart-container h2 { font-size: 16px; margin-bottom: 16px; color: #c9d1d9; }
    .allocations { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; max-width: 960px; margin: 0 auto 24px; }
    .allocations h2 { font-size: 16px; margin-bottom: 16px; color: #c9d1d9; }
    .period { margin-bottom: 16px; }
    .period-header { font-size: 13px; color: #8b949e; margin-bottom: 8px; }
    .alloc-bar { display: flex; border-radius: 6px; overflow: hidden; height: 28px; margin-bottom: 4px; }
    .alloc-segment { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #fff; min-width: 30px; }
    .alloc-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #8b949e; }
    .alloc-legend span { display: flex; align-items: center; gap: 4px; }
    .alloc-legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${displayName} (@${username})</h1>
    <div class="sub">Portfolio Backtest — ${fmt(firstDate)} to ${fmt(lastDate)}</div>
  </div>

  <div class="stats" id="stats"></div>

  <div class="chart-container">
    <h2>Portfolio Value Over Time (starting at $1.00)</h2>
    <canvas id="portfolioChart"></canvas>
  </div>

  <div class="chart-container">
    <h2>Period Returns</h2>
    <canvas id="returnsChart"></canvas>
  </div>

  <div class="allocations" id="allocations">
    <h2>Asset Allocations by Period</h2>
  </div>

  <script>
    const backtest = ${json};

    const assetColors = {
      SOL: '#9945FF', ZEC: '#F4B728', USDC: '#2775CA', hSOL: '#14F195',
      BTC: '#F7931A', ETH: '#627EEA', BONK: '#FF6B35', JUP: '#7B68EE',
      RENDER: '#00E4FF', WIF: '#D4A574', ONDO: '#1A73E8', PYTH: '#7B3FE4',
      RAY: '#5AC4BE', JTO: '#8B5CF6', PENGU: '#3B82F6', AI16Z: '#10B981'
    };

    // Stats
    const statsEl = document.getElementById('stats');
    const totalPct = (backtest.totalReturn * 100).toFixed(2);
    const cls = backtest.totalReturn >= 0 ? 'positive' : 'negative';
    const sign = backtest.totalReturn >= 0 ? '+' : '';
    const days = Math.round((new Date(backtest.periods.at(-1).toDate) - new Date(backtest.periods[0].fromDate)) / 86400000);
    statsEl.innerHTML =
      '<div class="stat"><div class="label">Total Return</div><div class="value ' + cls + '">' + sign + totalPct + '%</div></div>' +
      '<div class="stat"><div class="label">Portfolio Value</div><div class="value ' + cls + '">$' + backtest.latestCumulativeValue.toFixed(4) + '</div></div>' +
      '<div class="stat"><div class="label">Duration</div><div class="value">' + days + ' days</div></div>' +
      '<div class="stat"><div class="label">Snapshots</div><div class="value">' + backtest.snapshotCount + '</div></div>';

    // Portfolio Value Chart
    const dataPoints = [{ x: new Date(backtest.periods[0].fromDate), y: 1.0 }];
    backtest.periods.forEach(p => {
      dataPoints.push({ x: new Date(p.toDate), y: p.cumulativeValue });
    });

    new Chart(document.getElementById('portfolioChart'), {
      type: 'line',
      data: {
        datasets: [{
          label: 'Portfolio Value',
          data: dataPoints,
          borderColor: backtest.totalReturn >= 0 ? '#3fb950' : '#f85149',
          backgroundColor: backtest.totalReturn >= 0 ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: backtest.totalReturn >= 0 ? '#3fb950' : '#f85149',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { type: 'time', time: { unit: 'week', tooltipFormat: 'MMM d, yyyy' }, grid: { color: '#21262d' }, ticks: { color: '#8b949e' } },
          y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', callback: v => '$' + v.toFixed(2) } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => '$' + ctx.parsed.y.toFixed(4) + ' (' + ((ctx.parsed.y - 1) * 100).toFixed(2) + '%)' } }
        }
      }
    });

    // Period Returns Bar Chart
    const periodLabels = backtest.periods.map(p => {
      const from = new Date(p.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const to = new Date(p.toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return from + ' - ' + to;
    });

    new Chart(document.getElementById('returnsChart'), {
      type: 'bar',
      data: {
        labels: periodLabels,
        datasets: [{
          label: 'Period Return',
          data: backtest.periods.map(p => p.periodReturn * 100),
          backgroundColor: backtest.periods.map(p => p.periodReturn >= 0 ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)'),
          borderColor: backtest.periods.map(p => p.periodReturn >= 0 ? '#3fb950' : '#f85149'),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', maxRotation: 45 } },
          y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', callback: v => v.toFixed(0) + '%' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(2) + '%' } }
        }
      }
    });

    // Allocation Bars
    const allocEl = document.getElementById('allocations');
    backtest.periods.forEach((p, i) => {
      const from = new Date(p.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const to = new Date(p.toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const retPct = (p.periodReturn * 100).toFixed(2);
      const retSign = p.periodReturn >= 0 ? '+' : '';
      const retColor = p.periodReturn >= 0 ? '#3fb950' : '#f85149';

      let barHTML = '';
      let legendHTML = '';
      const assets = Object.entries(p.details).sort((a, b) => b[1].weight - a[1].weight);
      assets.forEach(([asset, d]) => {
        const color = assetColors[asset] || '#586069';
        const pct = (d.weight * 100).toFixed(0);
        barHTML += '<div class="alloc-segment" style="width:' + pct + '%;background:' + color + '">' + asset + ' ' + pct + '%</div>';
        const assetRet = (d.assetReturn * 100).toFixed(1);
        const assetSign = d.assetReturn >= 0 ? '+' : '';
        legendHTML += '<span><span class="dot" style="background:' + color + '"></span>' + asset + ': ' + assetSign + assetRet + '%</span>';
      });

      const periodDiv = document.createElement('div');
      periodDiv.className = 'period';
      periodDiv.innerHTML =
        '<div class="period-header">Period ' + (i + 1) + ': ' + from + ' - ' + to + ' (' + p.periodDays + 'd) — <span style="color:' + retColor + '">' + retSign + retPct + '%</span></div>' +
        '<div class="alloc-bar">' + barHTML + '</div>' +
        '<div class="alloc-legend">' + legendHTML + '</div>';
      allocEl.appendChild(periodDiv);
    });
  </script>
</body>
</html>`;
}

async function run() {
  const kol = await prisma.kol.findFirst({ where: { username } });
  if (!kol) {
    console.error(`KOL "${username}" not found`);
    process.exit(1);
  }

  console.error(`Running backtest for ${kol.username} (${kol.id})...`);
  const result = await runBacktest(kol.id);

  const displayName =
    kol.displayName || username.charAt(0).toUpperCase() + username.slice(1);
  const html = buildHtml(result, displayName);
  const outPath = `/tmp/backtest-${username}.html`;
  writeFileSync(outPath, html);
  console.error(`Written to ${outPath}`);

  execSync(`open ${outPath}`);
  console.error("Opened in browser.");
}

run()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
