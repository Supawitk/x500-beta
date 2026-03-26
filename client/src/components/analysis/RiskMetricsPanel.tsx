import { useMemo } from "react";
import { Card } from "../common/Card";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Shield, TrendingDown, Activity, AlertTriangle } from "lucide-react";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
}

interface RiskMetrics {
  dailyReturns: number[];
  annualizedReturn: number;
  annualizedVol: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownStart: string;
  maxDrawdownEnd: string;
  currentDrawdown: number;
  var95: number;
  var99: number;
  cvar95: number;
  calmarRatio: number;
  downsideDeviation: number;
  positiveRatio: number;
  avgGain: number;
  avgLoss: number;
  bestDay: { date: string; ret: number };
  worstDay: { date: string; ret: number };
  drawdownSeries: { date: string; dd: number }[];
  returnDist: { bucket: string; count: number; color: string }[];
}

function computeMetrics(data: AnalysisDataPoint[]): RiskMetrics | null {
  if (data.length < 10) return null;

  const rf = 0.05 / 252; // daily risk-free rate
  const dailyReturns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    dailyReturns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
  }

  const n = dailyReturns.length;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / n;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const vol = Math.sqrt(variance);

  // Annualized
  const annualizedReturn = mean * 252;
  const annualizedVol = vol * Math.sqrt(252);

  // Sharpe
  const sharpeRatio = annualizedVol > 0 ? (annualizedReturn - 0.05) / annualizedVol : 0;

  // Downside deviation (Sortino)
  const negReturns = dailyReturns.filter(r => r < 0);
  const downsideVar = negReturns.length > 0
    ? negReturns.reduce((s, r) => s + r ** 2, 0) / negReturns.length
    : 0;
  const downsideDeviation = Math.sqrt(downsideVar) * Math.sqrt(252);
  const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - 0.05) / downsideDeviation : 0;

  // Max drawdown
  let peak = data[0].close;
  let maxDD = 0;
  let ddStart = 0, ddEnd = 0, ddPeakIdx = 0;
  let currentDD = 0;
  const drawdownSeries: { date: string; dd: number }[] = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i].close > peak) { peak = data[i].close; ddPeakIdx = i; }
    const dd = (data[i].close - peak) / peak;
    drawdownSeries.push({ date: data[i].date.slice(5), dd: dd * 100 });
    if (dd < maxDD) { maxDD = dd; ddStart = ddPeakIdx; ddEnd = i; }
    if (i === data.length - 1) currentDD = dd;
  }

  // VaR (Historical)
  const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
  const var95Idx = Math.floor(n * 0.05);
  const var99Idx = Math.floor(n * 0.01);
  const var95 = sortedReturns[var95Idx] ?? 0;
  const var99 = sortedReturns[var99Idx] ?? 0;

  // CVaR (Expected Shortfall)
  const cvar95 = sortedReturns.slice(0, var95Idx + 1).reduce((a, b) => a + b, 0) / (var95Idx + 1 || 1);

  // Calmar ratio
  const calmarRatio = maxDD !== 0 ? annualizedReturn / Math.abs(maxDD) : 0;

  // Win/loss stats
  const gains = dailyReturns.filter(r => r > 0);
  const losses = dailyReturns.filter(r => r < 0);
  const positiveRatio = gains.length / n;
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

  // Best/worst day
  let bestIdx = 0, worstIdx = 0;
  for (let i = 1; i < dailyReturns.length; i++) {
    if (dailyReturns[i] > dailyReturns[bestIdx]) bestIdx = i;
    if (dailyReturns[i] < dailyReturns[worstIdx]) worstIdx = i;
  }

  // Return distribution histogram
  const buckets = [
    { min: -Infinity, max: -0.03, label: "<-3%", color: "#dc2626" },
    { min: -0.03, max: -0.02, label: "-3%–-2%", color: "#ef4444" },
    { min: -0.02, max: -0.01, label: "-2%–-1%", color: "#f87171" },
    { min: -0.01, max: 0, label: "-1%–0%", color: "#fca5a5" },
    { min: 0, max: 0.01, label: "0%–1%", color: "#86efac" },
    { min: 0.01, max: 0.02, label: "1%–2%", color: "#34d399" },
    { min: 0.02, max: 0.03, label: "2%–3%", color: "#10b981" },
    { min: 0.03, max: Infinity, label: ">3%", color: "#059669" },
  ];
  const returnDist = buckets.map(b => ({
    bucket: b.label,
    count: dailyReturns.filter(r => r >= b.min && r < b.max).length,
    color: b.color,
  }));

  return {
    dailyReturns,
    annualizedReturn,
    annualizedVol,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown: maxDD,
    maxDrawdownStart: data[ddStart]?.date ?? "",
    maxDrawdownEnd: data[ddEnd]?.date ?? "",
    currentDrawdown: currentDD,
    var95,
    var99,
    cvar95,
    calmarRatio,
    downsideDeviation,
    positiveRatio,
    avgGain,
    avgLoss,
    bestDay: { date: data[bestIdx + 1]?.date ?? "", ret: dailyReturns[bestIdx] },
    worstDay: { date: data[worstIdx + 1]?.date ?? "", ret: dailyReturns[worstIdx] },
    drawdownSeries,
    returnDist,
  };
}

function fmtPct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

function riskLevel(vol: number): { label: string; color: string } {
  if (vol < 0.15) return { label: "Low Risk", color: "#059669" };
  if (vol < 0.25) return { label: "Moderate", color: "#d97706" };
  if (vol < 0.40) return { label: "High Risk", color: "#f87171" };
  return { label: "Very High", color: "#dc2626" };
}

function sharpeGrade(s: number): { label: string; color: string } {
  if (s > 1.5) return { label: "Excellent", color: "#059669" };
  if (s > 1.0) return { label: "Good", color: "#34d399" };
  if (s > 0.5) return { label: "Average", color: "#d97706" };
  if (s > 0) return { label: "Below Avg", color: "#f87171" };
  return { label: "Poor", color: "#dc2626" };
}

export function RiskMetricsPanel({ data, symbol }: Props) {
  const metrics = useMemo(() => computeMetrics(data), [data]);

  if (!metrics) return null;

  const risk = riskLevel(metrics.annualizedVol);
  const sGrade = sharpeGrade(metrics.sharpeRatio);

  return (
    <Card title={`Risk Analytics — ${symbol}`}>
      {/* Top metric cards */}
      <div className="rm-top-grid">
        <div className="rm-metric-card">
          <div className="rm-metric-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
            <Activity size={16} />
          </div>
          <div className="rm-metric-body">
            <span className="rm-metric-label">Ann. Return</span>
            <span className="rm-metric-val" style={{ color: metrics.annualizedReturn >= 0 ? "#059669" : "#dc2626" }}>
              {fmtPct(metrics.annualizedReturn)}
            </span>
          </div>
        </div>

        <div className="rm-metric-card">
          <div className="rm-metric-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
            <AlertTriangle size={16} />
          </div>
          <div className="rm-metric-body">
            <span className="rm-metric-label">Ann. Volatility</span>
            <span className="rm-metric-val">{fmtPct(metrics.annualizedVol)}</span>
            <span className="rm-metric-tag" style={{ color: risk.color, background: risk.color + "15" }}>{risk.label}</span>
          </div>
        </div>

        <div className="rm-metric-card">
          <div className="rm-metric-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
            <Shield size={16} />
          </div>
          <div className="rm-metric-body">
            <span className="rm-metric-label">Sharpe Ratio</span>
            <span className="rm-metric-val">{metrics.sharpeRatio.toFixed(2)}</span>
            <span className="rm-metric-tag" style={{ color: sGrade.color, background: sGrade.color + "15" }}>{sGrade.label}</span>
          </div>
        </div>

        <div className="rm-metric-card">
          <div className="rm-metric-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
            <TrendingDown size={16} />
          </div>
          <div className="rm-metric-body">
            <span className="rm-metric-label">Max Drawdown</span>
            <span className="rm-metric-val" style={{ color: "#dc2626" }}>{fmtPct(metrics.maxDrawdown)}</span>
            <span className="rm-metric-sub">{metrics.maxDrawdownStart.slice(5)} → {metrics.maxDrawdownEnd.slice(5)}</span>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="rm-charts-grid">
        {/* Drawdown chart */}
        <div className="rm-chart-block">
          <div className="rm-chart-title">Drawdown Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={metrics.drawdownSeries} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} width={40} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
              />
              <ReferenceLine y={-10} stroke="#d97706" strokeDasharray="3 3" strokeWidth={0.7} />
              <ReferenceLine y={-20} stroke="#dc2626" strokeDasharray="3 3" strokeWidth={0.7} />
              <Area dataKey="dd" stroke="#dc2626" fill="#dc262620" strokeWidth={1.2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Return distribution */}
        <div className="rm-chart-block">
          <div className="rm-chart-title">Return Distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={metrics.returnDist} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 8 }} interval={0} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 9 }} width={30} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [`${v} days`, "Count"]}
              />
              <Bar shape={SafeBarShape} dataKey="count" radius={[3, 3, 0, 0]}>
                {metrics.returnDist.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed metrics grid */}
      <div className="rm-detail-grid">
        <div className="rm-detail-section">
          <div className="rm-detail-title">Risk-Adjusted Returns</div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Sharpe Ratio</span>
            <span className="rm-detail-val">{metrics.sharpeRatio.toFixed(3)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Sortino Ratio</span>
            <span className="rm-detail-val">{metrics.sortinoRatio.toFixed(3)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Calmar Ratio</span>
            <span className="rm-detail-val">{metrics.calmarRatio.toFixed(3)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Downside Dev.</span>
            <span className="rm-detail-val">{fmtPct(metrics.downsideDeviation)}</span>
          </div>
        </div>

        <div className="rm-detail-section">
          <div className="rm-detail-title">Value at Risk (Daily)</div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">VaR 95%</span>
            <span className="rm-detail-val" style={{ color: "#dc2626" }}>{fmtPct(metrics.var95)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">VaR 99%</span>
            <span className="rm-detail-val" style={{ color: "#dc2626" }}>{fmtPct(metrics.var99)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">CVaR 95% (ES)</span>
            <span className="rm-detail-val" style={{ color: "#dc2626" }}>{fmtPct(metrics.cvar95)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Current DD</span>
            <span className="rm-detail-val">{fmtPct(metrics.currentDrawdown)}</span>
          </div>
        </div>

        <div className="rm-detail-section">
          <div className="rm-detail-title">Win / Loss Stats</div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Win Rate</span>
            <span className="rm-detail-val" style={{ color: "#059669" }}>{fmtPct(metrics.positiveRatio, 1)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Avg Win</span>
            <span className="rm-detail-val" style={{ color: "#059669" }}>+{fmtPct(metrics.avgGain)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Avg Loss</span>
            <span className="rm-detail-val" style={{ color: "#dc2626" }}>{fmtPct(metrics.avgLoss)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Gain/Loss Ratio</span>
            <span className="rm-detail-val">
              {metrics.avgLoss !== 0 ? (Math.abs(metrics.avgGain / metrics.avgLoss)).toFixed(2) : "—"}
            </span>
          </div>
        </div>

        <div className="rm-detail-section">
          <div className="rm-detail-title">Extremes</div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Best Day</span>
            <span className="rm-detail-val" style={{ color: "#059669" }}>
              +{fmtPct(metrics.bestDay.ret)}
              <span className="rm-detail-sub-inline">{metrics.bestDay.date.slice(5)}</span>
            </span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Worst Day</span>
            <span className="rm-detail-val" style={{ color: "#dc2626" }}>
              {fmtPct(metrics.worstDay.ret)}
              <span className="rm-detail-sub-inline">{metrics.worstDay.date.slice(5)}</span>
            </span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Max Drawdown</span>
            <span className="rm-detail-val" style={{ color: "#dc2626" }}>{fmtPct(metrics.maxDrawdown)}</span>
          </div>
          <div className="rm-detail-row">
            <span className="rm-detail-label">Period Days</span>
            <span className="rm-detail-val">{data.length}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
