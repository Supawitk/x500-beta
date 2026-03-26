import { useState, useEffect, useContext } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Loading } from "../common/Loading";
import { fetchBollinger, type BollingerResult } from "../../api/prediction";
import { SettingsCtx, Stat } from "./PredictionShared";

export function BollingerTab({ symbol }: { symbol: string }) {
  const { period } = useContext(SettingsCtx);
  const [data, setData] = useState<BollingerResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBollinger(symbol, period)
      .then(d => setData(d.success ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  if (loading) return <Loading message="Running Bollinger analysis..." />;
  if (!data) return <p className="text-muted">Bollinger analysis unavailable.</p>;

  const c = data.current;
  const pctBColor = c.pct_b > 0.8 ? "#dc2626" : c.pct_b < 0.2 ? "#059669" : "#d97706";

  return (
    <div className="pd-bollinger">
      <div className="pd-summary-row">
        <div className="pd-model-card">
          <h5>Current Signal</h5>
          <p style={{ fontSize: 13, fontWeight: 600, color: c.in_squeeze ? "#4f46e5" : c.pct_b > 0.8 ? "#dc2626" : c.pct_b < 0.2 ? "#059669" : "#d97706" }}>
            {c.signal}
          </p>
          {c.pattern !== "None" && <p className="text-sm" style={{ color: "#4f46e5", marginTop: 4 }}>{c.pattern}</p>}
        </div>
        <div className="pd-model-card">
          <h5>%B Oscillator</h5>
          <Stat label="%B" val={c.pct_b.toFixed(3)} color={pctBColor} />
          <div className="pd-pctb-bar">
            <div className="pd-pctb-fill" style={{ left: `${Math.max(0, Math.min(100, c.pct_b * 100))}%` }} />
          </div>
          <div className="pd-pctb-labels"><span>Oversold</span><span>Overbought</span></div>
        </div>
        <div className="pd-model-card">
          <h5>Bandwidth</h5>
          <Stat label="Current" val={(c.bandwidth * 100).toFixed(2) + "%"} />
          <Stat label="Percentile" val={c.bw_percentile != null ? `${c.bw_percentile}%` : "N/A"} sm />
          <Stat label="Squeeze?" val={c.in_squeeze ? "YES" : "No"} color={c.in_squeeze ? "#4f46e5" : "#6b7280"} sm />
        </div>
        <div className="pd-model-card">
          <h5>Mean Reversion</h5>
          <Stat label="Accuracy" val={data.reversion_accuracy != null ? `${data.reversion_accuracy}%` : "N/A"} color={data.reversion_accuracy != null && data.reversion_accuracy > 55 ? "#059669" : "#d97706"} />
          <Stat label="Tests" val={String(data.reversion_tests)} sm />
        </div>
      </div>

      {/* Band chart with price */}
      <div className="pd-chart-section">
        <h4 className="pd-section-title">Bollinger Bands + %B</h4>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data.band_data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={Math.floor(data.band_data.length / 8)} />
            <YAxis yAxisId="price" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <YAxis yAxisId="pctb" orientation="right" domain={[-0.2, 1.2]} tick={{ fontSize: 9 }} hide />
            <Tooltip />
            <Area yAxisId="price" dataKey="upper" stroke="none" fill="#e0e7ff" fillOpacity={0.3} name="Upper Band" />
            <Area yAxisId="price" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={1} name="Lower Band" />
            <Line yAxisId="price" dataKey="middle" stroke="#6b7280" strokeWidth={1} dot={false} name="SMA 20" strokeDasharray="3 3" />
            <Line yAxisId="price" dataKey="price" stroke="#1f2937" strokeWidth={1.5} dot={false} name="Price" />
            <Line yAxisId="pctb" dataKey="pct_b" stroke="#6366f1" strokeWidth={1} dot={false} name="%B" opacity={0.6} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Band values */}
      <div className="pd-band-vals">
        <Stat label="Upper Band" val={`$${c.upper_band.toFixed(2)}`} color="#dc2626" />
        <Stat label="Middle (SMA)" val={`$${c.middle_band.toFixed(2)}`} />
        <Stat label="Lower Band" val={`$${c.lower_band.toFixed(2)}`} color="#059669" />
        <Stat label="Current Price" val={`$${c.price.toFixed(2)}`} />
      </div>

      {/* Squeeze history */}
      {data.squeeze_events.length > 0 && (
        <div className="pd-squeeze-section">
          <h4 className="pd-section-title">Squeeze Events ({data.total_squeezes} total)</h4>
          <div className="pd-squeeze-list">
            {data.squeeze_events.slice(-8).map((s, i) => (
              <div key={i} className="pd-squeeze-row">
                <span className="pd-mono text-sm">{s.start_date} - {s.end_date}</span>
                <span className="text-sm">{s.duration}d</span>
                <span className="text-sm" style={{ color: s.direction.includes("Bullish") ? "#059669" : "#dc2626" }}>{s.direction}</span>
                <span className="pd-mono text-sm" style={{ color: s.after_return_10d >= 0 ? "#059669" : "#dc2626" }}>
                  {s.after_return_10d > 0 ? "+" : ""}{s.after_return_10d}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pd-theory-box">
        <h5>Bollinger Band Theory (John Bollinger)</h5>
        <p>%B &gt; 1 = price above upper band (strong momentum or overbought). %B &lt; 0 = below lower band (oversold). Squeeze (BB inside Keltner) = low volatility preceding a breakout — direction determined by price's exit side. W-bottoms and M-tops are reversal patterns. Mean reversion accuracy shows how often oversold/overbought signals correctly predicted reversals historically.</p>
      </div>
    </div>
  );
}
