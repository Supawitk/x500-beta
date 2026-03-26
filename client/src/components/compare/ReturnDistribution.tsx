import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, ReferenceLine,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

interface Props {
  stocks: CompareStock[];
}

export function ReturnDistribution({ stocks }: Props) {
  const [selected, setSelected] = useState(0);
  const s = stocks[selected];

  // Box plot stats
  const boxStats = useMemo(() => {
    return stocks.map(st => {
      const rets = st.returnDistribution.flatMap(d =>
        Array(d.count).fill(d.bin)
      ).sort((a, b) => a - b);
      const n = rets.length;
      if (n === 0) return { symbol: st.symbol, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
      return {
        symbol: st.symbol,
        min: rets[0],
        q1: rets[Math.floor(n * 0.25)],
        median: rets[Math.floor(n * 0.5)],
        q3: rets[Math.floor(n * 0.75)],
        max: rets[n - 1],
      };
    });
  }, [stocks]);

  return (
    <Card title="Daily Return Distribution">
      {/* Stock selector tabs */}
      <div className="cmp-dist-tabs">
        {stocks.map((st, i) => (
          <button key={st.symbol} className={`cmp-dist-tab${selected === i ? " cmp-dist-tab-active" : ""}`}
            style={selected === i ? { borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] } : {}}
            onClick={() => setSelected(i)}>
            {st.symbol}
          </button>
        ))}
      </div>

      {/* Histogram */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={s.returnDistribution}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
          <XAxis dataKey="bin" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip formatter={(v: any) => [v, "Days"]} labelFormatter={l => `${l}% daily return`} />
          <ReferenceLine x={0} stroke="#d1d5db" />
          <Bar shape={SafeBarShape} dataKey="count" radius={[2, 2, 0, 0]}>
            {s.returnDistribution.map((d, i) => (
              <Cell key={i} fill={d.bin >= 0 ? COLORS[selected % COLORS.length] : "#dc2626"} opacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Box plot visual */}
      <h5 className="cmp-chart-title" style={{ marginTop: 16 }}>Distribution Summary (Box Plot)</h5>
      <div className="cmp-boxplot-wrap">
        {boxStats.map((b, i) => (
          <div key={b.symbol} className="cmp-boxplot-row">
            <span className="cmp-boxplot-label" style={{ color: COLORS[i % COLORS.length] }}>{b.symbol}</span>
            <div className="cmp-boxplot-track">
              {/* Scale: map min..max to 0..100 of the track */}
              {(() => {
                const allMin = Math.min(...boxStats.map(x => x.min));
                const allMax = Math.max(...boxStats.map(x => x.max));
                const range = allMax - allMin || 1;
                const toP = (v: number) => ((v - allMin) / range) * 100;
                return (
                  <>
                    {/* Whisker line */}
                    <div className="cmp-box-whisker" style={{ left: `${toP(b.min)}%`, width: `${toP(b.max) - toP(b.min)}%` }} />
                    {/* IQR box */}
                    <div className="cmp-box-iqr" style={{
                      left: `${toP(b.q1)}%`, width: `${toP(b.q3) - toP(b.q1)}%`,
                      background: COLORS[i % COLORS.length] + "30",
                      borderColor: COLORS[i % COLORS.length],
                    }} />
                    {/* Median line */}
                    <div className="cmp-box-median" style={{
                      left: `${toP(b.median)}%`,
                      background: COLORS[i % COLORS.length],
                    }} />
                  </>
                );
              })()}
            </div>
            <span className="cmp-boxplot-vals">
              {b.min}% → {b.q1}% | <strong>{b.median}%</strong> | {b.q3}% → {b.max}%
            </span>
          </div>
        ))}
      </div>
      <p className="cmp-note">Histogram shows frequency of daily returns. Box plot: whiskers = range, box = interquartile range (Q1-Q3), line = median.</p>
    </Card>
  );
}
