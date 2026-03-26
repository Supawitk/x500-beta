import { useState, useEffect } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { Card } from "../common/Card";
import { Loading } from "../common/Loading";
import { fetchBacktest, type BacktestResult, type PatternMatch } from "../../api/prediction";

interface Props {
  symbol: string;
}

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#84cc16", "#f59e0b", "#6366f1"];

export function BacktestPanel({ symbol }: Props) {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState(20);
  const [lookahead, setLookahead] = useState(14);
  const [showN, setShowN] = useState(5);

  useEffect(() => {
    let c = false;
    setLoading(true); setError(null);
    fetchBacktest(symbol, window, lookahead)
      .then((r) => { if (!c) setData(r.success ? r : null); })
      .catch((e) => { if (!c) setError(e.message); })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [symbol, window, lookahead]);

  if (loading) return <Loading message="Running pattern backtest (~3yr data)..." />;
  if (error) return <Card title="Pattern Backtest"><p className="text-muted">{error}</p></Card>;
  if (!data) return null;

  const { summary: s, matches } = data;
  const shown = matches.slice(0, showN);

  const chartData = Array.from({ length: lookahead }, (_, i) => {
    const pt: Record<string, any> = { day: `Day ${i + 1}` };
    pt["p90"] = s.p90_path?.[i] ?? null;
    pt["p10"] = s.p10_path?.[i] ?? null;
    pt["Average"] = s.avg_path?.[i] ?? null;
    shown.forEach((m) => { pt[m.start_date] = m.after_prices[i] ?? null; });
    return pt;
  });

  const confColor = s.confidence_score >= 60 ? "badge-green"
    : s.confidence_score >= 30 ? "badge-yellow" : "badge-red";
  const biasColor = s.directional_bias === "Bullish" ? "text-green"
    : s.directional_bias === "Bearish" ? "text-red" : "text-muted";

  return (
    <Card title={`Pattern Backtest — ${data.dataPoints} days analyzed`}>
      <div className="backtest-controls">
        <label>Window: <select value={window} onChange={(e) => setWindow(+e.target.value)}>
          {[10,15,20,30].map((v) => <option key={v} value={v}>{v}d</option>)}
        </select></label>
        <label>Lookahead: <select value={lookahead} onChange={(e) => setLookahead(+e.target.value)}>
          {[7,14,21,30].map((v) => <option key={v} value={v}>{v}d</option>)}
        </select></label>
        <label>Matches: <select value={showN} onChange={(e) => setShowN(+e.target.value)}>
          {[3,5,10].map((v) => <option key={v} value={v}>Top {v}</option>)}
        </select></label>
      </div>

      <div className="backtest-verdict">
        <div>
          <span className="metric-label">Confidence</span>
          <span className={`health-badge ${confColor}`} style={{ fontSize: 16 }}>
            {s.confidence_score}/100
          </span>
        </div>
        <div>
          <span className="metric-label">Bias</span>
          <span className={`font-bold ${biasColor}`} style={{ fontSize: 16 }}>
            {s.directional_bias}
          </span>
        </div>
        <div>
          <span className="metric-label">Avg R²</span>
          <span className="risk-value">{s.avg_r_squared?.toFixed(4)}</span>
        </div>
        <div>
          <span className="metric-label">Avg RMSE</span>
          <span className="risk-value">{s.avg_rmse?.toFixed(4)}</span>
        </div>
      </div>

      <div className="risk-grid" style={{ marginBottom: 12 }}>
        <Stat label="Matches" value={String(s.total_matches)} />
        <Stat label="Avg Return" value={`${s.avg_return}%`} cls={s.avg_return >= 0 ? "text-green" : "text-red"} />
        <Stat label="Median" value={`${s.median_return}%`} />
        <Stat label="Std Dev" value={`${s.std_return}%`} />
        <Stat label="% Positive" value={`${s.pct_positive}%`} />
        <Stat label="Avg Max Gain" value={`+${s.avg_max_gain}%`} cls="text-green" />
        <Stat label="Avg Max Loss" value={`${s.avg_max_loss}%`} cls="text-red" />
        <Stat label="Best/Worst" value={`+${s.best_match_return}% / ${s.worst_match_return}%`} />
      </div>

      <h4 className="mc-title">Outcome paths (% return after pattern)</h4>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData}>
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <ReferenceLine y={0} stroke="#d1d5db" />
          <Area dataKey="p90" stroke="none" fill="#dbeafe" fillOpacity={0.4} name="P90 band" />
          <Area dataKey="p10" stroke="none" fill="#ffffff" fillOpacity={1} name="P10 band" />
          <Line dataKey="Average" stroke="#1f2937" strokeWidth={3} dot={false} strokeDasharray="6 3" />
          {shown.map((m, i) => (
            <Line key={m.start_date} dataKey={m.start_date}
              stroke={COLORS[i % COLORS.length]} strokeWidth={1} dot={false} strokeOpacity={0.5} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <MatchTable matches={shown} />

      <p className="text-muted text-sm" style={{ marginTop: 8 }}>
        {typeof data.note === "string" ? data.note : ""}
        {" "}Confidence: R² fit (40%), match count (20%), consistency (30%), RMSE (10%).
      </p>
    </Card>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="risk-metric">
      <span className="metric-label">{label}</span>
      <span className={`risk-value ${cls || ""}`}>{value}</span>
    </div>
  );
}

function MatchTable({ matches }: { matches: PatternMatch[] }) {
  if (!matches.length) return null;
  return (
    <div className="table-wrapper" style={{ marginTop: 10 }}>
      <table className="stock-table">
        <thead>
          <tr>
            <th>Period</th><th>R</th><th>R²</th><th>RMSE</th>
            <th>Return</th><th>Max Gain</th><th>Max Loss</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.start_date}>
              <td className="text-sm">{m.start_date} → {m.end_date}</td>
              <td>{m.correlation.toFixed(3)}</td>
              <td>{m.r_squared.toFixed(3)}</td>
              <td>{m.rmse.toFixed(2)}</td>
              <td className={m.after_return >= 0 ? "text-green" : "text-red"}>
                {m.after_return >= 0 ? "+" : ""}{m.after_return}%
              </td>
              <td className="text-green">+{m.max_gain}%</td>
              <td className="text-red">{m.max_loss}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
