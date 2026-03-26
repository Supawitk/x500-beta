import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip,
} from "recharts";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed"];

interface Props {
  stocks: CompareStock[];
}

function normalize(val: number | null, min: number, max: number): number {
  if (val === null) return 0;
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
}

export function RadarCompare({ stocks }: Props) {
  // Build radar data - normalize each metric to 0-100
  const metrics = [
    { key: "dividendYield", label: "Dividend", extract: (s: CompareStock) => (s.quote?.dividendYield ?? 0) * 100 },
    { key: "healthScore", label: "Health", extract: (s: CompareStock) => s.quote?.healthScore ?? 0 },
    { key: "returnVal", label: "Return", extract: (s: CompareStock) => Math.max(0, s.totalReturn + 30) },
    { key: "margin", label: "Value (MoS)", extract: (s: CompareStock) => Math.max(0, (s.quote?.marginOfSafety ?? -50) + 50) },
    { key: "growth", label: "Growth", extract: (s: CompareStock) => Math.max(0, ((s.detail?.revenueGrowth ?? 0) * 100) + 10) },
    { key: "profitability", label: "Profit Margin", extract: (s: CompareStock) => (s.detail?.profitMargins ?? 0) * 100 },
  ];

  const data = metrics.map((m) => {
    const values = stocks.map((s) => m.extract(s));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const point: Record<string, any> = { metric: m.label };
    stocks.forEach((s) => {
      point[s.symbol] = Math.round(normalize(m.extract(s), min - 1, max + 1));
    });
    return point;
  });

  return (
    <Card title="Radar Comparison">
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {stocks.map((s, i) => (
            <Radar
              key={s.symbol} name={s.symbol} dataKey={s.symbol}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
