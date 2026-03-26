import { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Loading } from "../common/Loading";
import { fetchEarningsDividend, type EarningsDividendData, type EpsHistoryItem, type IncomeEntry } from "../../api/earnings";
import { Calendar, TrendingUp, DollarSign, BarChart2, Activity } from "lucide-react";
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Line } from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";

interface Props {
  symbol: string;
}

type Tab = "earnings" | "dividend" | "financials";

function pct(v: number | null, decimals = 1): string {
  if (v == null) return "N/A";
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmtRev(v: number | null): string {
  if (v == null) return "N/A";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function daysLabel(days: number | null): string {
  if (days == null) return "";
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}

function revisionColor(label: string): string {
  if (label.includes("Strongly Bullish")) return "#059669";
  if (label.includes("Bullish")) return "#34d399";
  if (label.includes("Neutral")) return "#6b7280";
  if (label.includes("Bearish")) return "#f87171";
  return "#6b7280";
}

function safetyColor(color: string): string {
  if (color === "green")  return "#059669";
  if (color === "yellow") return "#d97706";
  if (color === "red")    return "#dc2626";
  return "#6b7280";
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="risk-metric">
      <span className="metric-label">{label}</span>
      <span className="risk-value" style={color ? { color } : {}}>{value}</span>
      {sub && <span className="text-muted" style={{ fontSize: 10 }}>{sub}</span>}
    </div>
  );
}

function EpsBar({ item }: { item: EpsHistoryItem }) {
  const q = item.quarter ? item.quarter.slice(0, 7) : "?";
  const surp = item.surprise;
  const beat = item.beat;
  const pctStr = surp != null ? `${surp > 0 ? "+" : ""}${(surp * 100).toFixed(1)}%` : "?";
  return (
    <div className="eps-history-row">
      <span className="eps-quarter">{q}</span>
      <span className="eps-val">Est: {item.estimate != null ? `$${item.estimate.toFixed(2)}` : "?"}</span>
      <span className="eps-val">Act: {item.actual != null ? `$${item.actual.toFixed(2)}` : "?"}</span>
      <span className={`eps-surprise ${beat ? "text-green" : "text-red"}`}>
        {beat ? "✓" : "✗"} {pctStr}
      </span>
    </div>
  );
}

function EarningsTab({ data }: { data: EarningsDividendData }) {
  const { earnings: e, valuation: v } = data;
  const ee = e.epsEstimate;
  const re = e.revenueEstimate;

  return (
    <div className="ed-tab-content fade-in">
      {/* Next earnings date */}
      <div className="ed-highlight-row">
        <Calendar size={16} style={{ color: "#4f46e5" }} />
        <div>
          <span className="font-bold">Next Earnings: </span>
          <span>{e.nextEarningsDate ?? "Unknown"}</span>
          {e.daysUntilEarnings != null && (
            <span className={`ed-days-badge ${e.daysUntilEarnings <= 14 ? "badge-red" : "badge-yellow"}`}>
              {daysLabel(e.daysUntilEarnings)}
            </span>
          )}
          {e.isEstimate && <span className="text-muted text-sm"> (est.)</span>}
        </div>
      </div>

      {/* EPS & Revenue estimates */}
      <div className="risk-grid" style={{ margin: "10px 0" }}>
        <Stat label="EPS Estimate"
          value={ee.current != null ? `$${ee.current.toFixed(2)}` : "N/A"}
          sub={ee.yearAgo != null ? `Year-ago: $${ee.yearAgo.toFixed(2)}` : undefined}
          color={ee.growth != null && ee.growth > 0 ? "#059669" : undefined} />
        <Stat label="EPS Growth"
          value={ee.growth != null ? `${(ee.growth * 100).toFixed(1)}%` : "N/A"}
          color={ee.growth != null ? (ee.growth > 0 ? "#059669" : "#dc2626") : undefined} />
        <Stat label="EPS Range"
          value={ee.low != null && ee.high != null ? `$${ee.low.toFixed(2)}–$${ee.high.toFixed(2)}` : "N/A"}
          sub={ee.analysts != null ? `${ee.analysts} analysts` : undefined} />
        <Stat label="Rev Estimate"
          value={fmtRev(re.avg)}
          sub={re.yearAgo != null ? `Year-ago: ${fmtRev(re.yearAgo)}` : undefined} />
        <Stat label="Rev Growth"
          value={re.growth != null ? `${(re.growth * 100).toFixed(1)}%` : "N/A"}
          color={re.growth != null ? (re.growth > 0 ? "#059669" : "#dc2626") : undefined} />
        <Stat label="Trailing P/E"
          value={v.trailingPE != null ? v.trailingPE.toFixed(1) : "N/A"} />
        <Stat label="Forward P/E"
          value={v.forwardPE != null ? v.forwardPE.toFixed(1) : "N/A"}
          color={v.forwardPE != null && v.trailingPE != null
            ? (v.forwardPE < v.trailingPE ? "#059669" : "#d97706") : undefined} />
        <Stat label="P/Sales"
          value={v.priceSales != null ? v.priceSales.toFixed(2) : "N/A"} />
      </div>

      {/* EPS revision momentum */}
      <div className="ed-revisions">
        <span className="metric-label">Analyst Revisions (30d)</span>
        <div className="ed-revision-row">
          <span className="text-green">▲ {e.revisions.up30d} raised</span>
          <span className="text-red" style={{ marginLeft: 12 }}>▼ {e.revisions.down30d} cut</span>
          <span className="font-bold" style={{ marginLeft: 14, color: revisionColor(e.revisions.label) }}>
            → {e.revisions.label}
          </span>
        </div>
      </div>

      {/* EPS trend (how estimate changed over time) */}
      {e.epsTrend && (
        <div className="ed-trend">
          <span className="metric-label">EPS Estimate Drift</span>
          <div className="ed-trend-row">
            {[
              { label: "90d ago", val: e.epsTrend.d90 },
              { label: "60d ago", val: e.epsTrend.d60 },
              { label: "30d ago", val: e.epsTrend.d30 },
              { label: "7d ago",  val: e.epsTrend.d7 },
              { label: "Current", val: e.epsTrend.current },
            ].map(({ label, val }) => (
              <div key={label} className="ed-drift-cell">
                <span className="metric-label">{label}</span>
                <span className="font-bold">{val != null ? `$${val.toFixed(2)}` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical beats/misses */}
      {e.history.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span className="metric-label">Last 4 Quarters — Beat / Miss</span>
          <div className="eps-history">
            {e.history.map((h, i) => <EpsBar key={i} item={h} />)}
          </div>
        </div>
      )}

      {/* Forward estimates */}
      {(e.nextQ || e.annualEst) && (
        <div className="risk-grid" style={{ marginTop: 10 }}>
          {e.nextQ && (
            <Stat label="Next Q EPS"
              value={e.nextQ.epsAvg != null ? `$${e.nextQ.epsAvg.toFixed(2)}` : "N/A"}
              sub={e.nextQ.growth != null ? `Growth: ${(e.nextQ.growth * 100).toFixed(1)}%` : undefined} />
          )}
          {e.annualEst && (
            <Stat label="Annual EPS Est."
              value={e.annualEst.epsAvg != null ? `$${e.annualEst.epsAvg.toFixed(2)}` : "N/A"}
              sub={e.annualEst.growth != null ? `Growth: ${(e.annualEst.growth * 100).toFixed(1)}%` : undefined} />
          )}
        </div>
      )}
    </div>
  );
}

function DividendTab({ data }: { data: EarningsDividendData }) {
  const div = data.dividend;

  if (!div.isDividendPayer) {
    return (
      <div className="ed-tab-content fade-in">
        <div className="ed-no-div">
          <DollarSign size={32} style={{ color: "#d1d5db", margin: "0 auto 8px", display: "block" }} />
          <p className="text-muted" style={{ textAlign: "center" }}>
            {data.symbol} does not currently pay a dividend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ed-tab-content fade-in">
      {/* Ex-dividend date highlight */}
      {div.exDivDate && (
        <div className="ed-highlight-row">
          <DollarSign size={16} style={{ color: "#059669" }} />
          <div>
            <span className="font-bold">Ex-Dividend: </span>
            <span>{div.exDivDate}</span>
            {div.daysUntilExDiv != null && (
              <span className={`ed-days-badge ${
                div.daysUntilExDiv > 0 && div.daysUntilExDiv <= 14 ? "badge-green"
                : div.daysUntilExDiv <= 0 ? "badge-red" : "badge-yellow"
              }`}>
                {daysLabel(div.daysUntilExDiv)}
              </span>
            )}
            {div.payDate && (
              <span className="text-muted text-sm"> · Pay date: {div.payDate}</span>
            )}
          </div>
        </div>
      )}

      <div className="risk-grid" style={{ margin: "10px 0" }}>
        <Stat label="Annual Dividend"
          value={div.annualRate != null ? `$${div.annualRate.toFixed(2)}/yr` : "N/A"} />
        <Stat label="Current Yield"
          value={pct(div.currentYield)}
          color={div.currentYield != null && div.currentYield > 0.02 ? "#059669" : undefined} />
        <Stat label="5yr Avg Yield"
          value={pct(div.fiveYearAvgYield)}
          color={div.fiveYearAvgYield != null && div.currentYield != null
            ? (div.currentYield >= div.fiveYearAvgYield ? "#059669" : "#d97706") : undefined} />
        <Stat label="Yield vs 5yr Avg"
          value={div.divVs5yrPct != null ? `${div.divVs5yrPct > 0 ? "+" : ""}${div.divVs5yrPct.toFixed(1)}%` : "N/A"}
          sub="+ = above historical avg"
          color={div.divVs5yrPct != null ? (div.divVs5yrPct > 0 ? "#059669" : "#d97706") : undefined} />
        <Stat label="Payout Ratio"
          value={div.payoutRatio != null ? pct(div.payoutRatio) : "N/A"} />
        <Stat label="Payout Safety"
          value={div.payoutSafety}
          color={safetyColor(div.payoutSafetyColor)} />
      </div>

      {/* Payout ratio visual bar */}
      {div.payoutRatio != null && (
        <div style={{ marginTop: 6, marginBottom: 10 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 11, color: "#6b7280", marginBottom: 3,
          }}>
            <span>0%</span><span>40% Safe</span><span>75% Elevated</span><span>100%+</span>
          </div>
          <div style={{
            height: 10, background: "linear-gradient(to right, #059669, #d97706, #dc2626)",
            borderRadius: 5, position: "relative",
          }}>
            <div style={{
              position: "absolute", top: -4, left: `${Math.min(div.payoutRatio * 100, 100)}%`,
              width: 18, height: 18, borderRadius: "50%",
              background: "#4f46e5", border: "2px solid white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              transform: "translateX(-50%)",
            }} />
          </div>
        </div>
      )}

      {/* Value investor note */}
      <div className="ed-vi-note">
        <span className="metric-label">Value Investor Signal</span>
        <p className="text-sm" style={{ marginTop: 4, lineHeight: 1.6 }}>
          {div.divVs5yrPct != null && div.divVs5yrPct > 10
            ? `📈 Yield is ${div.divVs5yrPct.toFixed(1)}% above its 5yr average — stock may be undervalued relative to its dividend history.`
            : div.divVs5yrPct != null && div.divVs5yrPct < -10
            ? `⚠️ Yield is ${Math.abs(div.divVs5yrPct).toFixed(1)}% below its 5yr average — stock may be expensive or dividend was cut.`
            : "Yield is near its 5yr historical average. No strong value signal from dividends alone."}
          {div.payoutSafetyColor === "green"
            ? " Payout ratio is healthy and dividend appears sustainable."
            : div.payoutSafetyColor === "red"
            ? " High payout ratio — dividend sustainability may be a concern."
            : ""}
        </p>
      </div>
    </div>
  );
}

function fmtCompact(v: number | null): string {
  if (v == null) return "N/A";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function FinancialsTab({ data }: { data: EarningsDividendData }) {
  const mapIncome = (entries: IncomeEntry[]) => entries.map((e) => ({
    period: e.date ? e.date.slice(0, 7) : "?",
    Revenue: e.revenue,
    "Gross Profit": e.grossProfit,
    "Net Income": e.netIncome,
    "Op. Income": e.operatingIncome,
  }));

  const mapMargins = (entries: IncomeEntry[]) => entries.map((e) => ({
    period: e.date ? e.date.slice(0, 7) : "?",
    "Gross Margin": e.grossMargin != null ? +(e.grossMargin * 100).toFixed(1) : null,
    "Op. Margin": e.opMargin != null ? +(e.opMargin * 100).toFixed(1) : null,
    "Net Margin": e.netMargin != null ? +(e.netMargin * 100).toFixed(1) : null,
  }));

  const mapEps = (entries: IncomeEntry[]) => entries.map((e) => ({
    period: e.date ? e.date.slice(0, 7) : "?",
    EPS: e.eps,
  }));

  const annualIncome = mapIncome(data.incomeHistory?.annual ?? []);
  const quarterlyIncome = mapIncome(data.incomeHistory?.quarterly ?? []);

  const [view, setView] = useState<"annual" | "quarterly">("quarterly");
  const rawEntries = view === "annual" ? (data.incomeHistory?.annual ?? []) : (data.incomeHistory?.quarterly ?? []);
  const incomeData = view === "annual" ? annualIncome : quarterlyIncome;
  const marginData = mapMargins(rawEntries);
  const epsData = mapEps(rawEntries);

  const formatYAxis = (v: number) => {
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
    return `${v}`;
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="ed-chart-tooltip">
        <div className="font-bold">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, fontSize: 12 }}>
            {p.name}: {typeof p.value === "number" && Math.abs(p.value) >= 1e6 ? fmtCompact(p.value) : p.value}
          </div>
        ))}
      </div>
    );
  };

  const marginTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="ed-chart-tooltip">
        <div className="font-bold">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, fontSize: 12 }}>
            {p.name}: {p.value != null ? `${p.value}%` : "N/A"}
          </div>
        ))}
      </div>
    );
  };

  if (incomeData.length === 0) {
    return (
      <div className="ed-tab-content fade-in">
        <div className="nws-empty">No financial history available.</div>
      </div>
    );
  }

  return (
    <div className="ed-tab-content fade-in">
      {/* Toggle */}
      <div className="ed-fin-header">
        <span className="metric-label">Income Statement</span>
        <div className="ed-fin-toggle">
          <button
            className={`ed-fin-btn ${view === "quarterly" ? "active" : ""}`}
            onClick={() => setView("quarterly")}
          >Quarterly</button>
          <button
            className={`ed-fin-btn ${view === "annual" ? "active" : ""}`}
            onClick={() => setView("annual")}
          >Annual</button>
        </div>
      </div>

      {/* Revenue & Income Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={incomeData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" fontSize={11} tick={{ fill: "var(--text-muted)" }} />
          <YAxis fontSize={10} tick={{ fill: "var(--text-muted)" }} tickFormatter={formatYAxis} />
          <Tooltip content={customTooltip} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar shape={SafeBarShape} dataKey="Revenue" fill="#818cf8" radius={[3, 3, 0, 0]} />
          <Bar shape={SafeBarShape} dataKey="Gross Profit" fill="#34d399" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="Net Income" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Margins Chart */}
      {marginData.some(d => d["Gross Margin"] != null) && (
        <div style={{ marginTop: 14 }}>
          <span className="metric-label">Profit Margins (%)</span>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={marginData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" fontSize={11} tick={{ fill: "var(--text-muted)" }} />
              <YAxis fontSize={10} tick={{ fill: "var(--text-muted)" }} unit="%" />
              <Tooltip content={marginTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Gross Margin" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Op. Margin" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Net Margin" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* EPS Trend */}
      {epsData.some(d => d.EPS != null) && (
        <div style={{ marginTop: 14 }}>
          <span className="metric-label">Earnings Per Share</span>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={epsData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" fontSize={11} tick={{ fill: "var(--text-muted)" }} />
              <YAxis fontSize={10} tick={{ fill: "var(--text-muted)" }} />
              <Tooltip content={customTooltip} />
              <Bar shape={SafeBarShape} dataKey="EPS" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}

export function EarningsDividendPanel({ symbol }: Props) {
  const [data, setData] = useState<EarningsDividendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("earnings");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEarningsDividend(symbol)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) return <Loading message={`Fetching ${symbol} earnings & dividend...`} />;
  if (!data) return null;

  const hasDividend = data.dividend.isDividendPayer;

  return (
    <Card title={`Earnings & Dividend — ${symbol}`}>
      <div className="ed-tabs">
        <button
          className={`ed-tab-btn ${tab === "earnings" ? "active" : ""}`}
          onClick={() => setTab("earnings")}
        >
          <BarChart2 size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Earnings
        </button>
        <button
          className={`ed-tab-btn ${tab === "dividend" ? "active" : ""}`}
          onClick={() => setTab("dividend")}
        >
          <TrendingUp size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Dividend {hasDividend && <span className="ed-div-badge">●</span>}
        </button>
        <button
          className={`ed-tab-btn ${tab === "financials" ? "active" : ""}`}
          onClick={() => setTab("financials")}
        >
          <Activity size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Financials
        </button>
      </div>

      {tab === "earnings" && <EarningsTab data={data} />}
      {tab === "dividend" && <DividendTab data={data} />}
      {tab === "financials" && <FinancialsTab data={data} />}
    </Card>
  );
}
