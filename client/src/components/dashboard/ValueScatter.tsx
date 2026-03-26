import { useState, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ZAxis, Cell,
} from "recharts";
import { Card } from "../common/Card";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
  onSelectStock?: (sym: string) => void;
}

type MetricKey = "peRatio" | "dividendYield" | "marginOfSafety" | "healthScore" | "price" | "changePercent" | "beta" | "marketCap";

const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: "peRatio", label: "P/E Ratio", fmt: (v) => v.toFixed(1) },
  { key: "dividendYield", label: "Dividend Yield %", fmt: (v) => (v * 100).toFixed(2) + "%" },
  { key: "marginOfSafety", label: "Margin of Safety %", fmt: (v) => v.toFixed(1) + "%" },
  { key: "healthScore", label: "Health Score", fmt: (v) => v.toFixed(0) },
  { key: "price", label: "Price", fmt: (v) => "$" + v.toFixed(2) },
  { key: "changePercent", label: "Change %", fmt: (v) => v.toFixed(2) + "%" },
  { key: "beta", label: "Beta", fmt: (v) => v.toFixed(2) },
  { key: "marketCap", label: "Market Cap ($B)", fmt: (v) => (v / 1e9).toFixed(1) + "B" },
];

const COLORS_BY_SECTOR: Record<string, string> = {
  "Technology": "#4f46e5", "Healthcare": "#059669", "Financial Services": "#d97706",
  "Consumer Cyclical": "#dc2626", "Consumer Defensive": "#7c3aed", "Energy": "#0891b2",
  "Industrials": "#84cc16", "Utilities": "#db2777", "Real Estate": "#f59e0b",
  "Communication Services": "#6366f1", "Basic Materials": "#14b8a6",
};

function getVal(s: StockQuote, key: MetricKey): number | null {
  const v = s[key];
  return typeof v === "number" ? v : null;
}

export function ValueScatter({ stocks, onSelectStock }: Props) {
  const [xKey, setXKey] = useState<MetricKey>("peRatio");
  const [yKey, setYKey] = useState<MetricKey>("dividendYield");
  const [sizeKey, setSizeKey] = useState<MetricKey>("marketCap");
  const [sectorFilter, setSectorFilter] = useState("");
  const [colorBy, setColorBy] = useState<"sector" | "margin">("sector");

  const sectors = useMemo(() => [...new Set(stocks.map((s) => s.sector))].sort(), [stocks]);

  const data = useMemo(() => {
    let filtered = stocks.filter((s) => getVal(s, xKey) !== null && getVal(s, yKey) !== null);
    if (sectorFilter) filtered = filtered.filter((s) => s.sector === sectorFilter);
    return filtered.map((s) => ({
      x: getVal(s, xKey)!,
      y: yKey === "dividendYield" ? (getVal(s, yKey)! * 100) : getVal(s, yKey)!,
      z: Math.max(Math.abs(getVal(s, sizeKey) ?? 1), 1),
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      margin: s.marginOfSafety,
      color: colorBy === "sector"
        ? (COLORS_BY_SECTOR[s.sector] || "#6b7280")
        : ((s.marginOfSafety ?? 0) > 0 ? "#059669" : "#dc2626"),
    }));
  }, [stocks, xKey, yKey, sizeKey, sectorFilter, colorBy]);

  const xMeta = METRICS.find((m) => m.key === xKey)!;
  const yMeta = METRICS.find((m) => m.key === yKey)!;

  return (
    <Card title="Value Map — Interactive Scatter">
      <div className="scatter-controls">
        <label>X: <select value={xKey} onChange={(e) => setXKey(e.target.value as MetricKey)}>
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select></label>
        <label>Y: <select value={yKey} onChange={(e) => setYKey(e.target.value as MetricKey)}>
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select></label>
        <label>Size: <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value as MetricKey)}>
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select></label>
        <label>Color: <select value={colorBy} onChange={(e) => setColorBy(e.target.value as "sector" | "margin")}>
          <option value="sector">By Sector</option>
          <option value="margin">By Value (MoS)</option>
        </select></label>
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
          <option value="">All Sectors ({data.length})</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart>
          <XAxis dataKey="x" name={xMeta.label} type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="y" name={yMeta.label} type="number" tick={{ fontSize: 11 }} />
          <ZAxis dataKey="z" range={[30, 300]} />
          <Tooltip content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="chart-tooltip">
                <strong>{d.symbol}</strong> — {d.name}
                <p>{xMeta.label}: {xMeta.fmt(d.x)}</p>
                <p>{yMeta.label}: {yMeta.fmt(d.y)}</p>
                <p>Sector: {d.sector}</p>
                <p>Margin: {d.margin?.toFixed(1) ?? "N/A"}%</p>
              </div>
            );
          }} />
          <Scatter data={data} onClick={(d: any) => onSelectStock?.(d.symbol)}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.7} cursor="pointer" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {colorBy === "sector" && (
        <div className="scatter-legend">
          {Object.entries(COLORS_BY_SECTOR).map(([s, c]) => (
            <span key={s} className="scatter-legend-item">
              <span className="legend-dot" style={{ background: c }} />{s}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
