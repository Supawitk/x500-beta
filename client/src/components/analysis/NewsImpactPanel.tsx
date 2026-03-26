import { useState, useEffect } from "react";
import { Card } from "../common/Card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from "recharts";
import {
  Newspaper, Brain, Target, TrendingUp, TrendingDown,
  RefreshCw, ChevronDown, ChevronUp, Zap, Shield, ExternalLink,
} from "lucide-react";

interface Props {
  symbol: string;
}

interface PredictionHorizon {
  avg: number;
  median: number;
  winRate: number;
  count: number;
}

interface NewsImpactData {
  symbol: string;
  targetNews: {
    title: string;
    date: string;
    link: string | null;
    category: string;
    sentiment: number;
    keywords: string[];
  }[];
  matches: {
    newsTitle: string;
    newsDate: string;
    matchSymbol: string;
    similarity: number;
    category: string;
    sentiment: number;
    priceImpact: {
      day3: number | null;
      day5: number | null;
      day10: number | null;
    };
  }[];
  prediction: {
    day3: PredictionHorizon;
    day5: PredictionHorizon;
    day10: PredictionHorizon;
  };
  perArticlePredictions: {
    day3: PredictionHorizon;
    day5: PredictionHorizon;
    day10: PredictionHorizon;
  }[];
  backtest: {
    totalPredictions: number;
    accurateDirection: number;
    directionAccuracy: number;
    avgError: number;
    profitFactor: number;
  };
  confidence: number;
  confidenceBreakdown: {
    matchQuality: number;
    sampleSize: number;
    consistency: number;
    backtestScore: number;
  };
  corpusSize: number;
  trainingCycles: number;
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

function PredictionCards({ prediction, label }: {
  prediction: { day3: PredictionHorizon; day5: PredictionHorizon; day10: PredictionHorizon };
  label?: string;
}) {
  const predChartData = [
    { horizon: "3 Days", avg: prediction.day3.avg, median: prediction.day3.median, winRate: prediction.day3.winRate },
    { horizon: "5 Days", avg: prediction.day5.avg, median: prediction.day5.median, winRate: prediction.day5.winRate },
    { horizon: "10 Days", avg: prediction.day10.avg, median: prediction.day10.median, winRate: prediction.day10.winRate },
  ];

  return (
    <div className="ni-pred-section">
      <div className="ni-section-title">
        {label || "Predicted Price Impact (based on similar news patterns)"}
      </div>
      <div className="ni-pred-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {predChartData.map(p => {
          const isPos = p.avg >= 0;
          return (
            <div key={p.horizon} className="ni-pred-card">
              <span className="ni-pred-horizon">{p.horizon}</span>
              <span className="ni-pred-avg" style={{ color: isPos ? "#059669" : "#dc2626" }}>
                {isPos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isPos ? "+" : ""}{p.avg.toFixed(2)}%
              </span>
              <div className="ni-pred-meta">
                <span>Median: {p.median >= 0 ? "+" : ""}{p.median.toFixed(2)}%</span>
                <span>Win: {p.winRate}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={predChartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <XAxis dataKey="horizon" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, name: string) => [
                `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
                name === "avg" ? "Weighted Avg" : "Median",
              ]}
            />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Bar dataKey="avg" name="avg" radius={[4, 4, 0, 0]}>
              {predChartData.map((d, i) => (
                <Cell key={i} fill={d.avg >= 0 ? "#34d399" : "#f87171"} />
              ))}
            </Bar>
            <Bar dataKey="median" name="median" radius={[4, 4, 0, 0]} opacity={0.5}>
              {predChartData.map((d, i) => (
                <Cell key={i} fill={d.median >= 0 ? "#059669" : "#dc2626"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function NewsImpactPanel({ symbol }: Props) {
  const [data, setData] = useState<NewsImpactData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/analysis/news-impact/${symbol}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.message); return; }
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [symbol]);

  if (loading && !data) {
    return (
      <Card title="News Impact Analysis">
        <div className="ni-loading">
          <RefreshCw size={20} className="spin" />
          <span>Training on news corpus & computing similarities...</span>
          <span className="ni-loading-sub">First run may take 10-20s as it builds the training corpus</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="News Impact Analysis">
        <div className="ni-error">
          <span>{error}</span>
          <button className="ni-retry-btn" onClick={fetchData}>Retry</button>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  // Active prediction: per-article if selected, otherwise overall
  const activePrediction = selectedArticle !== null && data.perArticlePredictions[selectedArticle]
    ? data.perArticlePredictions[selectedArticle]
    : data.prediction;

  const predLabel = selectedArticle !== null
    ? `Price Impact — "${data.targetNews[selectedArticle]?.title.slice(0, 60)}..."`
    : "Predicted Price Impact (based on similar news patterns)";

  // Category distribution
  const catCounts: Record<string, number> = {};
  for (const m of data.matches) {
    catCounts[m.category] = (catCounts[m.category] || 0) + 1;
  }
  const catData = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ cat, count, color: CAT_COLORS[cat] || "#6b7280" }));

  const overallSentiment = data.targetNews.length > 0
    ? data.targetNews.reduce((s, n) => s + n.sentiment, 0) / data.targetNews.length
    : 0;
  const sentInfo = sentimentLabel(overallSentiment);

  return (
    <Card title="News-Based Pattern Matching Engine">
      {/* Header Stats */}
      <div className="ni-header-grid">
        <div className="ni-header-card">
          <div className="ni-header-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>
            <Brain size={16} />
          </div>
          <div>
            <span className="ni-header-label">Confidence</span>
            <span className="ni-header-val" style={{ color: confColor(data.confidence) }}>
              {data.confidence}%
            </span>
          </div>
        </div>

        <div className="ni-header-card">
          <div className="ni-header-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
            <Target size={16} />
          </div>
          <div>
            <span className="ni-header-label">Direction Accuracy</span>
            <span className="ni-header-val">
              {data.backtest.directionAccuracy}%
            </span>
          </div>
        </div>

        <div className="ni-header-card">
          <div className="ni-header-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
            <Newspaper size={16} />
          </div>
          <div>
            <span className="ni-header-label">News Sentiment</span>
            <span className="ni-header-val" style={{ color: sentInfo.color }}>
              {sentInfo.text}
            </span>
          </div>
        </div>

        <div className="ni-header-card">
          <div className="ni-header-icon" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
            <Zap size={16} />
          </div>
          <div>
            <span className="ni-header-label">Corpus / Training</span>
            <span className="ni-header-val" style={{ fontSize: 14 }}>
              {data.corpusSize} articles · Cycle {data.trainingCycles}
            </span>
          </div>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div className="ni-conf-breakdown">
        <div className="ni-conf-title">Confidence Breakdown</div>
        <div className="ni-conf-bars">
          {[
            { label: "Match Quality", val: data.confidenceBreakdown.matchQuality, max: 30, color: "#4f46e5" },
            { label: "Sample Size", val: data.confidenceBreakdown.sampleSize, max: 25, color: "#059669" },
            { label: "Consistency", val: data.confidenceBreakdown.consistency, max: 25, color: "#d97706" },
            { label: "Backtest", val: data.confidenceBreakdown.backtestScore, max: 20, color: "#7c3aed" },
          ].map(b => (
            <div key={b.label} className="ni-conf-bar-item">
              <div className="ni-conf-bar-header">
                <span>{b.label}</span>
                <span style={{ fontFamily: "var(--mono)" }}>{b.val}/{b.max}</span>
              </div>
              <div className="ni-conf-bar-track">
                <div className="ni-conf-bar-fill" style={{ width: `${(b.val / b.max) * 100}%`, background: b.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Price Prediction (switches when article selected) */}
      <PredictionCards prediction={activePrediction} label={predLabel} />

      {/* Backtest Results */}
      <div className="ni-backtest-section">
        <div className="ni-section-title">
          <Shield size={13} style={{ marginRight: 4 }} />
          Backtest Results
        </div>
        <div className="ni-backtest-grid">
          <div className="ni-bt-metric">
            <span className="ni-bt-label">Predictions Tested</span>
            <span className="ni-bt-val">{data.backtest.totalPredictions}</span>
          </div>
          <div className="ni-bt-metric">
            <span className="ni-bt-label">Direction Accuracy</span>
            <span className="ni-bt-val" style={{
              color: data.backtest.directionAccuracy >= 55 ? "#059669" : "#d97706"
            }}>
              {data.backtest.directionAccuracy}%
            </span>
          </div>
          <div className="ni-bt-metric">
            <span className="ni-bt-label">Avg Error</span>
            <span className="ni-bt-val">{data.backtest.avgError.toFixed(2)}%</span>
          </div>
          <div className="ni-bt-metric">
            <span className="ni-bt-label">Profit Factor</span>
            <span className="ni-bt-val" style={{
              color: data.backtest.profitFactor >= 1 ? "#059669" : "#dc2626"
            }}>
              {data.backtest.profitFactor.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Current News — clickable to select and to open source */}
      {data.targetNews.length > 0 && (
        <div className="ni-news-section">
          <div className="ni-section-title">
            Current News ({data.targetNews.length} articles)
            {selectedArticle !== null && (
              <button
                className="ni-clear-sel-btn"
                onClick={() => setSelectedArticle(null)}
              >
                Clear selection — show overall
              </button>
            )}
          </div>
          <div className="ni-news-list">
            {data.targetNews.slice(0, 8).map((n, i) => {
              const s = sentimentLabel(n.sentiment);
              const isSelected = selectedArticle === i;
              return (
                <div
                  key={i}
                  className={`ni-news-item ni-news-selectable ${isSelected ? "ni-news-selected" : ""}`}
                  onClick={() => setSelectedArticle(isSelected ? null : i)}
                >
                  <div className="ni-news-top-row">
                    <span className="ni-news-cat" style={{
                      color: CAT_COLORS[n.category] || "#6b7280",
                      borderColor: (CAT_COLORS[n.category] || "#6b7280") + "40",
                      background: (CAT_COLORS[n.category] || "#6b7280") + "10",
                    }}>
                      {n.category}
                    </span>
                    {n.link && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ni-news-link-btn"
                        onClick={(e) => e.stopPropagation()}
                        title="Open article in new tab"
                      >
                        <ExternalLink size={12} />
                        Source
                      </a>
                    )}
                  </div>
                  <span className="ni-news-title">{n.title}</span>
                  <div className="ni-news-meta">
                    <span className="ni-news-date">{n.date}</span>
                    <span className="ni-news-sent" style={{ color: s.color }}>{s.text}</span>
                    {isSelected && (
                      <span className="ni-news-sel-badge">Selected — predictions updated above</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Distribution */}
      {catData.length > 0 && (
        <div className="ni-cat-section">
          <div className="ni-section-title">Matched News Categories</div>
          <div className="ni-cat-chips">
            {catData.map(c => (
              <span key={c.cat} className="ni-cat-chip" style={{
                color: c.color,
                borderColor: c.color + "40",
                background: c.color + "10",
              }}>
                {c.cat} ({c.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Similar Matches (expandable) */}
      <div className="ni-matches-section">
        <button className="ni-matches-toggle" onClick={() => setShowMatches(!showMatches)}>
          {showMatches ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showMatches ? "Hide" : "Show"} Similar Historical News ({data.matches.length} matches)
        </button>

        {showMatches && (
          <div className="ni-matches-list fade-in">
            {data.matches.map((m, i) => (
              <div key={i} className={`ni-match-row ${expandedMatch === i ? "ni-match-expanded" : ""}`}
                onClick={() => setExpandedMatch(expandedMatch === i ? null : i)}>
                <div className="ni-match-header">
                  <div className="ni-match-left">
                    <span className="ni-match-sym">{m.matchSymbol}</span>
                    <span className="ni-match-title">{m.newsTitle.slice(0, 80)}{m.newsTitle.length > 80 ? "..." : ""}</span>
                  </div>
                  <div className="ni-match-right">
                    <span className="ni-match-sim" style={{
                      color: m.similarity > 0.5 ? "#059669" : m.similarity > 0.3 ? "#d97706" : "#6b7280"
                    }}>
                      {(m.similarity * 100).toFixed(0)}%
                    </span>
                    <span className="ni-match-cat" style={{ color: CAT_COLORS[m.category] || "#6b7280" }}>
                      {m.category}
                    </span>
                  </div>
                </div>

                {expandedMatch === i && (
                  <div className="ni-match-detail fade-in">
                    <div className="ni-match-date">{m.newsDate}</div>
                    <div className="ni-match-impacts">
                      {[
                        { label: "3D", val: m.priceImpact.day3 },
                        { label: "5D", val: m.priceImpact.day5 },
                        { label: "10D", val: m.priceImpact.day10 },
                      ].map(h => (
                        <div key={h.label} className="ni-match-impact">
                          <span className="ni-match-impact-label">{h.label}</span>
                          <span className="ni-match-impact-val" style={{
                            color: h.val == null ? "#6b7280" : h.val >= 0 ? "#059669" : "#dc2626"
                          }}>
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

      {/* Retrain Button */}
      <div className="ni-footer">
        <div className="ni-footer-info">
          Corpus: {data.corpusSize} articles · Training cycle #{data.trainingCycles}
          · Auto-trains on each request with rotating stock batches
        </div>
        <button className="ni-retrain-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={12} className={loading ? "spin" : ""} />
          {loading ? "Training..." : "Retrain Now"}
        </button>
      </div>
    </Card>
  );
}
