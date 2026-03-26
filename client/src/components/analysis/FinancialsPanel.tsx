import { useState, useEffect, useMemo } from "react";
import { Search, X, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card } from "../common/Card";
import { fetchAnalysis, searchStocks } from "../../api/analysis";
import type { StockDetail, SearchResult } from "../../api/analysis";

interface Props {
  detail: StockDetail;
  symbol: string;
}

/* ── helpers ─────────────────────────────────── */

function pct(v: number | null): string {
  return v !== null ? `${(v * 100).toFixed(1)}%` : "N/A";
}
function rawPct(v: number | null): number | null {
  return v !== null ? v * 100 : null;
}
function fmt(v: number | null, prefix = ""): string {
  if (v === null) return "N/A";
  if (Math.abs(v) >= 1e12) return `${prefix}${(v / 1e12).toFixed(1)}T`;
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(0)}M`;
  return `${prefix}${v.toFixed(2)}`;
}
function num2(v: number | null): string {
  return v !== null ? v.toFixed(2) : "N/A";
}

type Status = "good" | "normal" | "bad";

interface MetricDef {
  label: string;
  get: (d: StockDetail) => number | null;
  format: (d: StockDetail) => string;
  status: (v: number | null) => Status;
  tip?: string;
}

function statusOf(v: number | null, goodMin: number, badMax: number, higher = true): Status {
  if (v === null) return "normal";
  if (higher) return v >= goodMin ? "good" : v <= badMax ? "bad" : "normal";
  return v <= goodMin ? "good" : v >= badMax ? "bad" : "normal";
}

/* ── metric definitions with thresholds ──────── */

const FINANCIALS: MetricDef[] = [
  { label: "Revenue Growth", get: d => rawPct(d.revenueGrowth), format: d => pct(d.revenueGrowth),
    status: v => statusOf(v, 15, 0), tip: ">15% strong, <0% declining" },
  { label: "Earnings Growth", get: d => rawPct(d.earningsGrowth), format: d => pct(d.earningsGrowth),
    status: v => statusOf(v, 15, 0), tip: ">15% strong, <0% declining" },
  { label: "Gross Margin", get: d => rawPct(d.grossMargins), format: d => pct(d.grossMargins),
    status: v => statusOf(v, 40, 20), tip: ">40% strong pricing power" },
  { label: "Operating Margin", get: d => rawPct(d.operatingMargins), format: d => pct(d.operatingMargins),
    status: v => statusOf(v, 20, 5), tip: ">20% well-managed costs" },
  { label: "Profit Margin", get: d => rawPct(d.profitMargins), format: d => pct(d.profitMargins),
    status: v => statusOf(v, 15, 3), tip: ">15% highly profitable" },
  { label: "ROE", get: d => rawPct(d.returnOnEquity), format: d => pct(d.returnOnEquity),
    status: v => statusOf(v, 15, 5), tip: ">15% efficient equity use" },
  { label: "ROA", get: d => rawPct(d.returnOnAssets), format: d => pct(d.returnOnAssets),
    status: v => statusOf(v, 8, 2), tip: ">8% efficient asset use" },
  { label: "Free Cash Flow", get: d => d.freeCashflow, format: d => fmt(d.freeCashflow, "$"),
    status: v => statusOf(v, 0.01, -0.01), tip: "Positive = self-funding" },
  { label: "Operating CF", get: d => d.operatingCashflow, format: d => fmt(d.operatingCashflow, "$"),
    status: v => statusOf(v, 0.01, -0.01), tip: "Positive = healthy ops" },
  { label: "Revenue", get: d => d.totalRevenue, format: d => fmt(d.totalRevenue, "$"),
    status: () => "normal" },
  { label: "EBITDA", get: d => d.ebitda, format: d => fmt(d.ebitda, "$"),
    status: v => statusOf(v, 0.01, -0.01) },
];

const VALUATION: MetricDef[] = [
  { label: "Trailing P/E", get: d => d.trailingPE, format: d => num2(d.trailingPE),
    status: v => statusOf(v, 25, 50, false), tip: "<25 reasonable, >50 expensive" },
  { label: "Forward P/E", get: d => d.forwardPE, format: d => num2(d.forwardPE),
    status: v => statusOf(v, 20, 40, false), tip: "<20 reasonable, >40 expensive" },
  { label: "PEG Ratio", get: d => d.pegRatio, format: d => num2(d.pegRatio),
    status: v => statusOf(v, 1, 2, false), tip: "<1 undervalued, >2 overvalued" },
  { label: "Price/Book", get: d => d.priceToBook, format: d => num2(d.priceToBook),
    status: v => statusOf(v, 3, 10, false), tip: "<3 fair, >10 expensive" },
  { label: "EV/Revenue", get: d => d.enterpriseToRevenue, format: d => num2(d.enterpriseToRevenue),
    status: v => statusOf(v, 5, 15, false), tip: "<5 reasonable" },
  { label: "EV/EBITDA", get: d => d.enterpriseToEbitda, format: d => num2(d.enterpriseToEbitda),
    status: v => statusOf(v, 15, 25, false), tip: "<15 reasonable" },
  { label: "Dividend Yield", get: d => rawPct(d.dividendYield), format: d => pct(d.dividendYield),
    status: v => statusOf(v, 2, 0), tip: ">2% attractive yield" },
  { label: "Fwd EPS", get: d => d.forwardEps, format: d => num2(d.forwardEps),
    status: v => statusOf(v, 1, 0), tip: "Positive growth expected" },
  { label: "Trailing EPS", get: d => d.trailingEps, format: d => num2(d.trailingEps),
    status: v => statusOf(v, 1, 0) },
];

const HEALTH: MetricDef[] = [
  { label: "Current Ratio", get: d => d.currentRatio, format: d => num2(d.currentRatio),
    status: v => statusOf(v, 1.5, 1), tip: ">1.5 good liquidity" },
  { label: "Quick Ratio", get: d => d.quickRatio, format: d => num2(d.quickRatio),
    status: v => statusOf(v, 1, 0.5), tip: ">1 can cover short-term" },
  { label: "Debt/Equity", get: d => d.debtToEquity, format: d => num2(d.debtToEquity),
    status: v => statusOf(v, 50, 150, false), tip: "<50 low leverage" },
  { label: "Total Debt", get: d => d.totalDebt, format: d => fmt(d.totalDebt, "$"),
    status: () => "normal" },
  { label: "Total Cash", get: d => d.totalCash, format: d => fmt(d.totalCash, "$"),
    status: () => "normal" },
  { label: "Beta", get: d => d.beta, format: d => num2(d.beta),
    status: v => v === null ? "normal" : Math.abs(v - 1) < 0.3 ? "good" : v > 1.5 ? "bad" : "normal",
    tip: "~1 market-like risk" },
];

const OWNERSHIP: MetricDef[] = [
  { label: "Short Ratio", get: d => d.shortRatio, format: d => num2(d.shortRatio),
    status: v => statusOf(v, 3, 7, false), tip: "<3 low short pressure" },
  { label: "Short % Float", get: d => rawPct(d.shortPercentOfFloat), format: d => pct(d.shortPercentOfFloat),
    status: v => statusOf(v, 5, 15, false), tip: "<5% low, >15% high squeeze risk" },
  { label: "Insider %", get: d => rawPct(d.heldPercentInsiders), format: d => pct(d.heldPercentInsiders),
    status: v => statusOf(v, 5, 0.5), tip: ">5% aligned management" },
  { label: "Institution %", get: d => rawPct(d.heldPercentInstitutions), format: d => pct(d.heldPercentInstitutions),
    status: v => statusOf(v, 50, 20), tip: ">50% institutional confidence" },
  { label: "52W Change", get: d => rawPct(d.fiftyTwoWeekChange), format: d => pct(d.fiftyTwoWeekChange),
    status: v => statusOf(v, 10, -10) },
  { label: "Rev/Share", get: d => d.revenuePerShare, format: d => num2(d.revenuePerShare),
    status: () => "normal" },
];

/* ── status badge component ──────────────────── */

function StatusDot({ status, tip }: { status: Status; tip?: string }) {
  const icon = status === "good" ? <ArrowUpRight size={10} /> :
               status === "bad" ? <ArrowDownRight size={10} /> :
               <Minus size={10} />;
  return (
    <span className={`fp-status fp-status-${status}`} title={tip}>
      {icon}
    </span>
  );
}

/* ── metric row component ────────────────────── */

function MetricRow({ def, detail, compareDetail }: {
  def: MetricDef; detail: StockDetail; compareDetail: StockDetail | null;
}) {
  const val = def.get(detail);
  const st = def.status(val);
  const cmpVal = compareDetail ? def.get(compareDetail) : null;
  const cmpSt = compareDetail ? def.status(cmpVal) : null;

  return (
    <div className="fp-metric-row">
      <span className="fp-metric-label">
        {def.label}
        <StatusDot status={st} tip={def.tip} />
      </span>
      <span className={`fp-metric-val fp-val-${st}`}>{def.format(detail)}</span>
      {compareDetail && (
        <span className={`fp-metric-val fp-metric-cmp fp-val-${cmpSt}`}>
          {def.format(compareDetail)}
          {cmpSt && <StatusDot status={cmpSt} />}
        </span>
      )}
    </div>
  );
}

/* ── section component ───────────────────────── */

function Section({ title, metrics, detail, compareDetail, compareSymbol }: {
  title: string; metrics: MetricDef[];
  detail: StockDetail; compareDetail: StockDetail | null;
  compareSymbol?: string;
}) {
  return (
    <div className="fp-section">
      <div className="fp-section-header">
        <h5 className="fp-section-title">{title}</h5>
        {compareDetail && (
          <div className="fp-col-headers">
            <span className="fp-col-lbl">Current</span>
            <span className="fp-col-lbl">{compareSymbol}</span>
          </div>
        )}
      </div>
      <div className="fp-metrics">
        {metrics.map(m => (
          <MetricRow key={m.label} def={m} detail={detail} compareDetail={compareDetail} />
        ))}
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────── */

export function FinancialsPanel({ detail, symbol }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null);
  const [compareDetail, setCompareDetail] = useState<StockDetail | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Search for comparison stock
  useEffect(() => {
    if (searchQuery.length < 1) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      searchStocks(searchQuery).then(r =>
        setSearchResults(r.filter(s => s.symbol !== symbol).slice(0, 6))
      ).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, symbol]);

  // Fetch comparison detail
  useEffect(() => {
    if (!compareSymbol) { setCompareDetail(null); return; }
    setLoadingCompare(true);
    fetchAnalysis(compareSymbol).then(res => {
      setCompareDetail(res.detail);
    }).catch(() => setCompareDetail(null))
      .finally(() => setLoadingCompare(false));
  }, [compareSymbol]);

  // Correlation insights
  const insights = useMemo(() => {
    const items: string[] = [];
    const gm = detail.grossMargins, om = detail.operatingMargins, pm = detail.profitMargins;
    if (gm !== null && om !== null && pm !== null) {
      const spread = (gm - om) * 100;
      if (spread > 30) items.push("High SG&A spread (gross→operating): cost management may be an issue");
      if (pm * 100 > 20 && om !== null && om * 100 > 15) items.push("Strong margin cascade: pricing power + cost control");
    }
    if (detail.currentRatio !== null && detail.quickRatio !== null) {
      const gap = detail.currentRatio - detail.quickRatio;
      if (gap > 1) items.push("Large inventory overhang (current vs quick ratio gap)");
    }
    if (detail.freeCashflow !== null && detail.operatingCashflow !== null && detail.operatingCashflow > 0) {
      const fcfConv = detail.freeCashflow / detail.operatingCashflow;
      if (fcfConv > 0.7) items.push("Strong FCF conversion from operating cash flow");
      if (fcfConv < 0.3) items.push("High capex burden: low FCF conversion");
    }
    if (detail.debtToEquity !== null && detail.currentRatio !== null) {
      if (detail.debtToEquity > 100 && detail.currentRatio < 1) items.push("Warning: high leverage + low liquidity");
      if (detail.debtToEquity < 30 && detail.currentRatio > 2) items.push("Conservative balance sheet: low debt, high liquidity");
    }
    if (detail.returnOnEquity !== null && detail.returnOnAssets !== null) {
      const leverage = (detail.returnOnEquity / detail.returnOnAssets);
      if (leverage > 3) items.push("High financial leverage amplifying ROE vs ROA");
    }
    if (detail.pegRatio !== null && detail.trailingPE !== null) {
      if (detail.pegRatio < 1 && detail.trailingPE < 25) items.push("Attractive PEG + P/E combo: potential value opportunity");
      if (detail.pegRatio > 2 && detail.trailingPE > 30) items.push("Expensive on both PEG and P/E");
    }
    if (detail.beta !== null && detail.shortPercentOfFloat !== null) {
      if (detail.beta > 1.5 && detail.shortPercentOfFloat > 0.1) items.push("High beta + high short interest: elevated volatility risk");
    }
    return items;
  }, [detail]);

  const clearCompare = () => { setCompareSymbol(null); setCompareDetail(null); setShowSearch(false); setSearchQuery(""); };

  return (
    <Card title={`Financials & Ownership${compareSymbol ? ` vs ${compareSymbol}` : ""}`}>
      {/* Compare search bar */}
      <div className="fp-compare-bar">
        {!compareSymbol ? (
          <div className="fp-compare-trigger">
            {showSearch ? (
              <div className="fp-search-box">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search stock to compare..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button className="fp-search-close" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
                  <X size={12} />
                </button>
                {searchResults.length > 0 && (
                  <div className="fp-search-dropdown">
                    {searchResults.map(r => (
                      <button key={r.symbol} className="fp-search-item"
                        onClick={() => { setCompareSymbol(r.symbol); setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
                        <strong>{r.symbol}</strong> <span>{r.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button className="fp-compare-btn" onClick={() => setShowSearch(true)}>
                <Search size={12} /> Compare with another stock
              </button>
            )}
          </div>
        ) : (
          <div className="fp-compare-active">
            <span>Comparing with <strong>{compareSymbol}</strong></span>
            {loadingCompare && <span className="fp-loading-dot">Loading...</span>}
            <button className="fp-compare-clear" onClick={clearCompare}><X size={12} /> Clear</button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="fp-legend">
        <span className="fp-legend-item"><span className="fp-dot fp-dot-good" /> Good</span>
        <span className="fp-legend-item"><span className="fp-dot fp-dot-normal" /> Normal</span>
        <span className="fp-legend-item"><span className="fp-dot fp-dot-bad" /> Abnormal</span>
      </div>

      <div className="fp-grid">
        <Section title="Financials & Margins" metrics={FINANCIALS}
          detail={detail} compareDetail={compareDetail} compareSymbol={compareSymbol ?? undefined} />
        <Section title="Valuation" metrics={VALUATION}
          detail={detail} compareDetail={compareDetail} compareSymbol={compareSymbol ?? undefined} />
        <Section title="Financial Health" metrics={HEALTH}
          detail={detail} compareDetail={compareDetail} compareSymbol={compareSymbol ?? undefined} />
        <Section title="Ownership & Short Interest" metrics={OWNERSHIP}
          detail={detail} compareDetail={compareDetail} compareSymbol={compareSymbol ?? undefined} />
      </div>

      {/* Correlation Insights */}
      {insights.length > 0 && (
        <div className="fp-insights-row">
          <h5 className="fp-section-title">Cross-Metric Insights</h5>
          <div className="fp-insights-grid">
            {insights.map((ins, i) => (
              <div key={i} className="fp-insight-row">
                <span className="fp-insight-icon">{ins.startsWith("Warning") || ins.includes("issue") || ins.includes("Expensive") || ins.includes("risk") ? "⚠" : "✓"}</span>
                <span>{ins}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
