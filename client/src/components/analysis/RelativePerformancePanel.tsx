import { useState, useEffect } from "react";
import { Card } from "../common/Card";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  symbol: string;
  period: string;
}

interface BenchmarkData {
  symbol: string;
  data: { date: string; stock: number; spy: number }[];
  stockReturn: number;
  spyReturn: number;
  alpha: number;
}

export function RelativePerformancePanel({ symbol, period }: Props) {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analysis/benchmark/${symbol}?period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, period]);

  if (loading && !data) return null;
  if (!data || data.data.length === 0) return null;

  const alphaPositive = data.alpha >= 0;
  const chartData = data.data.map(d => ({
    ...d,
    date: d.date.slice(5),
    spread: Math.round((d.stock - d.spy) * 100) / 100,
  }));

  return (
    <Card title={`Relative Performance — ${symbol} vs S&P 500`}>
      <div className="rp-summary">
        <div className="rp-summary-card">
          <span className="rp-summary-label">{symbol}</span>
          <span className="rp-summary-val" style={{ color: data.stockReturn >= 0 ? "#059669" : "#dc2626" }}>
            {data.stockReturn >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {data.stockReturn >= 0 ? "+" : ""}{data.stockReturn.toFixed(2)}%
          </span>
        </div>
        <div className="rp-summary-card">
          <span className="rp-summary-label">S&P 500 (SPY)</span>
          <span className="rp-summary-val" style={{ color: data.spyReturn >= 0 ? "#059669" : "#dc2626" }}>
            {data.spyReturn >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {data.spyReturn >= 0 ? "+" : ""}{data.spyReturn.toFixed(2)}%
          </span>
        </div>
        <div className={`rp-summary-card rp-alpha ${alphaPositive ? "rp-alpha-pos" : "rp-alpha-neg"}`}>
          <span className="rp-summary-label">Alpha</span>
          <span className="rp-summary-val">
            {alphaPositive ? "+" : ""}{data.alpha.toFixed(2)}%
          </span>
          <span className="rp-summary-sub">
            {alphaPositive ? "Outperforming" : "Underperforming"} market
          </span>
        </div>
      </div>

      <div className="rp-chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={45} tickFormatter={v => `${v.toFixed(0)}%`} />
            <YAxis yAxisId="spread" orientation="right" tick={{ fontSize: 9 }} width={40}
              tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, name: string) => [
                `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
                name === "stock" ? symbol : name === "spy" ? "SPY" : "Alpha Spread",
              ]}
            />
            <Legend
              formatter={(value: string) => value === "stock" ? symbol : value === "spy" ? "SPY" : "Alpha"}
              wrapperStyle={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />

            {/* Alpha spread area */}
            <Area yAxisId="spread" dataKey="spread" fill={alphaPositive ? "#05966915" : "#dc262615"}
              stroke="none" />

            {/* Stock line */}
            <Line dataKey="stock" stroke="#4f46e5" strokeWidth={2} dot={false} />
            {/* SPY line */}
            <Line dataKey="spy" stroke="#d97706" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Performance comparison table */}
      <div className="rp-table">
        <div className="rp-table-row rp-table-header">
          <span>Metric</span>
          <span>{symbol}</span>
          <span>SPY</span>
          <span>Diff</span>
        </div>
        {[
          { label: "Total Return", stock: data.stockReturn, spy: data.spyReturn },
        ].map(({ label, stock, spy }) => {
          const diff = stock - spy;
          return (
            <div key={label} className="rp-table-row">
              <span className="rp-table-label">{label}</span>
              <span style={{ color: stock >= 0 ? "#059669" : "#dc2626" }}>
                {stock >= 0 ? "+" : ""}{stock.toFixed(2)}%
              </span>
              <span style={{ color: spy >= 0 ? "#059669" : "#dc2626" }}>
                {spy >= 0 ? "+" : ""}{spy.toFixed(2)}%
              </span>
              <span style={{ color: diff >= 0 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                {diff >= 0 ? "+" : ""}{diff.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
