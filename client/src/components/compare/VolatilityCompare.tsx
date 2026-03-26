import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid, ReferenceLine,
} from "recharts";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

interface Props {
  volData: Record<string, any>[];
  symbols: string[];
  stocks: CompareStock[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
  return (
    <div className="cmp-vol-tooltip">
      <div className="cmp-vol-tt-date">{label}</div>
      {sorted.map((p: any) => {
        const v = Number(p.value);
        const level = v > 40 ? "High" : v > 25 ? "Moderate" : "Low";
        const levelColor = v > 40 ? "var(--red)" : v > 25 ? "var(--yellow, #d97706)" : "var(--green)";
        return (
          <div key={p.name} className="cmp-vol-tt-row">
            <span className="cmp-vol-tt-dot" style={{ background: p.stroke }} />
            <span className="cmp-vol-tt-sym">{p.name}</span>
            <span className="cmp-vol-tt-val">{v.toFixed(1)}%</span>
            <span className="cmp-vol-tt-level" style={{ color: levelColor }}>{level}</span>
          </div>
        );
      })}
    </div>
  );
}

export function VolatilityCompare({ volData, symbols, stocks }: Props) {
  const [hoveredSym, setHoveredSym] = useState<string | null>(null);

  // Compute avg & current vol for badges
  const volStats = useMemo(() => {
    return stocks.map((s) => {
      const rv = s.rollingVolatility.filter((v) => v != null && !isNaN(v));
      const avg = rv.length ? rv.reduce((a, b) => a + b, 0) / rv.length : 0;
      const current = rv.length ? rv[rv.length - 1] : 0;
      const max = rv.length ? Math.max(...rv) : 0;
      return { symbol: s.symbol, avg, current, max };
    });
  }, [stocks]);

  // Overall average line
  const allVals = volData.flatMap((d) => symbols.map((s) => d[s]).filter((v) => v != null && !isNaN(v)));
  const overallAvg = allVals.length ? allVals.reduce((a: number, b: number) => a + b, 0) / allVals.length : 0;

  return (
    <Card title="Rolling Volatility (20-day, Annualized)">
      <div className="cmp-dd-equal-inner">
        <div className="cmp-vol-stats">
          {volStats.map((v, i) => (
            <div
              key={v.symbol}
              className={`cmp-vol-badge ${hoveredSym === v.symbol ? "cmp-vol-badge-active" : ""}`}
              onMouseEnter={() => setHoveredSym(v.symbol)}
              onMouseLeave={() => setHoveredSym(null)}
              style={{ borderLeftColor: COLORS[i % COLORS.length] }}
            >
              <span className="cmp-vol-sym" style={{ color: COLORS[i % COLORS.length] }}>{v.symbol}</span>
              <div className="cmp-vol-badge-details">
                <span>Avg: {v.avg.toFixed(1)}%</span>
                <span>Now: {v.current.toFixed(1)}%</span>
                <span>Peak: {v.max.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={volData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d?.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              onMouseEnter={(e: any) => setHoveredSym(e.value)}
              onMouseLeave={() => setHoveredSym(null)}
            />
            {overallAvg > 0 && (
              <ReferenceLine y={+overallAvg.toFixed(1)} stroke="#9ca3af" strokeDasharray="4 4"
                label={{ value: `Avg ${overallAvg.toFixed(0)}%`, fontSize: 9, fill: "#9ca3af" }} />
            )}
            {symbols.map((sym, i) => (
              <Line
                key={sym}
                dataKey={sym}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={hoveredSym === sym ? 3 : hoveredSym ? 0.8 : 1.5}
                strokeOpacity={hoveredSym && hoveredSym !== sym ? 0.25 : 1}
                dot={false}
                name={sym}
                animationDuration={400}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="cmp-note">Higher volatility = wider price swings. Hover a stock to isolate its line.</p>
      </div>
    </Card>
  );
}
