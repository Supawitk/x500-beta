import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Legend, Cell, BarChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Target } from "lucide-react";
import { Loading } from "../common/Loading";
import type { SimResult, Strategy } from "./portfolioConstants";
import { STRATEGIES, fmt$ } from "./portfolioConstants";

function Stat({ label, val, color, sm }: { label: string; val: string; color?: string; sm?: boolean }) {
  return (
    <div className="pd-stat">
      <span className="metric-label">{label}</span>
      <span className={`pd-stat-val ${sm ? "pd-stat-sm" : ""}`} style={color ? { color } : {}}>{val}</span>
    </div>
  );
}

interface PortfolioResultsProps {
  result: SimResult | null;
  loading: boolean;
  strategies: Strategy[];
  goalYears: number;
  riskTolerance: string;
  initial: number;
  activeTab: "backtest" | "projection" | "assets";
  setActiveTab: (tab: "backtest" | "projection" | "assets") => void;
}

export function PortfolioResults({
  result, loading, strategies, goalYears, riskTolerance, initial, activeTab, setActiveTab,
}: PortfolioResultsProps) {
  return (
    <div className="pb-results">
      {loading && <Loading message="Running portfolio simulation with Monte Carlo..." />}
      {!loading && !result && (
        <div className="pb-empty">
          <Target size={40} style={{ color: "#d1d5db" }} />
          <p>Configure your portfolio and click <strong>Run Simulation</strong></p>
          <p className="text-sm text-muted">The simulator backtests historical performance, then projects forward using Monte Carlo simulation with your contributions and goals.</p>
        </div>
      )}
      {result && !loading && (
        <>
          {/* Strategy summary badge */}
          <div className="pb-result-header">
            <div className="pb-strat-badges">
              {strategies.map((s, i) => (
                <span key={s} className={`pb-badge pb-badge-${s}`}>
                  {i === 0 ? "Primary" : "Secondary"}: {STRATEGIES.find(st => st.id === s)?.label}
                </span>
              ))}
            </div>
            <span className="pb-result-meta">{result.assets.length} assets | {goalYears}yr horizon | {riskTolerance} risk</span>
          </div>

          {/* Result tabs */}
          <div className="pb-result-tabs">
            {(["backtest", "projection", "assets"] as const).map(t => (
              <button key={t} className={`pb-rtab ${activeTab === t ? "pb-rtab-active" : ""}`} onClick={() => setActiveTab(t)}>
                {t === "backtest" ? "Backtest" : t === "projection" ? "Projection" : "Assets"}
              </button>
            ))}
          </div>

          {activeTab === "backtest" && (
            <div className="pb-backtest">
              <div className="pb-summary-row">
                <Stat label="Total Return" val={`${result.backtest.total_return.toFixed(1)}%`}
                      color={result.backtest.total_return >= 0 ? "#059669" : "#dc2626"} />
                <Stat label="Ann. Return" val={`${result.backtest.ann_return.toFixed(1)}%`}
                      color={result.backtest.ann_return >= 0 ? "#059669" : "#dc2626"} />
                <Stat label="Ann. Vol" val={`${result.backtest.ann_vol.toFixed(1)}%`} />
                <Stat label="Sharpe" val={result.backtest.sharpe.toFixed(2)}
                      color={result.backtest.sharpe > 1 ? "#059669" : result.backtest.sharpe > 0 ? "#d97706" : "#dc2626"} />
                <Stat label="Sortino" val={result.backtest.sortino.toFixed(2)} />
                <Stat label="Max DD" val={`${result.backtest.max_drawdown.toFixed(1)}%`} color="#dc2626" />
                <Stat label="Win Rate" val={`${result.backtest.win_rate.toFixed(0)}%`} />
                <Stat label="Calmar" val={result.backtest.calmar.toFixed(2)} />
              </div>

              {result.backtest.equity_curve.length > 0 && (
                <div className="pb-chart-section">
                  <h5>Equity Curve ({fmt$(initial)} initial)</h5>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={result.backtest.equity_curve.map((v, i) => ({ day: i, value: v }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="day" tick={{ fontSize: 9 }} tickFormatter={d => `D${d}`}
                             interval={Math.floor(result.backtest.equity_curve.length / 6)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt$(v)} />
                      <Tooltip formatter={(v: any) => fmt$(Number(v))} />
                      <ReferenceLine y={initial} stroke="#6b7280" strokeDasharray="3 3" />
                      <Area dataKey="value" stroke="#4f46e5" fill="#eef2ff" strokeWidth={2} name="Portfolio Value" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {result.backtest.monthly_returns.length > 0 && (
                <div className="pb-chart-section">
                  <h5>Monthly Returns (%)</h5>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={result.backtest.monthly_returns.map((v, i) => ({ month: result.backtest.month_labels[i], ret: v }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={Math.floor(result.backtest.monthly_returns.length / 8)} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                      <Bar shape={SafeBarShape} dataKey="ret" radius={[2, 2, 0, 0]}>
                        {result.backtest.monthly_returns.map((v, i) => (
                          <Cell key={i} fill={v >= 0 ? "#059669" : "#dc2626"} opacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === "projection" && (
            <div className="pb-projection">
              <div className="pb-goal-banner">
                <div className="pb-goal-main">
                  <span className="pb-goal-prob">{result.projection.prob_goal.toFixed(0)}%</span>
                  <span className="pb-goal-label">Probability of reaching goal</span>
                </div>
                <div className="pb-goal-details">
                  <Stat label="Goal Value" val={fmt$(result.projection.goal_value)} sm />
                  <Stat label="Expected" val={fmt$(result.projection.expected_value)} color="#4f46e5" sm />
                  <Stat label="Median" val={fmt$(result.projection.median_value)} sm />
                  <Stat label="Contributed" val={fmt$(result.projection.total_contributed)} sm />
                  <Stat label="P(Profit)" val={`${result.projection.prob_profit.toFixed(0)}%`} color="#059669" sm />
                  <Stat label="Exp. CAGR" val={`${result.projection.expected_cagr.toFixed(1)}%`} sm />
                  <Stat label="Worst 5%" val={fmt$(result.projection.worst_case_5pct)} color="#dc2626" sm />
                  <Stat label="Best 95%" val={fmt$(result.projection.best_case_95pct)} color="#059669" sm />
                  <Stat label="VaR 95%" val={fmt$(result.projection.var_95)} color="#dc2626" sm />
                </div>
              </div>

              {result.projection.fan_chart.length > 0 && (
                <div className="pb-chart-section">
                  <h5>Monte Carlo Projection ({goalYears}yr, 3000 simulations)</h5>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={result.projection.fan_chart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={m => `M${m}`} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt$(v)} />
                      <Tooltip formatter={(v: any) => fmt$(Number(v))} />
                      <Area dataKey="p95" stroke="none" fill="#dbeafe" fillOpacity={0.4} name="95th %ile" />
                      <Area dataKey="p5" stroke="none" fill="#ffffff" fillOpacity={1} name="5th %ile" />
                      <Area dataKey="p75" stroke="none" fill="#c7d2fe" fillOpacity={0.4} name="75th %ile" />
                      <Area dataKey="p25" stroke="none" fill="#ffffff" fillOpacity={1} name="25th %ile" />
                      <Line dataKey="p50" stroke="#4f46e5" strokeWidth={2.5} dot={false} name="Median" />
                      <ReferenceLine y={result.projection.goal_value} stroke="#059669" strokeDasharray="5 3"
                                     label={{ value: "Goal", fontSize: 10, fill: "#059669" }} />
                      <ReferenceLine y={result.projection.total_contributed} stroke="#d97706" strokeDasharray="3 3"
                                     label={{ value: "Contributed", fontSize: 10, fill: "#d97706" }} />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="pd-note">Shaded bands show range of outcomes. Median (blue) = most likely path. Green dashed = your target.</p>
                </div>
              )}

              {result.projection.return_histogram.length > 0 && (
                <div className="pb-chart-section">
                  <h5>Final Return Distribution ({goalYears}yr)</h5>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={result.projection.return_histogram}>
                      <XAxis dataKey="bin" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
                      <YAxis hide />
                      <Tooltip formatter={(v: any) => [v, "Simulations"]} labelFormatter={l => `${l}% return`} />
                      <Bar shape={SafeBarShape} dataKey="count" radius={[2, 2, 0, 0]}>
                        {result.projection.return_histogram.map((h, i) => (
                          <Cell key={i} fill={h.bin >= 0 ? "#059669" : "#dc2626"} opacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === "assets" && (
            <div className="pb-assets-tab">
              <table className="pd-table">
                <thead>
                  <tr><th>Symbol</th><th>Weight</th><th>Ann. Return</th><th>Ann. Vol</th><th>Sharpe</th><th>Total Return</th></tr>
                </thead>
                <tbody>
                  {result.assets.map((a: any) => (
                    <tr key={a.symbol}>
                      <td className="pd-mono" style={{ fontWeight: 600 }}>{a.symbol}</td>
                      <td className="pd-mono">{a.weight}%</td>
                      <td className="pd-mono" style={{ color: a.ann_return >= 0 ? "#059669" : "#dc2626" }}>
                        {a.ann_return > 0 ? "+" : ""}{a.ann_return}%
                      </td>
                      <td className="pd-mono">{a.ann_vol}%</td>
                      <td className="pd-mono">{a.sharpe}</td>
                      <td className="pd-mono" style={{ color: a.total_return >= 0 ? "#059669" : "#dc2626" }}>
                        {a.total_return > 0 ? "+" : ""}{a.total_return}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {result.assets.length >= 2 && (
                <div className="pb-chart-section">
                  <h5>Asset Risk/Return Radar</h5>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={[
                      { metric: "Return", ...Object.fromEntries(result.assets.map((a: any) => [a.symbol, Math.max(0, Math.min(100, 50 + a.ann_return * 2))])) },
                      { metric: "Sharpe", ...Object.fromEntries(result.assets.map((a: any) => [a.symbol, Math.max(0, Math.min(100, a.sharpe * 30))])) },
                      { metric: "Win Rate", ...Object.fromEntries(result.assets.map((a: any) => [a.symbol, 50])) },
                      { metric: "Low Vol", ...Object.fromEntries(result.assets.map((a: any) => [a.symbol, Math.max(0, 100 - a.ann_vol * 2)])) },
                      { metric: "Weight", ...Object.fromEntries(result.assets.map((a: any) => [a.symbol, a.weight])) },
                    ]}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      {result.assets.map((a: any, i: number) => (
                        <Radar key={a.symbol} name={a.symbol} dataKey={a.symbol}
                               stroke={["#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"][i % 6]}
                               fill={["#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"][i % 6]}
                               fillOpacity={0.1} strokeWidth={2} />
                      ))}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {result.correlation && result.assets.length >= 2 && (
                <div className="pb-chart-section">
                  <h5>Correlation Matrix</h5>
                  <table className="pd-table pd-table-sm">
                    <thead>
                      <tr><th></th>{result.assets.map((a: any) => <th key={a.symbol}>{a.symbol}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.assets.map((a: any, i: number) => (
                        <tr key={a.symbol}>
                          <td className="pd-mono" style={{ fontWeight: 600 }}>{a.symbol}</td>
                          {result.assets.map((_: any, j: number) => {
                            const v = Array.isArray(result.correlation[i]) ? result.correlation[i][j] : (result.correlation as any)[i + 1]?.[j + 1] ?? 0;
                            const absV = Math.abs(v);
                            return (
                              <td key={j} className="pd-mono" style={{
                                background: `rgba(${v > 0 ? "5,150,105" : "220,38,38"}, ${absV * 0.3})`,
                                color: absV > 0.5 ? "#fff" : undefined,
                              }}>{typeof v === "number" ? v.toFixed(2) : v}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="pd-note">Lower correlation = better diversification. Values near 0 are ideal for risk reduction.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
