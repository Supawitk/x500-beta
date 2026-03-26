import { useMemo } from "react";
import { TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
  total: number;
}

export function ScreenerStats({ stocks, total }: Props) {
  const stats = useMemo(() => {
    if (stocks.length === 0) return null;
    const n = stocks.length;
    const advancers = stocks.filter(s => s.changePercent > 0).length;
    const decliners = stocks.filter(s => s.changePercent < 0).length;
    const avgChange = stocks.reduce((a, s) => a + s.changePercent, 0) / n;
    const avgPE = stocks.filter(s => s.peRatio).reduce((a, s) => a + (s.peRatio || 0), 0) /
      (stocks.filter(s => s.peRatio).length || 1);
    const avgDivYield = stocks.filter(s => s.dividendYield).reduce((a, s) => a + (s.dividendYield || 0), 0) /
      (stocks.filter(s => s.dividendYield).length || 1);
    const avgHealth = stocks.filter(s => s.healthScore).reduce((a, s) => a + (s.healthScore || 0), 0) /
      (stocks.filter(s => s.healthScore).length || 1);
    const totalCap = stocks.reduce((a, s) => a + s.marketCap, 0);

    return { n, advancers, decliners, avgChange, avgPE, avgDivYield, avgHealth, totalCap };
  }, [stocks]);

  if (!stats) return null;

  function fmtCap(v: number) {
    if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
    return `$${(v / 1e6).toFixed(0)}M`;
  }

  return (
    <div className="scr-stats">
      <div className="scr-stat">
        <BarChart3 size={13} />
        <span>Showing <strong>{stats.n}</strong> of {total}</span>
      </div>
      <div className="scr-stat">
        <TrendingUp size={13} className="text-green" />
        <span className="text-green">{stats.advancers}</span>
        <TrendingDown size={13} className="text-red" />
        <span className="text-red">{stats.decliners}</span>
      </div>
      <div className="scr-stat">
        <span>Avg Chg:</span>
        <span className={stats.avgChange >= 0 ? "text-green" : "text-red"}>
          {stats.avgChange >= 0 ? "+" : ""}{stats.avgChange.toFixed(2)}%
        </span>
      </div>
      <div className="scr-stat">
        <span>Avg P/E:</span>
        <span className="scr-mono">{stats.avgPE.toFixed(1)}</span>
      </div>
      <div className="scr-stat">
        <span>Avg Div:</span>
        <span className="text-green scr-mono">{(stats.avgDivYield * 100).toFixed(2)}%</span>
      </div>
      <div className="scr-stat">
        <Activity size={13} />
        <span>Avg Health:</span>
        <span className="scr-mono">{stats.avgHealth.toFixed(0)}</span>
      </div>
      <div className="scr-stat">
        <span>Total Cap:</span>
        <span className="scr-mono">{fmtCap(stats.totalCap)}</span>
      </div>
    </div>
  );
}
