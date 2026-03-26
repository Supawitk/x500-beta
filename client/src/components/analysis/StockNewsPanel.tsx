import { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Loading } from "../common/Loading";
import {
  fetchStockNews, fetchMultiNews, fetchSECFilings, fetchNewsImpact,
  type StockNewsData, type MultiNewsResult, type MultiNewsArticle,
  type NewsArticle, type SigDev, type ResearchReport, type SECFilingsResult,
  type NewsImpactData, type PredictionHorizon,
} from "../../api/news";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import {
  Newspaper, AlertCircle, FileText, TrendingUp, TrendingDown, Minus,
  Globe, Shield, ExternalLink, Brain, Target, RefreshCw, ChevronDown,
  ChevronUp, Zap, BookOpen,
} from "lucide-react";

interface Props {
  symbol: string;
  onNewsLoaded?: (events: { date: string; title: string; link?: string | null }[]) => void;
}

type Tab = "news" | "multi" | "developments" | "research" | "pattern" | "snapshot";

const SOURCE_ICONS: Record<string, string> = {
  "Yahoo Finance": "🟣",
  "Google News": "🟢",
  "Bing News": "🔵",
};

const FILING_COLORS: Record<string, string> = {
  "10-K": "#4f46e5",
  "10-Q": "#0891b2",
  "8-K": "#d97706",
  "S-1": "#7c3aed",
  "DEF 14A": "#059669",
  "6-K": "#6b7280",
  "20-F": "#be185d",
  "13F-HR": "#dc2626",
};

const CAT_COLORS: Record<string, string> = {
  "Earnings": "#4f46e5",
  "Analyst Rating": "#7c3aed",
  "FDA/Regulatory": "#059669",
  "M&A": "#d97706",
  "Shareholder Returns": "#0891b2",
  "Legal": "#dc2626",
  "Restructuring": "#be185d",
  "Product Launch": "#2563eb",
  "Partnership": "#0d9488",
  "AI/Tech": "#7c3aed",
  "Macro": "#64748b",
  "General": "#6b7280",
};

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

function directionIcon(dir: string) {
  if (dir === "Bullish") return <TrendingUp size={14} style={{ color: "#059669" }} />;
  if (dir === "Bearish") return <TrendingDown size={14} style={{ color: "#dc2626" }} />;
  return <Minus size={14} style={{ color: "#6b7280" }} />;
}

function directionColor(dir: string): string {
  if (dir === "Bullish") return "#059669";
  if (dir === "Bearish") return "#dc2626";
  return "#6b7280";
}

function ratingColor(rating: string | null): string {
  if (!rating) return "#6b7280";
  if (rating === "Bullish" || rating === "BUY") return "#059669";
  if (rating === "Bearish" || rating === "SELL") return "#dc2626";
  return "#d97706";
}

function sentimentLabel(s: number): { text: string; color: string } {
  if (s > 0.3) return { text: "Bullish", color: "#059669" };
  if (s > 0.1) return { text: "Slightly Bullish", color: "#34d399" };
  if (s > -0.1) return { text: "Neutral", color: "#6b7280" };
  if (s > -0.3) return { text: "Slightly Bearish", color: "#f87171" };
  return { text: "Bearish", color: "#dc2626" };
}

function confColor(c: number): string {
  if (c >= 70) return "#059669";
  if (c >= 50) return "#34d399";
  if (c >= 30) return "#d97706";
  return "#dc2626";
}

function ScoreBar({ label, company, sector }: { label: string; company: number | null; sector: number | null }) {
  if (company == null) return null;
  return (
    <div className="nws-score-row">
      <span className="nws-score-label">{label}</span>
      <div className="nws-score-bars">
        <div className="nws-score-track">
          <div className="nws-score-fill nws-score-company" style={{ width: `${Math.min(company * 100, 100)}%` }} />
        </div>
        {sector != null && (
          <div className="nws-score-track nws-score-sector-track">
            <div className="nws-score-fill nws-score-sector" style={{ width: `${Math.min(sector * 100, 100)}%` }} />
          </div>
        )}
      </div>
      <div className="nws-score-vals">
        <span style={{ color: "var(--primary)", fontWeight: 600 }}>{(company * 100).toFixed(0)}</span>
        {sector != null && <span style={{ color: "#6b7280" }}>vs {(sector * 100).toFixed(0)}</span>}
      </div>
    </div>
  );
}

// ── Tab: News (Yahoo) ────────────────────────────────────────────────────
function NewsTab({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return <div className="nws-empty">No recent news found.</div>;
  return (
    <div className="nws-list fade-in">
      {articles.map((a) => (
        <a key={a.uuid} href={a.link} target="_blank" rel="noopener noreferrer" className="nws-article">
          {a.thumbnail && <img src={a.thumbnail} alt="" className="nws-thumb" loading="lazy" />}
          <div className="nws-article-body">
            <div className="nws-article-title">{a.title}</div>
            <div className="nws-article-meta">
              <span className="nws-publisher">{a.publisher}</span>
              <span className="nws-time">{timeAgo(a.publishTime)}</span>
              {a.relatedTickers.length > 0 && (
                <span className="nws-tickers">{a.relatedTickers.slice(0, 4).join(", ")}</span>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Tab: Multi-Source ─────────────────────────────────────────────────────
function MultiSourceTab({ data }: { data: MultiNewsResult }) {
  if (data.articles.length === 0) return <div className="nws-empty">No multi-source news found.</div>;
  return (
    <div className="nws-multi fade-in">
      <div className="nws-multi-header">
        <div className="nws-multi-stats">
          <span className="nws-multi-total">{data.totalArticles} articles</span>
          <span className="nws-multi-avg-rel">
            <Shield size={12} /> Avg reliability: <strong>{data.avgReliability}</strong>/100
          </span>
        </div>
        <div className="nws-multi-sources">
          {data.sourceBreakdown.map((s) => (
            <span key={s.source} className="nws-source-chip">
              {SOURCE_ICONS[s.source] || "📰"} {s.source}
              <span className="nws-source-chip-count">{s.count}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="nws-list">
        {data.articles.map((a) => (
          <a key={a.id} href={a.link || "#"} target="_blank" rel="noopener noreferrer" className="nws-article nws-multi-article">
            {a.thumbnail && <img src={a.thumbnail} alt="" className="nws-thumb" loading="lazy" />}
            <div className="nws-article-body">
              <div className="nws-article-title">{a.title}</div>
              {a.summary && <div className="nws-article-summary">{a.summary}</div>}
              <div className="nws-article-meta">
                <span className="nws-publisher">{a.publisher}</span>
                <span className="nws-source-badge" style={{ background: a.reliabilityColor + "18", color: a.reliabilityColor, borderColor: a.reliabilityColor + "40" }}>
                  <Shield size={10} /> {a.reliabilityTier} ({a.reliability})
                </span>
                <span className="nws-source-tag">{SOURCE_ICONS[a.sourceLabel] || "📰"} {a.sourceLabel}</span>
                <span className="nws-time">{timeAgo(a.publishTime)}</span>
              </div>
            </div>
            <ExternalLink size={14} className="nws-ext-icon" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Developments ────────────────────────────────────────────────────
function DevsTab({ devs }: { devs: SigDev[] }) {
  if (devs.length === 0) return <div className="nws-empty">No significant developments found.</div>;
  return (
    <div className="nws-devs fade-in">
      {devs.map((d, i) => (
        <div key={i} className="nws-dev-item">
          <AlertCircle size={14} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="nws-dev-headline">{d.headline}</div>
            {d.date && <span className="nws-dev-date">{new Date(d.date).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Research & Filings (Yahoo reports + SEC EDGAR) ──────────────────
function ResearchFilingsTab({
  reports, recommendation, sec,
}: {
  reports: ResearchReport[];
  recommendation: StockNewsData["recommendation"];
  sec: SECFilingsResult | null;
}) {
  const [showSec, setShowSec] = useState(true);
  return (
    <div className="nws-research fade-in">
      {recommendation && (
        <div className="nws-recommendation">
          <div className="nws-rec-rating" style={{ color: ratingColor(recommendation.rating) }}>{recommendation.rating}</div>
          {recommendation.targetPrice != null && (
            <div className="nws-rec-target">Target: <strong>${recommendation.targetPrice.toFixed(2)}</strong></div>
          )}
          <div className="nws-rec-provider">{recommendation.provider}</div>
        </div>
      )}

      {/* Analyst reports */}
      {reports.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="ni-section-title">Analyst Reports ({reports.length})</div>
          {reports.map((r) => (
            <div key={r.id} className="nws-report">
              <div className="nws-report-header">
                <FileText size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span className="nws-report-title">{r.title}</span>
              </div>
              <div className="nws-report-meta">
                <span className="nws-publisher">{r.provider}</span>
                {r.date && <span className="nws-time">{new Date(r.date).toLocaleDateString()}</span>}
                {r.investmentRating && (
                  <span className="nws-rating-badge" style={{ color: ratingColor(r.investmentRating) }}>{r.investmentRating}</span>
                )}
                {r.targetPrice != null && (
                  <span className="nws-target-badge">
                    ${r.targetPrice.toFixed(2)}
                    {r.targetPriceStatus && r.targetPriceStatus !== "-" && (
                      <span className={r.targetPriceStatus === "Increased" ? "text-green" : r.targetPriceStatus === "Decreased" ? "text-red" : ""}>
                        {r.targetPriceStatus === "Increased" ? " ▲" : r.targetPriceStatus === "Decreased" ? " ▼" : " —"}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEC Filings */}
      {sec && sec.filings.length > 0 && (
        <div>
          <button className="ni-matches-toggle" onClick={() => setShowSec(!showSec)} style={{ marginBottom: 8 }}>
            {showSec ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            SEC EDGAR Filings ({sec.filings.length})
            {sec.companyName && <span className="text-muted" style={{ marginLeft: 8, fontSize: 10 }}>{sec.companyName}</span>}
          </button>
          {showSec && (
            <div className="nws-sec-list fade-in">
              {sec.filings.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="nws-sec-item">
                  <span className="nws-sec-type" style={{
                    color: FILING_COLORS[f.type] || "#6b7280",
                    borderColor: (FILING_COLORS[f.type] || "#6b7280") + "40",
                    background: (FILING_COLORS[f.type] || "#6b7280") + "10",
                  }}>
                    {f.type}
                  </span>
                  <div className="nws-sec-body">
                    <span className="nws-sec-title">{f.description || f.title}</span>
                    <span className="nws-sec-date">{f.filedDate}</span>
                  </div>
                  <ExternalLink size={12} className="nws-ext-icon" style={{ position: "static", opacity: 0.4 }} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {reports.length === 0 && !recommendation && (!sec || sec.filings.length === 0) && (
        <div className="nws-empty">No research reports or filings available.</div>
      )}
    </div>
  );
}

// ── Tab: Pattern Matching ────────────────────────────────────────────────
function PatternTab({ data, onRetrain }: { data: NewsImpactData; onRetrain: () => void }) {
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  const activePred = selectedArticle !== null && data.perArticlePredictions[selectedArticle]
    ? data.perArticlePredictions[selectedArticle]
    : data.prediction;

  const predChartData = [
    { horizon: "3D", avg: activePred.day3.avg, median: activePred.day3.median, winRate: activePred.day3.winRate },
    { horizon: "5D", avg: activePred.day5.avg, median: activePred.day5.median, winRate: activePred.day5.winRate },
    { horizon: "10D", avg: activePred.day10.avg, median: activePred.day10.median, winRate: activePred.day10.winRate },
  ];

  const overallSent = data.targetNews.length > 0
    ? data.targetNews.reduce((s, n) => s + n.sentiment, 0) / data.targetNews.length : 0;
  const sentInfo = sentimentLabel(overallSent);

  return (
    <div className="nws-pattern fade-in">
      {/* Header stats */}
      <div className="ni-header-grid">
        {[
          { label: "Confidence", val: `${data.confidence}%`, color: confColor(data.confidence), icon: <Brain size={14} />, bg: "#eef2ff" },
          { label: "Direction Accuracy", val: `${data.backtest.directionAccuracy}%`, color: "#059669", icon: <Target size={14} />, bg: "#ecfdf5" },
          { label: "Sentiment", val: sentInfo.text, color: sentInfo.color, icon: <Newspaper size={14} />, bg: "#fef3c7" },
          { label: "Corpus", val: `${data.corpusSize}`, color: "#7c3aed", icon: <Zap size={14} />, bg: "#f3e8ff" },
        ].map(h => (
          <div key={h.label} className="ni-header-card">
            <div className="ni-header-icon" style={{ background: h.bg, color: h.color }}>{h.icon}</div>
            <div>
              <span className="ni-header-label">{h.label}</span>
              <span className="ni-header-val" style={{ color: h.color, fontSize: h.label === "Corpus" ? 14 : 18 }}>{h.val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confidence bars */}
      <div className="ni-conf-breakdown">
        <div className="ni-conf-title">Confidence Breakdown</div>
        <div className="ni-conf-bars">
          {[
            { label: "Match Quality", val: data.confidenceBreakdown.matchQuality, max: 30, color: "#4f46e5" },
            { label: "Sample Size", val: data.confidenceBreakdown.sampleSize, max: 25, color: "#059669" },
            { label: "Consistency", val: data.confidenceBreakdown.consistency, max: 25, color: "#d97706" },
            { label: "Backtest", val: data.confidenceBreakdown.backtestScore, max: 20, color: "#7c3aed" },
          ].map(b => (
            <div key={b.label}>
              <div className="ni-conf-bar-header"><span>{b.label}</span><span style={{ fontFamily: "var(--mono)" }}>{b.val}/{b.max}</span></div>
              <div className="ni-conf-bar-track"><div className="ni-conf-bar-fill" style={{ width: `${(b.val / b.max) * 100}%`, background: b.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Price predictions */}
      <div className="ni-pred-section">
        <div className="ni-section-title">
          {selectedArticle !== null ? `Impact — "${data.targetNews[selectedArticle]?.title.slice(0, 50)}..."` : "Predicted Price Impact"}
          {selectedArticle !== null && (
            <button className="ni-clear-sel-btn" onClick={() => setSelectedArticle(null)}>Clear</button>
          )}
        </div>
        <div className="ni-pred-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {predChartData.map(p => {
            const pos = p.avg >= 0;
            return (
              <div key={p.horizon} className="ni-pred-card">
                <span className="ni-pred-horizon">{p.horizon}</span>
                <span className="ni-pred-avg" style={{ color: pos ? "#059669" : "#dc2626" }}>
                  {pos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {pos ? "+" : ""}{p.avg.toFixed(2)}%
                </span>
                <div className="ni-pred-meta"><span>Med: {p.median >= 0 ? "+" : ""}{p.median.toFixed(2)}%</span><span>Win: {p.winRate}%</span></div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8 }}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={predChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="horizon" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={36} tickFormatter={v => `${v}%`} />
              <RTooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              <Bar shape={SafeBarShape} dataKey="avg" radius={[4, 4, 0, 0]}>
                {predChartData.map((d, i) => <Cell key={i} fill={d.avg >= 0 ? "#34d399" : "#f87171"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Backtest */}
      <div className="ni-backtest-section">
        <div className="ni-section-title"><Shield size={13} style={{ marginRight: 4 }} /> Backtest Results</div>
        <div className="ni-backtest-grid">
          {[
            { label: "Tested", val: data.backtest.totalPredictions },
            { label: "Accuracy", val: `${data.backtest.directionAccuracy}%`, color: data.backtest.directionAccuracy >= 55 ? "#059669" : "#d97706" },
            { label: "Avg Error", val: `${data.backtest.avgError.toFixed(2)}%` },
            { label: "Profit Factor", val: data.backtest.profitFactor.toFixed(2), color: data.backtest.profitFactor >= 1 ? "#059669" : "#dc2626" },
          ].map(m => (
            <div key={m.label} className="ni-bt-metric">
              <span className="ni-bt-label">{m.label}</span>
              <span className="ni-bt-val" style={m.color ? { color: m.color } : undefined}>{m.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clickable news articles */}
      {data.targetNews.length > 0 && (
        <div className="ni-news-section">
          <div className="ni-section-title">Current News ({data.targetNews.length}) — click to see per-article prediction</div>
          <div className="ni-news-list">
            {data.targetNews.slice(0, 8).map((n, i) => {
              const s = sentimentLabel(n.sentiment);
              const isSel = selectedArticle === i;
              return (
                <div key={i} className={`ni-news-item ni-news-selectable ${isSel ? "ni-news-selected" : ""}`}
                  onClick={() => setSelectedArticle(isSel ? null : i)}>
                  <div className="ni-news-top-row">
                    <span className="ni-news-cat" style={{
                      color: CAT_COLORS[n.category] || "#6b7280",
                      borderColor: (CAT_COLORS[n.category] || "#6b7280") + "40",
                      background: (CAT_COLORS[n.category] || "#6b7280") + "10",
                    }}>{n.category}</span>
                    {n.link && (
                      <a href={n.link} target="_blank" rel="noopener noreferrer" className="ni-news-link-btn"
                        onClick={e => e.stopPropagation()}>
                        <ExternalLink size={12} /> Source
                      </a>
                    )}
                  </div>
                  <span className="ni-news-title">{n.title}</span>
                  <div className="ni-news-meta">
                    <span>{n.date}</span>
                    <span className="ni-news-sent" style={{ color: s.color }}>{s.text}</span>
                    {isSel && <span className="ni-news-sel-badge">Selected</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Similar matches */}
      <div className="ni-matches-section">
        <button className="ni-matches-toggle" onClick={() => setShowMatches(!showMatches)}>
          {showMatches ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showMatches ? "Hide" : "Show"} Similar Historical News ({data.matches.length})
        </button>
        {showMatches && (
          <div className="ni-matches-list fade-in">
            {data.matches.map((m, i) => (
              <div key={i} className={`ni-match-row ${expandedMatch === i ? "ni-match-expanded" : ""}`}
                onClick={() => setExpandedMatch(expandedMatch === i ? null : i)}>
                <div className="ni-match-header">
                  <div className="ni-match-left">
                    <span className="ni-match-sym">{m.matchSymbol}</span>
                    <span className="ni-match-title">{m.newsTitle.slice(0, 70)}{m.newsTitle.length > 70 ? "..." : ""}</span>
                  </div>
                  <div className="ni-match-right">
                    <span className="ni-match-sim" style={{ color: m.similarity > 0.5 ? "#059669" : m.similarity > 0.3 ? "#d97706" : "#6b7280" }}>
                      {(m.similarity * 100).toFixed(0)}%
                    </span>
                    <span className="ni-match-cat" style={{ color: CAT_COLORS[m.category] || "#6b7280" }}>{m.category}</span>
                  </div>
                </div>
                {expandedMatch === i && (
                  <div className="ni-match-detail fade-in">
                    <div className="ni-match-date">{m.newsDate}</div>
                    <div className="ni-match-impacts">
                      {[{ label: "3D", val: m.priceImpact.day3 }, { label: "5D", val: m.priceImpact.day5 }, { label: "10D", val: m.priceImpact.day10 }].map(h => (
                        <div key={h.label} className="ni-match-impact">
                          <span className="ni-match-impact-label">{h.label}</span>
                          <span className="ni-match-impact-val" style={{ color: h.val == null ? "#6b7280" : h.val >= 0 ? "#059669" : "#dc2626" }}>
                            {h.val != null ? `${h.val >= 0 ? "+" : ""}${h.val.toFixed(2)}%` : "\u2014"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ni-footer">
        <span className="ni-footer-info">Corpus: {data.corpusSize} · Cycle #{data.trainingCycles}</span>
        <button className="ni-retrain-btn" onClick={onRetrain}><RefreshCw size={12} /> Retrain</button>
      </div>
    </div>
  );
}

// ── Tab: Snapshot ─────────────────────────────────────────────────────────
function SnapshotTab({ data }: { data: StockNewsData }) {
  const { companySnapshot: cs, technicalOutlook: to, upsell } = data;
  return (
    <div className="nws-snapshot fade-in">
      {to && (
        <div className="nws-outlook-section">
          <span className="metric-label">Technical Outlook</span>
          <div className="nws-outlooks">
            {[
              { label: "Short-term", data: to.shortTerm },
              { label: "Mid-term", data: to.intermediateTerm },
              { label: "Long-term", data: to.longTerm },
            ].map(({ label, data: d }) => d && (
              <div key={label} className="nws-outlook-card">
                <div className="nws-outlook-label">{label}</div>
                <div className="nws-outlook-dir" style={{ color: directionColor(d.direction) }}>
                  {directionIcon(d.direction)} <span>{d.direction}</span>
                </div>
                <div className="nws-outlook-desc">{d.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {cs && (
        <div className="nws-scores-section">
          <span className="metric-label">Company vs Sector Scores{cs.sectorInfo && <span className="text-muted"> — {cs.sectorInfo}</span>}</span>
          <div className="nws-legend"><span className="nws-legend-company">Company</span><span className="nws-legend-sector">Sector Avg</span></div>
          <ScoreBar label="Innovativeness" company={cs.company.innovativeness} sector={cs.sector?.innovativeness ?? null} />
          <ScoreBar label="Hiring" company={cs.company.hiring} sector={cs.sector?.hiring ?? null} />
          <ScoreBar label="Sustainability" company={cs.company.sustainability} sector={cs.sector?.sustainability ?? null} />
          <ScoreBar label="Insider Sentiment" company={cs.company.insiderSentiments} sector={cs.sector?.insiderSentiments ?? null} />
          <ScoreBar label="Earnings Reports" company={cs.company.earningsReports} sector={cs.sector?.earningsReports ?? null} />
          <ScoreBar label="Dividends" company={cs.company.dividends} sector={cs.sector?.dividends ?? null} />
        </div>
      )}
      {upsell && (upsell.bullishSummary.length > 0 || upsell.bearishSummary.length > 0) && (
        <div className="nws-bull-bear">
          {upsell.bullishSummary.length > 0 && (
            <div className="nws-bb-col nws-bull">
              <div className="nws-bb-header"><TrendingUp size={14} /> Bull Case</div>
              {upsell.bullishSummary.map((s, i) => <div key={i} className="nws-bb-item">{s}</div>)}
            </div>
          )}
          {upsell.bearishSummary.length > 0 && (
            <div className="nws-bb-col nws-bear">
              <div className="nws-bb-header"><TrendingDown size={14} /> Bear Case</div>
              {upsell.bearishSummary.map((s, i) => <div key={i} className="nws-bb-item">{s}</div>)}
            </div>
          )}
        </div>
      )}
      {!cs && !to && !upsell && <div className="nws-empty">No company snapshot data available.</div>}
    </div>
  );
}

// ── Main unified panel ───────────────────────────────────────────────────
export function StockNewsPanel({ symbol, onNewsLoaded }: Props) {
  const [data, setData] = useState<StockNewsData | null>(null);
  const [multiData, setMultiData] = useState<MultiNewsResult | null>(null);
  const [secData, setSecData] = useState<SECFilingsResult | null>(null);
  const [impactData, setImpactData] = useState<NewsImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [impactLoading, setImpactLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("news");

  // Fetch primary data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchStockNews(symbol),
      fetchMultiNews(symbol),
      fetchSECFilings(symbol),
    ])
      .then(([d, m, s]) => {
        if (cancelled) return;
        setData(d);
        setMultiData(m);
        setSecData(s);

        // Send news events to parent for chart markers
        if (onNewsLoaded) {
          const events: { date: string; title: string; link?: string | null }[] = [];
          for (const a of d.news) {
            if (a.publishTime) events.push({ date: a.publishTime.split("T")[0], title: a.title, link: a.link });
          }
          for (const dev of d.sigDevs) {
            if (dev.date) events.push({ date: dev.date.split("T")[0], title: dev.headline });
          }
          onNewsLoaded(events);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  // Fetch news impact lazily (only when tab selected or auto-fetch)
  useEffect(() => {
    let cancelled = false;
    setImpactLoading(true);
    fetchNewsImpact(symbol)
      .then(d => { if (!cancelled) setImpactData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setImpactLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  const handleRetrain = () => {
    setImpactLoading(true);
    fetchNewsImpact(symbol)
      .then(d => setImpactData(d))
      .catch(() => {})
      .finally(() => setImpactLoading(false));
  };

  if (loading) return <Loading message={`Fetching ${symbol} news & research...`} />;
  if (!data) return null;

  const tabCounts: Record<Tab, number> = {
    news: data.news.length,
    multi: multiData?.totalArticles ?? 0,
    developments: data.sigDevs.length,
    research: data.reports.length + (data.recommendation ? 1 : 0) + (secData?.filings.length ?? 0),
    pattern: impactData?.matches.length ?? 0,
    snapshot: (data.companySnapshot ? 1 : 0) + (data.technicalOutlook ? 1 : 0),
  };

  const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: "news", label: "News", icon: <Newspaper size={13} /> },
    { id: "multi", label: "Multi-Source", icon: <Globe size={13} /> },
    { id: "developments", label: "Events", icon: <AlertCircle size={13} /> },
    { id: "research", label: "Research & Filings", icon: <BookOpen size={13} /> },
    { id: "pattern", label: "Pattern Match", icon: <Brain size={13} /> },
    { id: "snapshot", label: "Snapshot", icon: <TrendingUp size={13} /> },
  ];

  return (
    <Card title={`News & Research — ${symbol}`}>
      <div className="nws-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`nws-tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {tabCounts[t.id] > 0 && <span className="nws-tab-count">{tabCounts[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === "news" && <NewsTab articles={data.news} />}
      {tab === "multi" && multiData && <MultiSourceTab data={multiData} />}
      {tab === "developments" && <DevsTab devs={data.sigDevs} />}
      {tab === "research" && <ResearchFilingsTab reports={data.reports} recommendation={data.recommendation} sec={secData} />}
      {tab === "pattern" && impactData && <PatternTab data={impactData} onRetrain={handleRetrain} />}
      {tab === "pattern" && !impactData && impactLoading && (
        <div className="ni-loading"><RefreshCw size={20} className="spin" /><span>Building news corpus...</span></div>
      )}
      {tab === "snapshot" && <SnapshotTab data={data} />}
    </Card>
  );
}
