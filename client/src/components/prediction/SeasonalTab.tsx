import { useState, useEffect, useContext } from "react";
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts";
import { Loading } from "../common/Loading";
import { fetchSeasonal, type SeasonalResult } from "../../api/prediction";
import { SettingsCtx, Stat, pctCol } from "./PredictionShared";

export function SeasonalTab({ symbol }: { symbol: string }) {
  const { period } = useContext(SettingsCtx);
  const [data, setData] = useState<SeasonalResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSeasonal(symbol, period)
      .then(d => setData(d.success ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  if (loading) return <Loading message="Running seasonal decomposition..." />;
  if (!data) return <p className="text-muted">Seasonal analysis unavailable.</p>;

  const monthData = data.monthly_patterns.map(m => ({
    month: m.month, avg: m.avg, pct_positive: m.pct_positive, count: m.count,
  }));
  const dayData = data.weekday_patterns;
  const acfData = data.autocorrelation.slice(0, 40);
  const cs = data.current_signal;

  return (
    <div className="pd-seasonal">
      <div className="pd-summary-row">
        <div className="pd-model-card">
          <h5>Seasonality Strength</h5>
          <Stat label="Score" val={(data.season_strength * 100).toFixed(0) + "%"} color={data.season_strength > 0.3 ? "#059669" : "#d97706"} />
          <Stat label="Trend Strength" val={(data.trend_strength * 100).toFixed(0) + "%"} sm />
        </div>
        <div className="pd-model-card">
          <h5>Hurst Exponent</h5>
          <Stat label="H" val={data.hurst_exponent.toFixed(3)} color={data.hurst_exponent > 0.55 ? "#059669" : data.hurst_exponent < 0.45 ? "#dc2626" : "#d97706"} />
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>{data.hurst_interp}</p>
        </div>
        <div className="pd-model-card">
          <h5>Current Signal</h5>
          <Stat label="Monthly Bias" val={`${cs.month_bias > 0 ? "+" : ""}${cs.month_bias.toFixed(3)}%`} color={pctCol(cs.month_bias)} />
          <Stat label="Month Win%" val={`${cs.month_positive.toFixed(0)}%`} sm />
          <Stat label="Trend" val={cs.trend_direction} sm />
        </div>
        {data.dominant_cycle > 0 && (
          <div className="pd-model-card">
            <h5>Dominant Cycle</h5>
            <Stat label="Period" val={`${data.dominant_cycle} days`} color="#4f46e5" />
          </div>
        )}
      </div>

      {/* STL Decomposition chart */}
      {data.decomposition.length > 0 && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">Trend-Seasonal Decomposition (STL)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data.decomposition}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={Math.floor(data.decomposition.length / 8)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip />
              <Line dataKey="price" stroke="#9ca3af" strokeWidth={1} dot={false} name="Price" />
              <Line dataKey="trend" stroke="#4f46e5" strokeWidth={2} dot={false} name="Trend" />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly returns */}
      <div className="pd-chart-section">
        <h4 className="pd-section-title">Monthly Return Patterns (avg daily return %)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={((v: any, name: any) => [name === "avg" ? `${Number(v).toFixed(3)}%` : `${Number(v).toFixed(0)}%`, name === "avg" ? "Avg Return" : "Win %"]) as any} />
            <Bar dataKey="avg" name="Avg Return" radius={[3, 3, 0, 0]}>
              {monthData.map((d, i) => <Cell key={i} fill={d.avg >= 0 ? "#059669" : "#dc2626"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day of week */}
      <div className="pd-chart-section">
        <h4 className="pd-section-title">Day-of-Week Effect</h4>
        <div className="pd-dow-grid">
          {dayData.map(d => (
            <div key={d.day} className="pd-dow-card">
              <span className="pd-dow-name">{d.day}</span>
              <span className="pd-dow-ret" style={{ color: d.avg >= 0 ? "#059669" : "#dc2626" }}>
                {d.avg > 0 ? "+" : ""}{d.avg.toFixed(4)}%
              </span>
              <span className="pd-dow-win">{d.pct_positive.toFixed(0)}% win</span>
              <span className="text-sm text-muted">{d.count} days</span>
            </div>
          ))}
        </div>
      </div>

      {/* Autocorrelation */}
      <div className="pd-chart-section">
        <h4 className="pd-section-title">Autocorrelation (lag structure)</h4>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={acfData}>
            <XAxis dataKey="lag" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} domain={[-0.2, 0.2]} />
            <Tooltip formatter={(v: any) => [Number(v).toFixed(4), "ACF"]} />
            <ReferenceLine y={data.conf_bound} stroke="#dc2626" strokeDasharray="3 3" />
            <ReferenceLine y={-data.conf_bound} stroke="#dc2626" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="#6b7280" />
            <Bar dataKey="acf" radius={[2, 2, 0, 0]}>
              {acfData.map((d, i) => <Cell key={i} fill={Math.abs(d.acf) > data.conf_bound ? "#4f46e5" : "#d1d5db"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="pd-note">Bars exceeding red dashed lines are statistically significant. Blue = significant autocorrelation at that lag.</p>
      </div>

      <div className="pd-theory-box">
        <h5>Interpreting Seasonal Patterns</h5>
        <p>Hurst &gt; 0.5 = trending (momentum strategies work). Hurst &lt; 0.5 = mean-reverting (contrarian strategies work). Monthly patterns show calendar effects (e.g., "Sell in May"). Autocorrelation reveals serial dependence — significant lags suggest exploitable short-term patterns.</p>
      </div>
    </div>
  );
}
