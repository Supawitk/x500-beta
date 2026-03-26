import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

interface Props {
  stocks: CompareStock[];
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
}

export function RiskCompare({ stocks }: Props) {
  // Bar chart data for key risk metrics
  const metricDefs = [
    { key: "sharpe", label: "Sharpe", get: (s: CompareStock) => s.risk.sharpe },
    { key: "sortino", label: "Sortino", get: (s: CompareStock) => s.risk.sortino },
    { key: "volatility", label: "Volatility %", get: (s: CompareStock) => s.risk.volatility },
    { key: "winRate", label: "Win Rate %", get: (s: CompareStock) => s.risk.winRate },
    { key: "beta", label: "Beta", get: (s: CompareStock) => s.marketBeta },
    { key: "rSquared", label: "R²", get: (s: CompareStock) => s.regression.rSquared },
  ];

  const barData = metricDefs.map(m => {
    const point: Record<string, any> = { metric: m.label };
    stocks.forEach(s => { point[s.symbol] = m.get(s); });
    return point;
  });

  // Radar for risk profile
  const radarMetrics = [
    { label: "Return", get: (s: CompareStock) => s.totalReturn },
    { label: "Sharpe", get: (s: CompareStock) => s.risk.sharpe },
    { label: "Win Rate", get: (s: CompareStock) => s.risk.winRate },
    { label: "Low Vol", get: (s: CompareStock) => 100 - Math.min(s.risk.volatility, 100) },
    { label: "Low Beta", get: (s: CompareStock) => Math.max(0, 100 - s.marketBeta * 50) },
    { label: "Trend R²", get: (s: CompareStock) => s.regression.rSquared * 100 },
  ];

  const radarData = radarMetrics.map(m => {
    const vals = stocks.map(s => m.get(s));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const point: Record<string, any> = { metric: m.label };
    stocks.forEach(s => { point[s.symbol] = Math.round(normalize(m.get(s), min - 1, max + 1)); });
    return point;
  });

  return (
    <Card title="Risk & Performance Profile">
      <div className="cmp-risk-grid">
        {/* Stat cards */}
        <div className="cmp-risk-stats">
          {stocks.map((s, i) => (
            <div key={s.symbol} className="cmp-risk-card" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
              <div className="cmp-risk-sym" style={{ color: COLORS[i % COLORS.length] }}>{s.symbol}</div>
              <div className="cmp-risk-row">
                <span>Sharpe</span><span className="cmp-risk-val">{s.risk.sharpe.toFixed(2)}</span>
              </div>
              <div className="cmp-risk-row">
                <span>Sortino</span><span className="cmp-risk-val">{s.risk.sortino.toFixed(2)}</span>
              </div>
              <div className="cmp-risk-row">
                <span>Volatility</span><span className="cmp-risk-val">{s.risk.volatility.toFixed(1)}%</span>
              </div>
              <div className="cmp-risk-row">
                <span>Win Rate</span><span className="cmp-risk-val">{s.risk.winRate.toFixed(1)}%</span>
              </div>
              <div className="cmp-risk-row">
                <span>Avg Win</span><span className="cmp-risk-val" style={{ color: "#059669" }}>+{s.risk.avgWin.toFixed(2)}%</span>
              </div>
              <div className="cmp-risk-row">
                <span>Avg Loss</span><span className="cmp-risk-val" style={{ color: "#dc2626" }}>{s.risk.avgLoss.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Grouped bar chart */}
        <div className="cmp-chart-wrap">
          <h5 className="cmp-chart-title">Metric Comparison</h5>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="20%">
              <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {stocks.map((s, i) => (
                <Bar shape={SafeBarShape} key={s.symbol} dataKey={s.symbol} fill={COLORS[i % COLORS.length]}
                  radius={[3, 3, 0, 0]} opacity={0.85} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk radar */}
        <div className="cmp-chart-wrap">
          <h5 className="cmp-chart-title">Risk Profile Radar</h5>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {stocks.map((s, i) => (
                <Radar key={s.symbol} name={s.symbol} dataKey={s.symbol}
                  stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.12} strokeWidth={2} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
