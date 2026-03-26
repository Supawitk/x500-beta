import { Card } from "../common/Card";
import { Eye, TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
}

export function WatchlistSummary({ stocks }: Props) {
  if (stocks.length === 0) return null;

  const ups = stocks.filter((s) => s.changePercent > 0).length;
  const downs = stocks.filter((s) => s.changePercent < 0).length;
  const avgChange = stocks.reduce((a, s) => a + s.changePercent, 0) / stocks.length;
  const avgYield = stocks.filter((s) => s.dividendYield).reduce((a, s) => a + (s.dividendYield ?? 0), 0)
    / (stocks.filter((s) => s.dividendYield).length || 1);
  const best = [...stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
  const worst = [...stocks].sort((a, b) => a.changePercent - b.changePercent)[0];

  const items = [
    { icon: <Eye size={18} />, label: "Watching", value: `${stocks.length} stocks` },
    { icon: <Activity size={18} />, label: "Avg Change", value: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`,
      cls: avgChange >= 0 ? "text-green" : "text-red" },
    { icon: <TrendingUp size={18} />, label: "Best Today", value: `${best.symbol} +${best.changePercent.toFixed(2)}%`, cls: "text-green" },
    { icon: <TrendingDown size={18} />, label: "Worst Today", value: `${worst.symbol} ${worst.changePercent.toFixed(2)}%`, cls: "text-red" },
    { icon: <DollarSign size={18} />, label: "Avg Yield", value: `${(avgYield * 100).toFixed(2)}%` },
    { label: "Breadth", value: `${ups} up / ${downs} down`, icon: <Activity size={18} /> },
  ];

  return (
    <div className="wl-summary">
      {items.map((it) => (
        <Card key={it.label} className="wl-summary-card">
          {it.icon}
          <div>
            <span className="metric-label">{it.label}</span>
            <span className={`wl-summary-val ${it.cls || ""}`}>{it.value}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
