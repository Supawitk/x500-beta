import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
}

export function IchimokuChart({ data, symbol }: Props) {
  const last = data[data.length - 1];

  // Determine signal interpretations
  const priceVsCloud = (() => {
    if (!last || last.ichimokuSpanA === null || last.ichimokuSpanB === null)
      return { label: "N/A", bullish: false, bearish: false };
    const top = Math.max(last.ichimokuSpanA, last.ichimokuSpanB);
    const bottom = Math.min(last.ichimokuSpanA, last.ichimokuSpanB);
    if (last.close > top) return { label: "Above Cloud", bullish: true, bearish: false };
    if (last.close < bottom) return { label: "Below Cloud", bullish: false, bearish: true };
    return { label: "Inside Cloud", bullish: false, bearish: false };
  })();

  const tkCross = (() => {
    if (!last || last.ichimokuTenkan === null || last.ichimokuKijun === null)
      return { label: "N/A", bullish: false, bearish: false };
    if (last.ichimokuTenkan > last.ichimokuKijun)
      return { label: "Tenkan > Kijun (Bullish)", bullish: true, bearish: false };
    if (last.ichimokuTenkan < last.ichimokuKijun)
      return { label: "Tenkan < Kijun (Bearish)", bullish: false, bearish: true };
    return { label: "Tenkan = Kijun", bullish: false, bearish: false };
  })();

  const cloudColor = (() => {
    if (!last || last.ichimokuSpanA === null || last.ichimokuSpanB === null)
      return { label: "N/A", bullish: false, bearish: false };
    if (last.ichimokuSpanA > last.ichimokuSpanB)
      return { label: "Green (Bullish)", bullish: true, bearish: false };
    return { label: "Red (Bearish)", bullish: false, bearish: true };
  })();

  const futureCloud = (() => {
    // Check the trend of spanA vs spanB over last 5 data points
    const recent = data.slice(-5);
    const diffs = recent
      .filter((d) => d.ichimokuSpanA !== null && d.ichimokuSpanB !== null)
      .map((d) => d.ichimokuSpanA! - d.ichimokuSpanB!);
    if (diffs.length < 2) return { label: "N/A", bullish: false, bearish: false };
    const trend = diffs[diffs.length - 1] - diffs[0];
    if (trend > 0) return { label: "Expanding Bullish", bullish: true, bearish: false };
    if (trend < 0) return { label: "Expanding Bearish", bullish: false, bearish: true };
    return { label: "Flat", bullish: false, bearish: false };
  })();

  const signals = [
    { title: "Price vs Cloud", ...priceVsCloud },
    { title: "TK Cross", ...tkCross },
    { title: "Cloud Color", ...cloudColor },
    { title: "Future Cloud", ...futureCloud },
  ];

  // Compute Y domain from price and cloud values
  const values = data.flatMap((d) =>
    [d.close, d.ichimokuTenkan, d.ichimokuKijun, d.ichimokuSpanA, d.ichimokuSpanB, d.ichimokuChikou]
      .filter((v): v is number => v !== null)
  );
  const yMin = values.length ? Math.floor(Math.min(...values) * 0.995) : 0;
  const yMax = values.length ? Math.ceil(Math.max(...values) * 1.005) : 100;

  return (
    <Card title={`${symbol} Ichimoku Cloud`}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number | null) =>
              value !== null ? value.toFixed(2) : "N/A"
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* Cloud: Span A area */}
          <Area
            type="monotone"
            dataKey="ichimokuSpanA"
            name="Span A"
            stroke="#22c55e"
            fill="rgba(34,197,94,0.3)"
            strokeWidth={1}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {/* Cloud: Span B area */}
          <Area
            type="monotone"
            dataKey="ichimokuSpanB"
            name="Span B"
            stroke="#ef4444"
            fill="rgba(239,68,68,0.3)"
            strokeWidth={1}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Price */}
          <Line
            type="monotone"
            dataKey="close"
            name="Price"
            stroke="#1f2937"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          {/* Tenkan-sen */}
          <Line
            type="monotone"
            dataKey="ichimokuTenkan"
            name="Tenkan"
            stroke="#2563eb"
            strokeWidth={1}
            dot={false}
            connectNulls
          />
          {/* Kijun-sen */}
          <Line
            type="monotone"
            dataKey="ichimokuKijun"
            name="Kijun"
            stroke="#dc2626"
            strokeWidth={1}
            dot={false}
            connectNulls
          />
          {/* Chikou Span */}
          <Line
            type="monotone"
            dataKey="ichimokuChikou"
            name="Chikou"
            stroke="#a855f7"
            strokeWidth={1}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="ichi-signals">
        {signals.map((s) => (
          <div className="ichi-signal-card" key={s.title}>
            <span className="ichi-signal-label">{s.title}</span>
            <span
              className={
                s.bullish
                  ? "ichi-cloud-bullish"
                  : s.bearish
                    ? "ichi-cloud-bearish"
                    : ""
              }
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
