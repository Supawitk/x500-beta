import { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import { Loading } from "../common/Loading";
import {
  fetchModelCompare, fetchEnsemble, fetchEnhancedBacktest, resetModelCache,
  type CompareResult, type EnsembleResult, type EnhancedBacktestResult,
  type ModelPeriod, type LookAhead,
} from "../../api/modelLab";
import { RotateCcw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  symbol: string;
}

type ActiveTab = "compare" | "ensemble" | "backtest";

const PERIOD_OPTIONS: ModelPeriod[] = ["1y", "2y", "3y"];
const AHEAD_OPTIONS:  LookAhead[]   = [5, 10, 14, 20, 30];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctColor(v: number | null | undefined, threshold = 50): string {
  if (v == null) return "#6b7280";
  return v >= threshold + 5 ? "#059669" : v >= threshold ? "#34d399" : v >= threshold - 5 ? "#d97706" : "#dc2626";
}
function skillColor(v: number | null | undefined): string {
  if (v == null) return "#6b7280";
  return v >= 8 ? "#059669" : v >= 3 ? "#d97706" : "#dc2626";
}
function dirColor(dir?: string): string {
  if (!dir) return "#6b7280";
  const d = dir.toLowerCase();
  if (d.includes("up") || d.includes("bull")) return "#059669";
  if (d.includes("down") || d.includes("bear")) return "#dc2626";
  return "#d97706";
}
function fmtPct(v: number | null | undefined, digits = 1): string {
  return v == null ? "N/A" : `${v.toFixed(digits)}%`;
}

// ── Model Accuracy Row ────────────────────────────────────────────────────────
function ModelRow({ m, isConsensus }: { m: any; isConsensus: boolean }) {
  const [open, setOpen] = useState(false);
  if (!m.success) {
    return (
      <div className="ml-model-row ml-model-error">
        <span className="ml-model-name">{m.name}</span>
        <span className="text-muted text-sm">Failed: {m.error || "Unknown error"}</span>
      </div>
    );
  }

  return (
    <div className={`ml-model-row ${isConsensus ? "ml-model-consensus" : ""}`}
      onClick={() => setOpen((v) => !v)}>
      <div className="ml-model-row-header">
        <div className="ml-model-left">
          <span className="ml-model-name">{m.name}</span>
          <span className="text-muted" style={{ fontSize: 11 }}>{m.model_type}</span>
        </div>
        <div className="ml-model-right">
          {/* Direction */}
          <span className="ml-direction" style={{ color: dirColor(m.direction) }}>
            {m.direction?.includes("Up") || m.direction?.includes("Bull")
              ? <TrendingUp size={13} style={{ verticalAlign: "middle" }} />
              : m.direction?.includes("Down") || m.direction?.includes("Bear")
              ? <TrendingDown size={13} style={{ verticalAlign: "middle" }} />
              : null}
            {" "}{m.direction ?? "N/A"}
          </span>
          {/* Prob */}
          {m.prob_up != null && (
            <span className="ml-prob" style={{ color: pctColor(m.prob_up * 100, 50) }}>
              {fmtPct(m.prob_up * 100)} ↑
            </span>
          )}
          {/* Accuracy */}
          <div className="ml-acc-col">
            <span className="metric-label">Dir Acc</span>
            <span style={{ fontWeight: 700, color: pctColor(m.dir_accuracy, 50), fontFamily: "monospace" }}>
              {m.dir_accuracy != null ? `${m.dir_accuracy}%` : "N/A"}
            </span>
          </div>
          {/* Skill */}
          <div className="ml-acc-col">
            <span className="metric-label">Skill</span>
            <span style={{ fontWeight: 700, color: skillColor(m.skill_score), fontFamily: "monospace" }}>
              {m.skill_score != null ? `${m.skill_score > 0 ? "+" : ""}${m.skill_score}%` : "N/A"}
            </span>
          </div>
          {/* Steps */}
          <div className="ml-acc-col">
            <span className="metric-label">Steps</span>
            <span className="text-muted" style={{ fontFamily: "monospace" }}>{m.n_steps ?? "—"}</span>
          </div>
        </div>
      </div>
      {open && m.interpretation && (
        <div className="ml-interp fade-in">{m.interpretation}</div>
      )}
    </div>
  );
}

// ── Ensemble Panel ────────────────────────────────────────────────────────────
function EnsemblePanel({ data }: { data: EnsembleResult }) {
  const mc = data.monte_carlo;
  const fanData = mc.fan_chart.map((f) => ({
    day: `D${f.day}`, p10: f.p10, p25: f.p25, p50: f.p50, p75: f.p75, p90: f.p90,
  }));
  const isUp = data.direction === "Up";

  return (
    <div className="ml-ensemble">
      {/* Main verdict */}
      <div className={`ml-ensemble-verdict ${isUp ? "ml-verdict-bull" : "ml-verdict-bear"}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isUp ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {data.direction} — {data.conviction_label} Conviction
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              {data.prob_up_pct}% probability up · Conviction: {data.conviction}/100
            </div>
          </div>
        </div>
      </div>

      {/* Model votes */}
      {data.model_votes.length > 0 && (
        <div className="ml-votes">
          <span className="metric-label">Model Votes (weighted)</span>
          <div className="ml-votes-grid" style={{ marginTop: 6 }}>
            {data.model_votes.map((v) => (
              <div key={v.name} className="ml-vote-card">
                <span className="font-bold" style={{ fontSize: 12 }}>{v.name}</span>
                <span style={{ color: dirColor(v.direction), fontWeight: 700 }}>{v.direction}</span>
                <span className="text-muted" style={{ fontSize: 11 }}>
                  {fmtPct(v.prob_up * 100)} · wt {v.weight.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monte Carlo fan chart */}
      <div>
        <div className="sub-pane-label">Monte Carlo Return Distribution ({mc.fan_chart.length}-day)</div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={fanData}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
            <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />
            <Area dataKey="p90" stroke="none" fill="#dbeafe" fillOpacity={0.4} name="P90" />
            <Area dataKey="p10" stroke="none" fill="#ffffff" fillOpacity={1} name="P10" />
            <Area dataKey="p75" stroke="none" fill="#bfdbfe" fillOpacity={0.5} name="P75" />
            <Area dataKey="p25" stroke="none" fill="#ffffff" fillOpacity={1} name="P25" />
            <Line dataKey="p50" stroke={isUp ? "#059669" : "#dc2626"} strokeWidth={2.5} dot={false} name="Median" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="ml-mc-stats">
          <Stat label="Prob Up (MC)" val={`${mc.prob_up}%`} color={pctColor(mc.prob_up, 50)} />
          <Stat label="Median Return" val={fmtPct(mc.median_ret)} color={mc.median_ret >= 0 ? "#059669" : "#dc2626"} />
          <Stat label="P10 (bear)" val={fmtPct(mc.p10)} color="#dc2626" />
          <Stat label="P90 (bull)" val={fmtPct(mc.p90)} color="#059669" />
        </div>
      </div>

      {/* Regime */}
      <div className="ml-regime">
        <span className="metric-label">Current Market Regime</span>
        <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
          <Stat label="Type" val={data.regime.type} />
          <Stat label="Ann. Volatility" val={`${data.regime.vol_ann.toFixed(1)}%`} />
          <Stat label="Trend Strength" val={data.regime.trend_strength.toFixed(3)} />
        </div>
      </div>
    </div>
  );
}

// ── Enhanced Backtest Panel ───────────────────────────────────────────────────
function BacktestV2Panel({ data }: { data: EnhancedBacktestResult }) {
  const s = data.summary;
  const pathData = s.avg_path.map((v: number, i: number) => ({
    day: `D${i + 1}`,
    avg: v,
    p10: s.p10_path[i],
    p90: s.p90_path[i],
  }));
  const confColor = s.confidence_score >= 55 ? "#059669"
    : s.confidence_score >= 35 ? "#d97706" : "#dc2626";

  return (
    <div className="ml-backtest">
      <div className="ml-backtest-header">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <span className="metric-label">Confidence v2</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: confColor }}>{s.confidence_score}/100</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span className="metric-label">Bias</span>
            <div style={{ fontSize: 18, fontWeight: 700, color: dirColor(s.directional_bias) }}>{s.directional_bias}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span className="metric-label">Regime</span>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{s.current_regime} ({s.current_vol.toFixed(1)}% ann. vol)</div>
          </div>
        </div>
        <div className="ml-score-improve">
          v2 improvements: z-score normalization · composite scoring (corr+shape+slope+tail) · regime filtering · vol-adjusted lookahead
        </div>
      </div>

      <div className="risk-grid" style={{ marginBottom: 10 }}>
        <Stat label="Matches" val={String(s.total_matches)} />
        <Stat label="Avg Return" val={fmtPct(s.avg_return)} color={s.avg_return >= 0 ? "#059669" : "#dc2626"} />
        <Stat label="Median" val={fmtPct(s.median_return)} />
        <Stat label="Std Dev" val={fmtPct(s.std_return)} />
        <Stat label="% Positive" val={`${s.pct_positive}%`} color={pctColor(s.pct_positive, 50)} />
        <Stat label="Avg Max Gain" val={`+${s.avg_max_gain}%`} color="#059669" />
        <Stat label="Avg Max Loss" val={`${s.avg_max_loss}%`} color="#dc2626" />
        <Stat label="Avg Score" val={s.avg_score.toFixed(3)} />
        <Stat label="Avg Sharpe" val={s.avg_sharpe_after.toFixed(3)} color={s.avg_sharpe_after >= 0.5 ? "#059669" : "#6b7280"} />
        <Stat label="Data Points" val={String(data.dataPoints)} />
      </div>

      {pathData.length > 0 && (
        <>
          <div className="sub-pane-label">Historical outcome paths after pattern</div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={pathData}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
              <ReferenceLine y={0} stroke="#e5e7eb" />
              <Area dataKey="p90" stroke="none" fill="#dbeafe" fillOpacity={0.4} name="P90" />
              <Area dataKey="p10" stroke="none" fill="#ffffff" fillOpacity={1} name="P10" />
              <Line dataKey="avg" stroke="#1f2937" strokeWidth={2.5} dot={false} name="Avg" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      <p className="text-muted text-sm" style={{ marginTop: 8 }}>
        {typeof data.note === "string" ? data.note : ""}
      </p>
    </div>
  );
}

function Stat({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div className="risk-metric">
      <span className="metric-label">{label}</span>
      <span className="risk-value" style={color ? { color } : {}}>{val}</span>
    </div>
  );
}

// ── Main ModelLab ─────────────────────────────────────────────────────────────
export function ModelLab({ symbol }: Props) {
  const [tab, setTab]             = useState<ActiveTab>("compare");
  const [period, setPeriod]       = useState<ModelPeriod>("2y");
  const [lookahead, setLookahead] = useState<LookAhead>(10);
  const [window, setWindow]       = useState(20);
  const [loading, setLoading]     = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [compare, setCompare]     = useState<CompareResult | null>(null);
  const [ensemble, setEnsemble]   = useState<EnsembleResult | null>(null);
  const [backtest, setBacktest]   = useState<EnhancedBacktestResult | null>(null);

  const load = useCallback(async (retrain = false) => {
    setLoading(true); setError(null);
    try {
      if (tab === "compare") {
        const r = await fetchModelCompare(symbol, period, lookahead, retrain);
        setCompare(r);
      } else if (tab === "ensemble") {
        const r = await fetchEnsemble(symbol, period, lookahead, retrain);
        setEnsemble(r);
      } else {
        const r = await fetchEnhancedBacktest(symbol, window, lookahead, retrain);
        setBacktest(r);
      }
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [tab, symbol, period, lookahead, window]);

  const retrain = useCallback(async () => {
    setRetraining(true);
    await resetModelCache(symbol);
    setRetraining(false);
    load(true);
  }, [symbol, load]);

  useEffect(() => { load(false); }, [load]);

  return (
    <Card title={`Model Lab — ${symbol}`}>
      {/* Tab selector */}
      <div className="ml-tabs">
        {([
          ["compare",  "Model Comparison"],
          ["ensemble", "Ensemble + Monte Carlo"],
          ["backtest", "Pattern Backtest v2"],
        ] as const).map(([id, label]) => (
          <button key={id} className={`ml-tab-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Settings bar */}
      <div className="ml-settings">
        <label>Period:
          <select value={period} onChange={(e) => setPeriod(e.target.value as ModelPeriod)}>
            {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>Lookahead:
          <select value={lookahead} onChange={(e) => setLookahead(+e.target.value as LookAhead)}>
            {AHEAD_OPTIONS.map((v) => <option key={v} value={v}>{v}d</option>)}
          </select>
        </label>
        {tab === "backtest" && (
          <label>Window:
            <select value={window} onChange={(e) => setWindow(+e.target.value)}>
              {[10, 15, 20, 30, 40].map((v) => <option key={v} value={v}>{v}d</option>)}
            </select>
          </label>
        )}
        <button className="ml-retrain-btn" onClick={retrain} disabled={retraining || loading}>
          <RotateCcw size={13} style={{ animation: retraining ? "spin 1s linear infinite" : "none" }} />
          {retraining ? "Clearing cache…" : "Retrain / Reset"}
        </button>
        <span className="text-muted" style={{ fontSize: 11 }}>
          Retrain clears all cached model results for {symbol} and re-runs from fresh data
        </span>
      </div>

      {loading && <Loading message={`Running R models for ${symbol}… this may take 20–40 seconds`} />}
      {error && (
        <div className="ml-error">
          <AlertTriangle size={16} style={{ color: "#dc2626" }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Compare tab ── */}
      {!loading && !error && tab === "compare" && compare && (
        <div className="ml-compare fade-in">
          {/* Consensus */}
          <div className={`ml-consensus ${compare.consensus.direction === "Bullish" ? "ml-consensus-bull" : "ml-consensus-bear"}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {compare.consensus.direction === "Bullish"
                ? <CheckCircle size={20} style={{ color: "#059669" }} />
                : <TrendingDown size={20} style={{ color: "#dc2626" }} />}
              <div>
                <span className="font-bold" style={{ fontSize: 16 }}>
                  {compare.consensus.label} — {compare.consensus.direction}
                </span>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {compare.consensus.n_bullish} bull · {compare.consensus.n_bearish} bear
                  · Agreement: {compare.consensus.agreement_pct}%
                  · {compare.dataPoints} days of data
                </div>
              </div>
            </div>
          </div>

          {/* Model rows */}
          <div className="ml-model-list" style={{ marginTop: 12 }}>
            <div className="ml-model-list-header">
              <span>Model</span>
              <span style={{ textAlign: "right" }}>Direction · P(Up) · Dir Acc · Skill · WF Steps</span>
            </div>
            {compare.models.map((m, i) => (
              <ModelRow key={i} m={m} isConsensus={
                m.direction?.toLowerCase().includes(compare.consensus.direction.toLowerCase().slice(0, 2)) ?? false
              } />
            ))}
          </div>

          {/* Accuracy chart */}
          {compare.models.some((m) => m.success && m.dir_accuracy != null) && (
            <div style={{ marginTop: 16 }}>
              <div className="sub-pane-label">Walk-Forward Directional Accuracy vs Naive Baseline</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={compare.models.filter((m) => m.success && m.dir_accuracy != null).map((m) => ({
                    name: m.name,
                    accuracy: m.dir_accuracy,
                    skill: m.skill_score,
                    naive: m.dir_accuracy != null && m.skill_score != null
                      ? m.dir_accuracy - m.skill_score : null,
                  }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[40, 80]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                  <ReferenceLine y={50} stroke="#d97706" strokeDasharray="3 3" label={{ value: "50% random", fontSize: 10 }} />
                  <Bar shape={SafeBarShape} dataKey="naive" fill="#e5e7eb" name="Naive baseline" />
                  <Bar shape={SafeBarShape} dataKey="accuracy" fill="#4f46e5" name="Model accuracy" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="ml-disclaimer">
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            Models trained on historical data. Walk-forward avoids look-ahead bias but past accuracy ≠ future performance.
            Skill score = model accuracy minus naive baseline. NOT financial advice.
          </div>
        </div>
      )}

      {/* ── Ensemble tab ── */}
      {!loading && !error && tab === "ensemble" && ensemble && (
        <EnsemblePanel data={ensemble} />
      )}

      {/* ── Backtest v2 tab ── */}
      {!loading && !error && tab === "backtest" && backtest && (
        <BacktestV2Panel data={backtest} />
      )}
    </Card>
  );
}
