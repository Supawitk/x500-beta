import { useMemo } from "react";
import { Card } from "../common/Card";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
}

interface Level {
  price: number;
  type: "support" | "resistance";
  strength: number; // 1-5 touches
  label: string;
}

interface FibLevel {
  ratio: number;
  price: number;
  label: string;
}

// ── Detect swing highs/lows ─────────────────────────────────────────────────
function findSwingPoints(data: AnalysisDataPoint[], lookback = 5) {
  const highs: { idx: number; price: number }[] = [];
  const lows: { idx: number; price: number }[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) isHigh = false;
      if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ idx: i, price: data[i].high });
    if (isLow) lows.push({ idx: i, price: data[i].low });
  }
  return { highs, lows };
}

// ── Cluster nearby prices into S/R levels ───────────────────────────────────
function clusterLevels(
  points: { price: number }[],
  type: "support" | "resistance",
  tolerance: number,
): Level[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: { prices: number[] }[] = [];
  let current = { prices: [sorted[0].price] };

  for (let i = 1; i < sorted.length; i++) {
    const avg = current.prices.reduce((a, b) => a + b, 0) / current.prices.length;
    if (Math.abs(sorted[i].price - avg) / avg < tolerance) {
      current.prices.push(sorted[i].price);
    } else {
      clusters.push(current);
      current = { prices: [sorted[i].price] };
    }
  }
  clusters.push(current);

  return clusters
    .filter(c => c.prices.length >= 1)
    .map(c => {
      const avg = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
      return {
        price: Math.round(avg * 100) / 100,
        type,
        strength: Math.min(5, c.prices.length),
        label: `${type === "support" ? "S" : "R"} $${avg.toFixed(2)}`,
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);
}

// ── Fibonacci retracement levels ────────────────────────────────────────────
function calcFibLevels(data: AnalysisDataPoint[]): FibLevel[] {
  if (data.length < 10) return [];

  // Find highest high and lowest low in the period
  let swingHigh = -Infinity, swingLow = Infinity;
  let highIdx = 0, lowIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].high > swingHigh) { swingHigh = data[i].high; highIdx = i; }
    if (data[i].low < swingLow) { swingLow = data[i].low; lowIdx = i; }
  }

  const isUptrend = lowIdx < highIdx;
  const diff = swingHigh - swingLow;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const labels = ["0%", "23.6%", "38.2%", "50%", "61.8%", "78.6%", "100%"];

  return ratios.map((r, i) => ({
    ratio: r,
    price: Math.round((isUptrend ? swingHigh - diff * r : swingLow + diff * r) * 100) / 100,
    label: labels[i],
  }));
}

// ── Pivot points (standard) ─────────────────────────────────────────────────
function calcPivotPoints(data: AnalysisDataPoint[]) {
  if (data.length < 2) return null;
  const prev = data[data.length - 2];
  const pp = (prev.high + prev.low + prev.close) / 3;
  return {
    pp: Math.round(pp * 100) / 100,
    r1: Math.round((2 * pp - prev.low) * 100) / 100,
    r2: Math.round((pp + (prev.high - prev.low)) * 100) / 100,
    s1: Math.round((2 * pp - prev.high) * 100) / 100,
    s2: Math.round((pp - (prev.high - prev.low)) * 100) / 100,
  };
}

const FIB_COLORS: Record<string, string> = {
  "0%": "#059669",
  "23.6%": "#10b981",
  "38.2%": "#34d399",
  "50%": "#d97706",
  "61.8%": "#f87171",
  "78.6%": "#ef4444",
  "100%": "#dc2626",
};

export function SupportResistancePanel({ data, symbol }: Props) {
  const { levels, fibLevels, pivots, chartData } = useMemo(() => {
    const { highs, lows } = findSwingPoints(data);
    const lastPrice = data[data.length - 1]?.close ?? 0;
    const tolerance = 0.015; // 1.5% cluster tolerance

    const resistanceLevels = clusterLevels(
      highs.filter(h => h.price > lastPrice),
      "resistance",
      tolerance,
    );
    const supportLevels = clusterLevels(
      lows.filter(l => l.price < lastPrice),
      "support",
      tolerance,
    );

    const fibLevels = calcFibLevels(data);
    const pivots = calcPivotPoints(data);

    const chartData = data.map(d => ({
      date: d.date.slice(5),
      close: d.close,
      high: d.high,
      low: d.low,
    }));

    return {
      levels: [...resistanceLevels, ...supportLevels],
      fibLevels,
      pivots,
      chartData,
    };
  }, [data]);

  const lastPrice = data[data.length - 1]?.close ?? 0;
  const allLevels = levels;
  const supports = allLevels.filter(l => l.type === "support").sort((a, b) => b.price - a.price);
  const resistances = allLevels.filter(l => l.type === "resistance").sort((a, b) => a.price - b.price);

  // Price range for chart
  const prices = data.map(d => d.close);
  const minP = Math.min(...prices) * 0.98;
  const maxP = Math.max(...prices) * 1.02;

  return (
    <Card title={`Support / Resistance & Fibonacci — ${symbol}`}>
      <div className="sr-grid">
        {/* Chart with levels */}
        <div className="sr-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={[minP, maxP]} tick={{ fontSize: 10 }} width={55}
                tickFormatter={v => `$${v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, ""]}
              />
              <Area dataKey="close" fill="#4f46e520" stroke="none" />
              <Line dataKey="close" stroke="#4f46e5" dot={false} strokeWidth={1.5} />

              {/* S/R lines */}
              {supports.map((s, i) => (
                <ReferenceLine key={`s${i}`} y={s.price} stroke="#059669" strokeDasharray="4 3"
                  strokeWidth={Math.min(2, s.strength)} label={{ value: `S $${s.price}`, position: "right", fontSize: 9, fill: "#059669" }} />
              ))}
              {resistances.map((r, i) => (
                <ReferenceLine key={`r${i}`} y={r.price} stroke="#dc2626" strokeDasharray="4 3"
                  strokeWidth={Math.min(2, r.strength)} label={{ value: `R $${r.price}`, position: "right", fontSize: 9, fill: "#dc2626" }} />
              ))}

              {/* Fibonacci levels */}
              {fibLevels.map((f, i) => (
                <ReferenceLine key={`f${i}`} y={f.price} stroke={FIB_COLORS[f.label] || "#6b7280"}
                  strokeDasharray="2 4" strokeWidth={0.8} opacity={0.6} />
              ))}

              {/* Current price */}
              <ReferenceLine y={lastPrice} stroke="#4f46e5" strokeWidth={1.5}
                label={{ value: `Now $${lastPrice.toFixed(2)}`, position: "left", fontSize: 10, fill: "#4f46e5" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Side panels */}
        <div className="sr-side">
          {/* S/R Levels */}
          <div className="sr-levels-block">
            <div className="sr-section-title">Key Levels</div>
            {resistances.length > 0 && resistances.map((r, i) => (
              <div key={`r${i}`} className="sr-level-row sr-resistance">
                <div className="sr-level-info">
                  <span className="sr-level-type">R{i + 1}</span>
                  <span className="sr-level-price">${r.price.toFixed(2)}</span>
                </div>
                <div className="sr-level-meta">
                  <span className="sr-level-dist" style={{ color: "#dc2626" }}>
                    +{((r.price - lastPrice) / lastPrice * 100).toFixed(1)}%
                  </span>
                  <div className="sr-strength">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <span key={j} className={`sr-dot ${j < r.strength ? "sr-dot-active-r" : ""}`} />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="sr-level-row sr-current">
              <span className="sr-level-type" style={{ color: "#4f46e5" }}>NOW</span>
              <span className="sr-level-price" style={{ color: "#4f46e5", fontWeight: 700 }}>${lastPrice.toFixed(2)}</span>
            </div>

            {supports.length > 0 && supports.map((s, i) => (
              <div key={`s${i}`} className="sr-level-row sr-support">
                <div className="sr-level-info">
                  <span className="sr-level-type">S{i + 1}</span>
                  <span className="sr-level-price">${s.price.toFixed(2)}</span>
                </div>
                <div className="sr-level-meta">
                  <span className="sr-level-dist" style={{ color: "#059669" }}>
                    {((s.price - lastPrice) / lastPrice * 100).toFixed(1)}%
                  </span>
                  <div className="sr-strength">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <span key={j} className={`sr-dot ${j < s.strength ? "sr-dot-active-s" : ""}`} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fibonacci */}
          <div className="sr-levels-block">
            <div className="sr-section-title">Fibonacci Retracement</div>
            {fibLevels.map((f, i) => {
              const isNear = Math.abs(f.price - lastPrice) / lastPrice < 0.015;
              return (
                <div key={i} className={`sr-fib-row ${isNear ? "sr-fib-near" : ""}`}>
                  <span className="sr-fib-label" style={{ color: FIB_COLORS[f.label] }}>{f.label}</span>
                  <span className="sr-fib-price">${f.price.toFixed(2)}</span>
                  <span className="sr-fib-dist" style={{ color: f.price > lastPrice ? "#dc2626" : "#059669" }}>
                    {((f.price - lastPrice) / lastPrice * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pivot Points */}
          {pivots && (
            <div className="sr-levels-block">
              <div className="sr-section-title">Pivot Points</div>
              <div className="sr-pivot-grid">
                <div className="sr-pivot-item" style={{ borderColor: "#dc2626" }}>
                  <span className="sr-pivot-label">R2</span>
                  <span className="sr-pivot-val">${pivots.r2.toFixed(2)}</span>
                </div>
                <div className="sr-pivot-item" style={{ borderColor: "#f87171" }}>
                  <span className="sr-pivot-label">R1</span>
                  <span className="sr-pivot-val">${pivots.r1.toFixed(2)}</span>
                </div>
                <div className="sr-pivot-item sr-pivot-pp" style={{ borderColor: "#4f46e5" }}>
                  <span className="sr-pivot-label">PP</span>
                  <span className="sr-pivot-val">${pivots.pp.toFixed(2)}</span>
                </div>
                <div className="sr-pivot-item" style={{ borderColor: "#34d399" }}>
                  <span className="sr-pivot-label">S1</span>
                  <span className="sr-pivot-val">${pivots.s1.toFixed(2)}</span>
                </div>
                <div className="sr-pivot-item" style={{ borderColor: "#059669" }}>
                  <span className="sr-pivot-label">S2</span>
                  <span className="sr-pivot-val">${pivots.s2.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
