import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { StockDetail } from "../../api/analysis";
import { REC_COLORS } from "./analystHelpers";

interface Props {
  detail: StockDetail;
  currentPrice: number;
}

export function ConsensusTab({ detail, currentPrice }: Props) {
  const recData = detail.recommendations ? [
    { name: "Strong Buy", value: detail.recommendations.strongBuy },
    { name: "Buy", value: detail.recommendations.buy },
    { name: "Hold", value: detail.recommendations.hold },
    { name: "Sell", value: detail.recommendations.sell },
    { name: "Strong Sell", value: detail.recommendations.strongSell },
  ] : [];
  const totalRec = recData.reduce((s, d) => s + d.value, 0);

  const targetMean = typeof detail.analystTargetMean === "number" ? detail.analystTargetMean : null;
  const targetMedian = typeof detail.analystTargetMedian === "number" ? detail.analystTargetMedian : null;
  const targetLow = typeof detail.analystTargetLow === "number" ? detail.analystTargetLow : null;
  const targetHigh = typeof detail.analystTargetHigh === "number" ? detail.analystTargetHigh : null;
  const upside = targetMean ? ((targetMean - currentPrice) / currentPrice * 100) : null;
  const upsideMedian = targetMedian ? ((targetMedian - currentPrice) / currentPrice * 100) : null;

  const weights = [5, 4, 3, 2, 1];
  const weightedScore = totalRec > 0
    ? recData.reduce((s, d, i) => s + d.value * weights[i], 0) / totalRec : null;
  const scoreLabel = weightedScore == null ? "N/A" :
    weightedScore >= 4.2 ? "Strong Buy" : weightedScore >= 3.5 ? "Buy" :
      weightedScore >= 2.5 ? "Hold" : weightedScore >= 1.8 ? "Sell" : "Strong Sell";

  const pos52w = detail.fiftyTwoWeekHigh != null && detail.fiftyTwoWeekLow != null
    ? ((currentPrice - detail.fiftyTwoWeekLow) / (detail.fiftyTwoWeekHigh - detail.fiftyTwoWeekLow)) * 100
    : null;

  const aboveSMA50 = detail.fiftyDayAverage != null ? currentPrice > detail.fiftyDayAverage : null;
  const aboveSMA200 = detail.twoHundredDayAverage != null ? currentPrice > detail.twoHundredDayAverage : null;

  return (
    <div className="eap-consensus">
      <div className="eap-consensus-header">
        <div className="eap-target-card">
          <span className="metric-label">Mean Target</span>
          <span className="eap-big-price">{targetMean != null ? `$${targetMean.toFixed(2)}` : "N/A"}</span>
          {upside != null && (
            <span className={`eap-upside ${upside > 0 ? "text-green" : "text-red"}`}>
              {upside > 0 ? "+" : ""}{upside.toFixed(1)}% upside
            </span>
          )}
        </div>
        <div className="eap-target-card">
          <span className="metric-label">Median Target</span>
          <span className="eap-med-price">{targetMedian != null ? `$${targetMedian.toFixed(2)}` : "N/A"}</span>
          {upsideMedian != null && (
            <span className={`eap-upside ${upsideMedian > 0 ? "text-green" : "text-red"}`}>
              {upsideMedian > 0 ? "+" : ""}{upsideMedian.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="eap-target-card">
          <span className="metric-label">Consensus Score</span>
          <span className="eap-score" style={{ color: weightedScore != null && weightedScore >= 3.5 ? "#059669" : weightedScore != null && weightedScore >= 2.5 ? "#d97706" : "#dc2626" }}>
            {weightedScore != null ? weightedScore.toFixed(2) : "N/A"} / 5
          </span>
          <span className="eap-score-label">{scoreLabel}</span>
        </div>
      </div>

      <div className="eap-range-section">
        <div className="eap-range-labels">
          <span>Bear: ${targetLow != null ? targetLow.toFixed(0) : "?"}</span>
          <span className="eap-range-current">Current: ${currentPrice.toFixed(2)}</span>
          <span>Bull: ${targetHigh != null ? targetHigh.toFixed(0) : "?"}</span>
        </div>
        <div className="target-bar-track" style={{ height: 8 }}>
          <div className="target-bar-current" style={{
            left: targetLow != null && targetHigh != null && targetHigh > targetLow
              ? `${Math.max(0, Math.min(100, ((currentPrice - targetLow) / (targetHigh - targetLow)) * 100))}%` : "50%"
          }} />
        </div>
        <p className="eap-theory-note">
          Target prices reflect analysts' DCF (Discounted Cash Flow), comparable company analysis, and sum-of-parts valuations.
          The spread between low and high targets indicates uncertainty. A narrow spread = more consensus.
        </p>
      </div>

      <div className="eap-rec-section">
        <h4>{typeof detail.numberOfAnalysts === "number" ? detail.numberOfAnalysts : "?"} Analysts — Rating Distribution</h4>
        {recData.length > 0 && (
          <div className="eap-rec-chart">
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={recData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} (${totalRec > 0 ? ((v / totalRec) * 100).toFixed(0) : 0}%)`, "Analysts"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {recData.map((d) => <Cell key={d.name} fill={REC_COLORS[d.name] || "#6b7280"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="eap-signals-grid">
        <div className="eap-signal-item">
          <span className="metric-label">52-Week Range Position</span>
          <div className="eap-mini-bar">
            <div className="eap-mini-fill" style={{ width: `${pos52w ?? 50}%`, background: pos52w != null && pos52w < 30 ? "#059669" : pos52w != null && pos52w > 80 ? "#dc2626" : "#d97706" }} />
          </div>
          <span className="text-sm text-muted">{pos52w != null ? `${pos52w.toFixed(0)}% from low` : "N/A"} — {pos52w != null && pos52w < 30 ? "Near 52w low (potential value)" : pos52w != null && pos52w > 80 ? "Near 52w high (momentum / stretched)" : "Mid-range"}</span>
        </div>
        <div className="eap-signal-item">
          <span className="metric-label">Moving Average Signals</span>
          <div className="eap-ma-badges">
            <span className={`eap-badge ${aboveSMA50 ? "badge-green" : "badge-red"}`}>
              {aboveSMA50 ? "Above" : "Below"} 50-day SMA ({detail.fiftyDayAverage != null ? `$${detail.fiftyDayAverage.toFixed(2)}` : "?"})
            </span>
            <span className={`eap-badge ${aboveSMA200 ? "badge-green" : "badge-red"}`}>
              {aboveSMA200 ? "Above" : "Below"} 200-day SMA ({detail.twoHundredDayAverage != null ? `$${detail.twoHundredDayAverage.toFixed(2)}` : "?"})
            </span>
          </div>
          <span className="text-sm text-muted">
            {aboveSMA50 && aboveSMA200 ? "Golden cross zone — bullish long-term trend" :
              !aboveSMA50 && !aboveSMA200 ? "Death cross zone — bearish trend" :
                aboveSMA50 && !aboveSMA200 ? "Short-term recovery, long-term still bearish" :
                  "Short-term weakness, long-term still bullish"}
          </span>
        </div>
        <div className="eap-signal-item">
          <span className="metric-label">52-Week Performance</span>
          <span className={`eap-perf ${detail.fiftyTwoWeekChange != null && detail.fiftyTwoWeekChange > 0 ? "text-green" : "text-red"}`}>
            {detail.fiftyTwoWeekChange != null ? `${(detail.fiftyTwoWeekChange * 100).toFixed(1)}%` : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}
