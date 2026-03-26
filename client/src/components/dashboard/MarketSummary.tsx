import { Card } from "../common/Card";
import type { MarketSummary as MSType } from "../../types/stock";
import { TrendingUp, TrendingDown, BarChart2, DollarSign, Target, Activity } from "lucide-react";

interface Props {
  summary: MSType;
  onSelectStock: (symbol: string) => void;
}

export function MarketSummary({ summary, onSelectStock }: Props) {
  const isUp = summary.avgChange >= 0;

  const cards = [
    { icon: <Activity size={20} />, label: "Market Trend",
      value: `${isUp ? "+" : ""}${summary.avgChange.toFixed(2)}%`,
      cls: isUp ? "icon-green" : "icon-red",
      sub: `${summary.advancers} up / ${summary.decliners} down` },
    { icon: <BarChart2 size={20} />, label: "Stocks Tracked",
      value: summary.totalStocks.toString() },
    { icon: <TrendingUp size={20} />, label: "Avg P/E Ratio",
      value: summary.avgPE?.toFixed(1) ?? "N/A" },
    { icon: <DollarSign size={20} />, label: "Avg Dividend Yield",
      value: summary.avgDividendYield ? `${(summary.avgDividendYield * 100).toFixed(2)}%` : "N/A" },
    { icon: <TrendingUp size={20} />, label: "Top Gainer", cls: "icon-green",
      value: summary.gainers[0]?.symbol ?? "N/A",
      sym: summary.gainers[0]?.symbol,
      sub: summary.gainers[0] ? `+${summary.gainers[0].changePercent.toFixed(2)}%` : undefined },
    { icon: <TrendingDown size={20} />, label: "Top Loser", cls: "icon-red",
      value: summary.losers[0]?.symbol ?? "N/A",
      sym: summary.losers[0]?.symbol,
      sub: summary.losers[0] ? `${summary.losers[0].changePercent.toFixed(2)}%` : undefined },
    { icon: <Target size={20} />, label: "Most Undervalued",
      value: summary.topUndervalued?.symbol ?? "N/A",
      sym: summary.topUndervalued?.symbol,
      sub: summary.topUndervalued ? `Margin: ${summary.topUndervalued.marginOfSafety?.toFixed(1)}%` : undefined },
    { icon: <DollarSign size={20} />, label: "Top Dividend",
      value: summary.topDividend?.symbol ?? "N/A",
      sym: summary.topDividend?.symbol,
      sub: summary.topDividend?.dividendYield ? `Yield: ${(summary.topDividend.dividendYield * 100).toFixed(2)}%` : undefined },
  ];

  return (
    <div className="summary-grid-wide">
      {cards.map((c) => (
        <Card key={c.label} className={`summary-card ${c.sym ? "clickable" : ""}`}>
          <div
            className="summary-card-inner"
            onClick={c.sym ? () => onSelectStock(c.sym!) : undefined}
          >
            <div className={`summary-icon ${c.cls || ""}`}>{c.icon}</div>
            <div>
              <p className="summary-label">{c.label}</p>
              <p className="summary-value">{c.value}</p>
              {c.sub && <p className="summary-sub">{c.sub}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
