import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { Card } from "../common/Card";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed"];

interface Props {
  chartData: Record<string, any>[];
  symbols: string[];
}

export function PriceOverlay({ chartData, symbols }: Props) {
  return (
    <Card title="Normalized Price Comparison (% Return)">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v: any) => `${Number(v).toFixed(2)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
          <Line
            dataKey="SPY" stroke="#9ca3af" dot={false}
            strokeWidth={2} strokeDasharray="6 3" name="S&P 500 (SPY)"
          />
          {symbols.map((sym, i) => (
            <Line
              key={sym} dataKey={sym} stroke={COLORS[i % COLORS.length]}
              dot={false} strokeWidth={2} name={sym}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
