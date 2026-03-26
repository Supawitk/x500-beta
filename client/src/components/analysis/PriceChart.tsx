import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
}

export function PriceChart({ data, symbol }: Props) {
  // Show last 120 points for readability
  const sliced = data.slice(-120);

  return (
    <Card title={`${symbol} Price & EMA`}>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={sliced}>
          <XAxis
            dataKey="date" tick={{ fontSize: 10 }}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis yAxisId="price" domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v: any, name: any) =>
              name === "Volume" ? `${(Number(v) / 1e6).toFixed(1)}M` : Number(v)?.toFixed(2)
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="volume" yAxisId="vol" fill="#e5e7eb" name="Volume" />
          <Line dataKey="close" yAxisId="price" stroke="#1f2937" dot={false}
            strokeWidth={2} name="Close" />
          <Line dataKey="ema12" yAxisId="price" stroke="#4f46e5" dot={false}
            strokeWidth={1} name="EMA 12" strokeDasharray="2 2" />
          <Line dataKey="ema26" yAxisId="price" stroke="#0891b2" dot={false}
            strokeWidth={1} name="EMA 26" />
          <Line dataKey="ema50" yAxisId="price" stroke="#d97706" dot={false}
            strokeWidth={1} name="EMA 50" />
          <Line dataKey="regressionLine" yAxisId="price" stroke="#dc2626" dot={false}
            strokeWidth={1} strokeDasharray="6 3" name="Regression" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
