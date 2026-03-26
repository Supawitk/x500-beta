import { useState } from "react";
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, CartesianGrid,
} from "recharts";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

interface Props {
  drawdownData: Record<string, any>[];
  symbols: string[];
  stocks: CompareStock[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a: any, b: any) => a.value - b.value);
  return (
    <div className="cmp-dd-tooltip">
      <div className="cmp-dd-tt-date">{label}</div>
      {sorted.map((p: any) => (
        <div key={p.name} className="cmp-dd-tt-row">
          <span className="cmp-dd-tt-dot" style={{ background: p.stroke }} />
          <span className="cmp-dd-tt-sym">{p.name}</span>
          <span className="cmp-dd-tt-val" style={{ color: Number(p.value) < -10 ? "var(--red)" : "var(--text)" }}>
            {Number(p.value).toFixed(2)}%
          </span>
        </div>
      ))}
      {sorted.length > 1 && (
        <div className="cmp-dd-tt-spread">
          Spread: {(sorted[sorted.length - 1].value - sorted[0].value).toFixed(2)}pp
        </div>
      )}
    </div>
  );
}

export function DrawdownCompare({ drawdownData, symbols, stocks }: Props) {
  const [hoveredSym, setHoveredSym] = useState<string | null>(null);

  const maxDD = stocks.map((s) => {
    const min = Math.min(...s.drawdown);
    const currentDD = s.drawdown[s.drawdown.length - 1] ?? 0;
    return { symbol: s.symbol, maxDrawdown: min, currentDD };
  });

  return (
    <Card title="Drawdown Analysis">
      <div className="cmp-dd-equal-inner">
        <div className="cmp-dd-stats">
          {maxDD.map((d, i) => (
            <div
              key={d.symbol}
              className={`cmp-dd-badge ${hoveredSym === d.symbol ? "cmp-dd-badge-active" : ""}`}
              onMouseEnter={() => setHoveredSym(d.symbol)}
              onMouseLeave={() => setHoveredSym(null)}
              style={{ borderLeftColor: COLORS[i % COLORS.length] }}
            >
              <span className="cmp-dd-sym" style={{ color: COLORS[i % COLORS.length] }}>{d.symbol}</span>
              <div className="cmp-dd-badge-details">
                <span className="cmp-dd-val">Max: {d.maxDrawdown.toFixed(1)}%</span>
                <span className="cmp-dd-current">Now: {d.currentDD.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={drawdownData}>
            <defs>
              {symbols.map((sym, i) => (
                <linearGradient key={sym} id={`dd-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d?.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              onMouseEnter={(e: any) => setHoveredSym(e.value)}
              onMouseLeave={() => setHoveredSym(null)}
            />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <ReferenceLine y={-10} stroke="#fbbf2480" strokeDasharray="4 4" label={{ value: "-10%", fontSize: 9, fill: "#d97706" }} />
            <ReferenceLine y={-20} stroke="#ef444480" strokeDasharray="4 4" label={{ value: "-20%", fontSize: 9, fill: "#dc2626" }} />
            {symbols.map((sym, i) => (
              <Area
                key={sym}
                dataKey={sym}
                stroke={COLORS[i % COLORS.length]}
                fill={`url(#dd-grad-${i})`}
                strokeWidth={hoveredSym === sym ? 3 : hoveredSym ? 0.8 : 1.5}
                strokeOpacity={hoveredSym && hoveredSym !== sym ? 0.3 : 1}
                fillOpacity={hoveredSym === sym ? 0.25 : hoveredSym ? 0.02 : 0.08}
                dot={false}
                name={sym}
                animationDuration={400}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        <p className="cmp-note">Drawdown measures peak-to-trough decline. Shallower = more resilient. Hover lines to compare.</p>
      </div>
    </Card>
  );
}
