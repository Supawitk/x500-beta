import { useState, useEffect, useMemo, useContext } from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, BarChart, Cell, Legend, ScatterChart, Scatter, ZAxis,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Loading } from "../common/Loading";
import {
  fetchMasterForecast,
  type MasterForecastResult,
} from "../../api/prediction";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SettingsCtx, Stat, pctCol, MODEL_COLORS } from "./PredictionShared";

export function MasterForecastTab({ symbol }: { symbol: string }) {
  const { period, horizon } = useContext(SettingsCtx);
  const [data, setData] = useState<MasterForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModels, setActiveModels] = useState<Record<string, boolean>>({
    ARIMA: true, GARCH: true, "Holt-Winters": true, Bayesian: true, Regime: true,
  });
  const [showDetail, setShowDetail] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMasterForecast(symbol, period, horizon)
      .then(d => setData(d?.models ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol, period, horizon]);

  // Build overlay chart data — must be before early return
  const overlayData = useMemo(() => {
    if (!data) return [];
    const rows: any[] = [];
    rows.push({ day: "Now", consensus: data.lastPrice });
    const successModels = data.models.filter(m => m.success && m.forecast && m.forecast.length > 0 && activeModels[m.name]);
    const maxLen = Math.max(...successModels.map(m => m.forecast!.length), data.avgPath?.length ?? 0);
    for (let i = 0; i < maxLen; i++) {
      const row: any = { day: `D${i + 1}` };
      for (const m of successModels) {
        const f = m.forecast![i];
        if (f) {
          row[m.name] = f.point;
          row[`${m.name}_lo`] = f.lo80;
          row[`${m.name}_hi`] = f.hi80;
        }
      }
      if (data.avgPath?.[i]) {
        row.consensus = data.avgPath[i].consensus;
        row.cons_lo = data.avgPath[i].lo80;
        row.cons_hi = data.avgPath[i].hi80;
      }
      rows.push(row);
    }
    return rows;
  }, [data, activeModels]);

  // Radar chart data for model comparison
  const radarData = useMemo(() => {
    if (!data) return [];
    const metrics = [
      { key: "direction", label: "Bullish Signal" },
      { key: "confidence", label: "Confidence" },
      { key: "accuracy", label: "Accuracy" },
      { key: "return", label: "Exp. Return" },
      { key: "skill", label: "Skill Score" },
    ];
    return metrics.map(metric => {
      const row: any = { metric: metric.label };
      for (const m of data.models) {
        if (!m.success) { row[m.name] = 0; continue; }
        switch (metric.key) {
          case "direction": row[m.name] = m.direction === "Bullish" ? 80 : m.direction === "Bearish" ? 20 : 50; break;
          case "confidence": row[m.name] = m.probUp != null ? Math.round(Math.abs(m.probUp - 0.5) * 200) : 50; break;
          case "accuracy": row[m.name] = m.walkForward?.dir_accuracy ?? 50; break;
          case "return": row[m.name] = Math.min(100, Math.max(0, 50 + (m.returnPct ?? 0) * 5)); break;
          case "skill": row[m.name] = Math.min(100, Math.max(0, 50 + (m.walkForward?.skill_score ?? 0) * 3)); break;
        }
      }
      return row;
    });
  }, [data]);

  if (loading) return <Loading message="Running 5 forecast models in parallel..." />;
  if (!data) return <p className="text-muted">Master forecast unavailable. Ensure R is installed.</p>;

  const successModels = data.models.filter(m => m.success);
  const failedModels = data.models.filter(m => !m.success);
  const c = data.consensus;

  return (
    <div className="pd-master">
      {/* Consensus banner */}
      <div className={`pd-consensus-banner ${c.direction === "Bullish" ? "pd-cons-bull" : "pd-cons-bear"}`}>
        <div className="pd-cons-main">
          <span className="pd-cons-dir">
            {c.direction === "Bullish" ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {c.direction}
          </span>
          <span className="pd-cons-label">{c.label}</span>
        </div>
        <div className="pd-cons-stats">
          <div className="pd-cons-stat">
            <span className="pd-cons-num">{c.agreement_pct}%</span>
            <span className="text-sm">Agreement</span>
          </div>
          <div className="pd-cons-stat">
            <span className="pd-cons-num">{c.weighted_bull_pct}%</span>
            <span className="text-sm">Weighted Bull</span>
          </div>
          <div className="pd-cons-stat">
            <span className="pd-cons-num">{c.n_bullish}/{c.n_bearish}</span>
            <span className="text-sm">Bull/Bear</span>
          </div>
          <div className="pd-cons-stat">
            <span className="pd-cons-num">{c.n_models}/{c.total_models}</span>
            <span className="text-sm">Models OK</span>
          </div>
        </div>
      </div>

      {/* Model summary cards */}
      <div className="pd-master-models">
        {successModels.map(m => (
          <div key={m.name} className={`pd-master-model-card ${showDetail === m.name ? "pd-mm-expanded" : ""}`}
               onClick={() => setShowDetail(showDetail === m.name ? null : m.name)}
               style={{ borderLeft: `4px solid ${MODEL_COLORS[m.name] || "#6b7280"}` }}>
            <div className="pd-mm-header">
              <h5 style={{ color: MODEL_COLORS[m.name] }}>{m.name}</h5>
              <span className={`pd-dir-badge ${m.direction === "Bullish" ? "pd-dir-bull" : m.direction === "Bearish" ? "pd-dir-bear" : "pd-dir-neutral"}`}>
                {m.direction}
              </span>
            </div>
            <div className="pd-mm-stats">
              <Stat label={`${horizon}d Target`} val={`$${m.endPoint?.toFixed(2) ?? "?"}`} color={m.direction === "Bullish" ? "#059669" : "#dc2626"} />
              <Stat label="Return" val={`${(m.returnPct ?? 0) > 0 ? "+" : ""}${m.returnPct?.toFixed(2) ?? "?"}%`} color={pctCol(m.returnPct ?? 0)} sm />
              {m.probUp != null && <Stat label="P(Up)" val={`${(m.probUp * 100).toFixed(0)}%`} sm />}
              {m.walkForward && <Stat label="Accuracy" val={`${m.walkForward.dir_accuracy.toFixed(0)}%`} sm />}
              {m.walkForward && <Stat label="Skill" val={`${m.walkForward.skill_score > 0 ? "+" : ""}${m.walkForward.skill_score.toFixed(1)}`} color={pctCol(m.walkForward.skill_score)} sm />}
            </div>
            <p className="text-sm text-muted">{typeof m.model_detail === "string" ? m.model_detail : m.name}</p>
            {/* Expanded detail */}
            {showDetail === m.name && m.extra && (
              <div className="pd-mm-detail">
                {m.name === "Bayesian" && m.extra.importance && (
                  <div className="pd-mm-importance">
                    <h6>Feature Importance (Signal/Noise)</h6>
                    <div className="pd-mm-feat-list">
                      {(m.extra.importance as any[]).slice(0, 8).map((f: any) => (
                        <div key={f.feature} className="pd-mm-feat-row">
                          <span>{f.feature}</span>
                          <div className="pd-str-bar"><div style={{ width: `${Math.min(100, f.signal_noise * 15)}%`, background: f.significant ? "#4f46e5" : "#d1d5db" }} /></div>
                          <span className="pd-mono text-sm">{f.signal_noise.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                    {m.extra.distribution && (
                      <div className="pd-mm-dist">
                        <h6>Return Distribution ({horizon}d)</h6>
                        <div className="pd-mm-dist-stats">
                          <Stat label="Mean" val={`${m.extra.distribution.mean}%`} sm />
                          <Stat label="Median" val={`${m.extra.distribution.median}%`} sm />
                          <Stat label="Std Dev" val={`${m.extra.distribution.sd}%`} sm />
                          <Stat label="Skew" val={m.extra.distribution.skew} sm />
                          <Stat label="5th %ile" val={`${m.extra.distribution.p5}%`} color="#dc2626" sm />
                          <Stat label="95th %ile" val={`${m.extra.distribution.p95}%`} color="#059669" sm />
                        </div>
                      </div>
                    )}
                    {m.extra.histogram && (
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={m.extra.histogram}>
                          <XAxis dataKey="bin" tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                          <YAxis hide />
                          <Tooltip formatter={(v: any) => [v, "Count"]} />
                          <Bar shape={SafeBarShape} dataKey="count" radius={[2, 2, 0, 0]}>
                            {(m.extra.histogram as any[]).map((h: any, i: number) => (
                              <Cell key={i} fill={h.bin >= 0 ? "#059669" : "#dc2626"} opacity={0.7} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
                {m.name === "Regime" && m.extra.stats && (
                  <div className="pd-mm-regime">
                    <h6>Regime Statistics</h6>
                    <div className="pd-mm-regime-cards">
                      {Object.entries(m.extra.stats).map(([regime, stats]: [string, any]) => (
                        <div key={regime} className="pd-mm-regime-card">
                          <span className={`pd-regime-badge pd-regime-${regime.toLowerCase()}`}>{regime}</span>
                          <Stat label="Time" val={`${stats.pct}%`} sm />
                          <Stat label="Avg Return" val={`${stats.avg_return}%`} color={pctCol(stats.avg_return)} sm />
                          <Stat label="Avg Vol" val={`${stats.avg_vol}%`} sm />
                          <Stat label="Win Rate" val={`${stats.avg_winrate}%`} sm />
                        </div>
                      ))}
                    </div>
                    {m.extra.next_prob && (
                      <div style={{ marginTop: 8 }}>
                        <h6>Next Regime Probability</h6>
                        <div className="pd-mm-dist-stats">
                          {Object.entries(m.extra.next_prob).map(([r, p]: [string, any]) => (
                            <Stat key={r} label={r} val={`${(p * 100).toFixed(0)}%`} color={r === "Bull" ? "#059669" : r === "Bear" ? "#dc2626" : "#d97706"} sm />
                          ))}
                        </div>
                      </div>
                    )}
                    {m.extra.transition && (
                      <div style={{ marginTop: 8 }}>
                        <h6>Transition Matrix</h6>
                        <table className="pd-table pd-table-sm">
                          <thead><tr><th>From\To</th><th>Bull</th><th>Bear</th><th>Sideways</th></tr></thead>
                          <tbody>
                            {["Bull", "Bear", "Sideways"].map(from => (
                              <tr key={from}>
                                <td className="pd-mono">{from}</td>
                                {["Bull", "Bear", "Sideways"].map(to => {
                                  const v = (m.extra.transition as any)?.[from]?.[to] ?? (m.extra.transition as any)?.[["Bull","Bear","Sideways"].indexOf(from)+1]?.[["Bull","Bear","Sideways"].indexOf(to)+1] ?? 0;
                                  return <td key={to} className="pd-mono" style={{ color: to === "Bull" ? "#059669" : to === "Bear" ? "#dc2626" : "#d97706" }}>{typeof v === "number" ? (v * 100).toFixed(0) : v}%</td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {m.name === "Holt-Winters" && m.extra.models && (
                  <div className="pd-mm-hw">
                    <h6>Model Comparison</h6>
                    {(m.extra.models as any[]).map((hw: any, i: number) => (
                      <div key={i} className="pd-mm-hw-row">
                        <span className="pd-mono" style={{ fontWeight: hw.name === (m.extra as any).trend?.direction ? 700 : 400 }}>{hw.name}</span>
                        <span className="text-sm">RMSE: {hw.accuracy?.rmse?.toFixed(4) ?? "N/A"}</span>
                        <span className="text-sm">Dir Acc: {hw.accuracy?.dir_accuracy?.toFixed(0) ?? "?"}%</span>
                        <span className="text-sm text-muted">{hw.description}</span>
                      </div>
                    ))}
                    {m.extra.trend && (
                      <p className="text-sm" style={{ marginTop: 6 }}>
                        Trend: <strong style={{ color: m.extra.trend.direction === "Uptrend" ? "#059669" : "#dc2626" }}>{m.extra.trend.direction}</strong> (slope: {m.extra.trend.slope}, strength: {m.extra.trend.strength}%)
                      </p>
                    )}
                  </div>
                )}
                {m.name === "GARCH" && m.extra && (
                  <div className="pd-mm-garch">
                    <div className="pd-mm-dist-stats">
                      <Stat label="Current Vol" val={`${m.extra.vol?.toFixed(1) ?? "?"}%`} sm />
                      <Stat label="VaR 95%" val={`${m.extra.var?.var_95_pct ?? "?"}%`} color="#dc2626" sm />
                      <Stat label="CVaR 95%" val={`${m.extra.var?.cvar_95_pct ?? "?"}%`} color="#dc2626" sm />
                      <Stat label="Vol State" val={m.extra.regime?.current ?? "?"} sm />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {failedModels.length > 0 && (
          <div className="pd-failed-models">
            {failedModels.map(m => (
              <span key={m.name} className="pd-failed-badge">{m.name}: {m.error || "Failed"}</span>
            ))}
          </div>
        )}
      </div>

      {/* Model toggles for chart */}
      <div className="pd-model-toggles">
        <span className="text-sm text-muted">Show on chart:</span>
        {data.models.filter(m => m.success).map(m => (
          <label key={m.name} className="pd-model-toggle"
            style={{ borderColor: MODEL_COLORS[m.name] || "#6b7280", "--model-color": MODEL_COLORS[m.name] || "#6b7280" } as React.CSSProperties}>
            <input type="checkbox" checked={activeModels[m.name] ?? true}
                   onChange={() => setActiveModels(prev => ({ ...prev, [m.name]: !prev[m.name] }))} />
            <span className="pd-toggle-track" />
            <span style={{ color: MODEL_COLORS[m.name] }}>{m.name}</span>
          </label>
        ))}
      </div>

      {/* Multi-model overlay chart */}
      {overlayData.length > 1 && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">Multi-Model Forecast Overlay ({horizon} days)</h4>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={overlayData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
              <ReferenceLine y={data.lastPrice} stroke="#6b7280" strokeDasharray="3 3" label={{ value: `$${data.lastPrice.toFixed(2)}`, fontSize: 10, position: "right" }} />
              {/* Consensus band */}
              <Area dataKey="cons_hi" stroke="none" fill="#e5e7eb" fillOpacity={0.4} name="Consensus Band Hi" />
              <Area dataKey="cons_lo" stroke="none" fill="#ffffff" fillOpacity={1} name="Consensus Band Lo" />
              <Line dataKey="consensus" stroke="#1f2937" strokeWidth={3} dot={false} name="Consensus" strokeDasharray="5 3" />
              {/* Individual model lines */}
              {successModels.filter(m => activeModels[m.name]).map(m => (
                <Line key={m.name} dataKey={m.name} stroke={MODEL_COLORS[m.name] || "#6b7280"} strokeWidth={1.8} dot={false} name={m.name} connectNulls />
              ))}
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Radar comparison chart */}
      {radarData.length > 0 && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">Model Comparison Radar</h4>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {successModels.map(m => (
                <Radar key={m.name} name={m.name} dataKey={m.name}
                       stroke={MODEL_COLORS[m.name] || "#6b7280"}
                       fill={MODEL_COLORS[m.name] || "#6b7280"}
                       fillOpacity={0.1} strokeWidth={2} />
              ))}
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Regime timeline if available */}
      {data.models.find(m => m.name === "Regime" && m.success)?.extra?.timeline && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">Market Regime Timeline</h4>
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={d => d?.slice(5)} />
              <YAxis dataKey="ret" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} name="Return" />
              <ZAxis dataKey="vol" range={[20, 200]} name="Volatility" />
              <Tooltip formatter={((v: any, name: any) => [name === "ret" ? `${v}%` : `${v}%`, name === "ret" ? "Return" : "Volatility"]) as any} />
              {["Bull", "Bear", "Sideways"].map(regime => {
                const timeline = data.models.find(m => m.name === "Regime")?.extra?.timeline as any[];
                const points = timeline?.filter((t: any) => t.regime === regime) ?? [];
                if (points.length === 0) return null;
                return <Scatter key={regime} data={points} fill={regime === "Bull" ? "#059669" : regime === "Bear" ? "#dc2626" : "#d97706"} name={regime} />;
              })}
              <Legend />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="pd-note">Each dot = 20-day rolling window. Color = detected regime. Size = volatility. Position = annualized return.</p>
        </div>
      )}

      {/* Theory box */}
      <div className="pd-theory-box">
        <h5>About Master Forecast</h5>
        <p>Combines 5 independent forecasting methodologies: <strong>ARIMA</strong> (time-series autoregression), <strong>GARCH</strong> (volatility-adjusted), <strong>Holt-Winters</strong> (exponential smoothing with trend/seasonal), <strong>Bayesian Regression</strong> (posterior predictive with credible intervals), and <strong>Regime Detection</strong> (k-means clustering on return/vol features for conditional simulation). The consensus line averages all successful models. Weighted bull % accounts for walk-forward skill score — models that historically predicted direction better get more weight. Click any model card for detailed analysis.</p>
      </div>
    </div>
  );
}
