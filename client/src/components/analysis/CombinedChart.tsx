import { useState, useMemo } from "react";
import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
}

type Toggle = {
  ema12: boolean; ema26: boolean; ema50: boolean; ema200: boolean;
  volume: boolean; macd: boolean; rsi: boolean; stoch: boolean; fibonacci: boolean;
  regression: boolean;
};

const TOGGLES: { key: keyof Toggle; label: string; color: string }[] = [
  { key: "volume",    label: "Volume",    color: "#9ca3af" },
  { key: "ema12",     label: "EMA 12",    color: "#4f46e5" },
  { key: "ema26",     label: "EMA 26",    color: "#0891b2" },
  { key: "ema50",     label: "EMA 50",    color: "#d97706" },
  { key: "ema200",    label: "EMA 200",   color: "#dc2626" },
  { key: "regression",label: "Regression",color: "#7c3aed" },
  { key: "fibonacci", label: "Fibonacci", color: "#059669" },
  { key: "macd",      label: "MACD",      color: "#4f46e5" },
  { key: "rsi",       label: "RSI",       color: "#7c3aed" },
  { key: "stoch",     label: "Stochastic",color: "#0891b2" },
];

/** Fibonacci retracement levels from the visible data range */
function calcFibonacci(data: AnalysisDataPoint[]) {
  if (data.length < 2) return null;
  const highs = data.map((d) => d.high).filter(isFinite);
  const lows  = data.map((d) => d.low).filter(isFinite);
  const swingHigh = Math.max(...highs);
  const swingLow  = Math.min(...lows);
  const diff = swingHigh - swingLow;
  if (diff <= 0) return null;
  return {
    swingHigh, swingLow,
    "0.0%":   swingHigh,
    "23.6%":  swingHigh - diff * 0.236,
    "38.2%":  swingHigh - diff * 0.382,
    "50.0%":  swingHigh - diff * 0.5,
    "61.8%":  swingHigh - diff * 0.618,
    "78.6%":  swingHigh - diff * 0.786,
    "100%":   swingLow,
  };
}

const FIB_COLORS: Record<string, string> = {
  "0.0%": "#6b7280", "23.6%": "#059669", "38.2%": "#10b981",
  "50.0%": "#d97706", "61.8%": "#f59e0b", "78.6%": "#dc2626", "100%": "#6b7280",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((p: any) => p.value != null);
  return (
    <div className="chart-tooltip" style={{ maxWidth: 220 }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, color: "#6b7280" }}>{label}</div>
      {entries.map((p: any) => (
        <div key={p.name} style={{ color: p.color, fontSize: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "monospace" }}>
            {typeof p.value === "number"
              ? p.name === "Volume" ? `${(p.value / 1e6).toFixed(1)}M`
              : p.value.toFixed(2)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CombinedChart({ data, symbol }: Props) {
  const [show, setShow] = useState<Toggle>({
    ema12: true, ema26: true, ema50: true, ema200: false,
    volume: true, macd: true, rsi: true, stoch: true,
    fibonacci: false, regression: true,
  });

  const toggle = (key: keyof Toggle) =>
    setShow((s) => ({ ...s, [key]: !s[key] }));

  // Last 120 points for readability
  const sliced = useMemo(() => data.slice(-120), [data]);
  const fib    = useMemo(() => show.fibonacci ? calcFibonacci(sliced) : null, [sliced, show.fibonacci]);

  const subPanes = [
    show.macd  && "macd",
    show.rsi   && "rsi",
    show.stoch && "stoch",
  ].filter(Boolean) as string[];

  const paneCount = 1 + subPanes.length;
  const mainH     = paneCount === 1 ? 420 : paneCount === 2 ? 320 : paneCount === 3 ? 280 : 240;
  const subH      = 160;

  return (
    <Card title={`${symbol} — Combined Chart`}>
      {/* Indicator toggle buttons */}
      <div className="chart-toggles">
        {TOGGLES.map(({ key, label, color }) => (
          <button
            key={key}
            className={`toggle-btn ${show[key] ? "active" : ""}`}
            style={show[key] ? { borderColor: color, color, background: color + "18" } : {}}
            onClick={() => toggle(key)}
          >
            <span className="toggle-dot" style={{ background: show[key] ? color : "#d1d5db" }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Main price pane ── */}
      <div style={{ marginTop: 8 }}>
        <ResponsiveContainer width="100%" height={mainH}>
          <ComposedChart data={sliced} syncId="chart-sync" margin={{ right: 16, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)}
              xAxisId="main" />
            <YAxis yAxisId="price" domain={["auto", "auto"]} tick={{ fontSize: 10 }}
              tickFormatter={(v) => `$${v.toFixed(0)}`} width={54} />
            {show.volume && (
              <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 9 }}
                tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={44} />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />

            {/* Volume bars */}
            {show.volume && (
              <Bar dataKey="volume" yAxisId="vol" xAxisId="main"
                name="Volume" fill="#e5e7eb" opacity={0.5}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const c = (payload.close ?? 0) >= (payload.open ?? 0) ? "#bbf7d0" : "#fecaca";
                  return <rect x={x} y={y} width={Math.max(width, 1)} height={height} fill={c} />;
                }}
              />
            )}

            {/* Close price (always on) */}
            <Line dataKey="close" yAxisId="price" xAxisId="main"
              stroke="#1f2937" dot={false} strokeWidth={2} name="Close" />

            {/* EMA lines */}
            {show.ema12 && (
              <Line dataKey="ema12" yAxisId="price" xAxisId="main"
                stroke="#4f46e5" dot={false} strokeWidth={1.2} name="EMA 12"
                strokeDasharray="3 2" connectNulls />
            )}
            {show.ema26 && (
              <Line dataKey="ema26" yAxisId="price" xAxisId="main"
                stroke="#0891b2" dot={false} strokeWidth={1.2} name="EMA 26" connectNulls />
            )}
            {show.ema50 && (
              <Line dataKey="ema50" yAxisId="price" xAxisId="main"
                stroke="#d97706" dot={false} strokeWidth={1.5} name="EMA 50" connectNulls />
            )}
            {show.ema200 && (
              <Line dataKey="ema200" yAxisId="price" xAxisId="main"
                stroke="#dc2626" dot={false} strokeWidth={1.5} name="EMA 200" connectNulls />
            )}
            {show.regression && (
              <Line dataKey="regressionLine" yAxisId="price" xAxisId="main"
                stroke="#7c3aed" dot={false} strokeWidth={1}
                strokeDasharray="6 3" name="Regression" connectNulls />
            )}

            {/* Fibonacci reference lines */}
            {fib && Object.entries(fib)
              .filter(([k]) => k.includes("%"))
              .map(([label, val]) => (
                <ReferenceLine key={label} y={val as number} yAxisId="price" xAxisId="main"
                  stroke={FIB_COLORS[label]} strokeDasharray="4 4" strokeOpacity={0.7}
                  label={{ value: `Fib ${label} $${(val as number).toFixed(0)}`,
                    position: "insideRight", fontSize: 9, fill: FIB_COLORS[label] }} />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── MACD sub-pane ── */}
      {show.macd && (
        <div>
          <div className="sub-pane-label">MACD (12, 26, 9)</div>
          <ResponsiveContainer width="100%" height={subH}>
            <ComposedChart data={sliced} syncId="chart-sync" margin={{ right: 16, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 9 }} width={44} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#e5e7eb" />
              <Bar dataKey="macdHist" name="Histogram"
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const col = (payload.macdHist ?? 0) >= 0 ? "#bbf7d0" : "#fecaca";
                  return <rect x={x} y={y} width={Math.max(width, 1)} height={height} fill={col} />;
                }}
              />
              <Line dataKey="macd" stroke="#4f46e5" dot={false} strokeWidth={1.5} name="MACD" />
              <Line dataKey="macdSignal" stroke="#dc2626" dot={false} strokeWidth={1}
                strokeDasharray="3 3" name="Signal" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── RSI sub-pane ── */}
      {show.rsi && (
        <div>
          <div className="sub-pane-label">RSI (14)</div>
          <ResponsiveContainer width="100%" height={subH}>
            <ComposedChart data={sliced} syncId="chart-sync" margin={{ right: 16, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis domain={[0, 100]} ticks={[20, 30, 50, 70, 80]} tick={{ fontSize: 9 }} width={44} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="3 3"
                label={{ value: "70 OB", position: "insideRight", fontSize: 9, fill: "#dc2626" }} />
              <ReferenceLine y={30} stroke="#059669" strokeDasharray="3 3"
                label={{ value: "30 OS", position: "insideRight", fontSize: 9, fill: "#059669" }} />
              <Area dataKey="rsi" stroke="#7c3aed" fill="#ede9fe" fillOpacity={0.3}
                dot={false} strokeWidth={1.5} name="RSI" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Stochastic sub-pane ── */}
      {show.stoch && (
        <div>
          <div className="sub-pane-label">Stochastic (14, 3, 3)</div>
          <ResponsiveContainer width="100%" height={subH}>
            <ComposedChart data={sliced} syncId="chart-sync" margin={{ right: 16, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis domain={[0, 100]} ticks={[20, 50, 80]} tick={{ fontSize: 9 }} width={44} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="3 3"
                label={{ value: "80", position: "insideRight", fontSize: 9, fill: "#dc2626" }} />
              <ReferenceLine y={20} stroke="#059669" strokeDasharray="3 3"
                label={{ value: "20", position: "insideRight", fontSize: 9, fill: "#059669" }} />
              <Line dataKey="stochK" stroke="#4f46e5" dot={false} strokeWidth={1.5} name="%K" />
              <Line dataKey="stochD" stroke="#dc2626" dot={false} strokeWidth={1}
                strokeDasharray="3 3" name="%D" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Fibonacci table when active */}
      {fib && (
        <div className="fib-table">
          <span className="metric-label">Fibonacci Retracement — {sliced[0]?.date} to {sliced[sliced.length - 1]?.date}</span>
          <div className="fib-levels">
            {Object.entries(fib).filter(([k]) => k.includes("%")).map(([label, val]) => (
              <div key={label} className="fib-row">
                <span className="fib-label" style={{ color: FIB_COLORS[label] }}>{label}</span>
                <span className="fib-price">${(val as number).toFixed(2)}</span>
                <div className="fib-bar-track">
                  <div className="fib-bar-fill" style={{
                    width: `${((val as number) - fib.swingLow) / (fib.swingHigh - fib.swingLow) * 100}%`,
                    background: FIB_COLORS[label],
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
