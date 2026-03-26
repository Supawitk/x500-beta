import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { ThreeDChart } from "./ThreeDChart";
import type { StockDetail, AnalysisDataPoint } from "../../api/analysis";
import { fmt, fmtB } from "./analystHelpers";

export function ThreeDTab({ analysisData }: { analysisData: AnalysisDataPoint[] }) {
  return (
    <div className="eap-3d-tab">
      <h4 className="eap-section-title">3D Indicator Distribution</h4>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Explore how technical indicators cluster in 3D space. Each point is a trading day, colored by next-day return.
        Green clusters = indicator combinations that preceded gains. Drag to rotate. Hover for details.
      </p>
      <ThreeDChart data={analysisData} />
      <div className="eap-3d-theory">
        <h5>How to interpret</h5>
        <ul>
          <li><strong>Clustering patterns:</strong> If green (positive return) and red (negative return) points form distinct clusters, those indicator combinations have predictive value.</li>
          <li><strong>Overlap:</strong> Heavy overlap between colors means indicators alone have limited predictive power in that zone — look for other signals.</li>
          <li><strong>Edge cases:</strong> Points at extremes (corners) often represent extreme readings (e.g., RSI &gt; 80 + high momentum) — these tend to be mean-reverting.</li>
          <li><strong>Theory:</strong> Based on Fama-French factor research and technical analysis — multiple uncorrelated signals combined improve prediction accuracy (ensemble principle).</li>
        </ul>
      </div>
    </div>
  );
}

export function RiskTab({ detail, currentPrice }: { detail: StockDetail; currentPrice: number }) {
  const targetMean = detail.analystTargetMean;
  const targetLow = detail.analystTargetLow;
  const potentialUpside = targetMean != null ? ((targetMean - currentPrice) / currentPrice) * 100 : null;
  const potentialDownside = targetLow != null ? ((targetLow - currentPrice) / currentPrice) * 100 : null;
  const riskRewardRatio = potentialUpside != null && potentialDownside != null && potentialDownside < 0
    ? Math.abs(potentialUpside / potentialDownside) : null;

  const shortPct = detail.shortPercentOfFloat;
  const shortSqueeze = shortPct != null && shortPct > 0.2;
  const shortSignal = shortPct == null ? "N/A" :
    shortPct > 0.2 ? "Very High (>20%) \u2014 potential short squeeze or significant bearish sentiment" :
      shortPct > 0.1 ? "Elevated (10-20%) \u2014 notable bearish positioning" :
        shortPct > 0.05 ? "Moderate (5-10%) \u2014 normal range" :
          "Low (<5%) \u2014 minimal bearish positioning";

  const instOwn = detail.heldPercentInstitutions;
  const insiderOwn = detail.heldPercentInsiders;

  const betaLabel = detail.beta == null ? "N/A" :
    detail.beta > 1.5 ? "High volatility \u2014 moves 50%+ more than market" :
      detail.beta > 1.1 ? "Above-average volatility" :
        detail.beta > 0.9 ? "Market-like volatility" :
          detail.beta > 0.5 ? "Below-average volatility \u2014 defensive" :
            "Very low volatility \u2014 bond-like behavior";

  const rrData = targetLow != null && detail.analystTargetHigh != null ? [
    { name: "Bear Case", value: ((targetLow - currentPrice) / currentPrice * 100) },
    { name: "Current", value: 0 },
    { name: "Mean Target", value: targetMean != null ? ((targetMean - currentPrice) / currentPrice * 100) : 0 },
    { name: "Bull Case", value: ((detail.analystTargetHigh - currentPrice) / currentPrice * 100) },
  ] : [];

  const healthSignals = [
    {
      name: "Debt-to-Equity",
      value: detail.debtToEquity != null ? detail.debtToEquity.toFixed(0) + "%" : "N/A",
      signal: detail.debtToEquity == null ? "neutral" : detail.debtToEquity < 50 ? "green" : detail.debtToEquity < 100 ? "yellow" : "red",
      note: detail.debtToEquity == null ? "" : detail.debtToEquity < 50 ? "Conservative leverage (Graham approved)" : detail.debtToEquity < 100 ? "Moderate" : "High leverage \u2014 higher risk in downturns",
    },
    {
      name: "Current Ratio",
      value: fmt(detail.currentRatio),
      signal: detail.currentRatio == null ? "neutral" : detail.currentRatio > 2 ? "green" : detail.currentRatio > 1 ? "yellow" : "red",
      note: detail.currentRatio == null ? "" : detail.currentRatio > 2 ? "Strong liquidity" : detail.currentRatio > 1 ? "Adequate" : "Liquidity concern",
    },
    {
      name: "Free Cash Flow",
      value: fmtB(detail.freeCashflow),
      signal: detail.freeCashflow == null ? "neutral" : detail.freeCashflow > 0 ? "green" : "red",
      note: detail.freeCashflow != null && detail.freeCashflow > 0 ? "Positive FCF \u2014 can fund growth, dividends, buybacks" : "Negative FCF \u2014 burning cash",
    },
    {
      name: "Cash on Hand",
      value: fmtB(detail.totalCash),
      signal: "neutral",
      note: detail.totalDebt != null && detail.totalCash != null
        ? `Net debt: ${fmtB(detail.totalDebt - detail.totalCash)}` : "",
    },
  ];

  return (
    <div className="eap-risk">
      <div className="eap-risk-top">
        <div className="eap-rr-card">
          <h5>Risk-Reward Ratio</h5>
          <span className="eap-rr-num" style={{ color: riskRewardRatio != null && riskRewardRatio >= 2 ? "#059669" : riskRewardRatio != null && riskRewardRatio >= 1 ? "#d97706" : "#dc2626" }}>
            {riskRewardRatio != null ? riskRewardRatio.toFixed(2) + ":1" : "N/A"}
          </span>
          <p className="text-sm text-muted">
            {riskRewardRatio != null && riskRewardRatio >= 3 ? "Excellent risk-reward (>3:1) \u2014 asymmetric upside" :
              riskRewardRatio != null && riskRewardRatio >= 2 ? "Good risk-reward (>2:1)" :
                riskRewardRatio != null && riskRewardRatio >= 1 ? "Fair risk-reward" :
                  "Unfavorable \u2014 more downside than upside potential"}
          </p>
          <div className="eap-rr-details">
            <span className="text-green">Upside: {potentialUpside != null ? `+${potentialUpside.toFixed(1)}%` : "?"}</span>
            <span className="text-red">Downside: {potentialDownside != null ? `${potentialDownside.toFixed(1)}%` : "?"}</span>
          </div>
        </div>
        <div className="eap-rr-card">
          <h5>Beta (Market Risk)</h5>
          <span className="eap-rr-num">{detail.beta != null ? detail.beta.toFixed(2) : "N/A"}</span>
          <p className="text-sm text-muted">{betaLabel}</p>
          <p className="eap-theory">
            CAPM Theory: Beta measures systematic risk. Beta = 1 means market-matching risk.
            Higher beta = higher expected return (risk premium) but also larger drawdowns.
          </p>
        </div>
      </div>

      {rrData.length > 0 && (
        <div className="eap-scenario-chart">
          <h4 className="eap-section-title">Scenario Analysis (from current price)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={rrData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v > 0 ? "+" : ""}${v.toFixed(1)}%`, "Return"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {rrData.map((d, i) => <Cell key={i} fill={d.value > 0 ? "#059669" : d.value < 0 ? "#dc2626" : "#6b7280"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="eap-short-section">
        <h4 className="eap-section-title">Short Interest & Ownership</h4>
        <div className="eap-ownership-grid">
          <div className="eap-own-card">
            <span className="metric-label">Short % of Float</span>
            <span className={`eap-own-val ${shortSqueeze ? "text-red" : ""}`}>
              {shortPct != null ? (shortPct * 100).toFixed(1) + "%" : "N/A"}
            </span>
            <span className="text-sm text-muted">{shortSignal}</span>
          </div>
          <div className="eap-own-card">
            <span className="metric-label">Short Ratio (Days to Cover)</span>
            <span className="eap-own-val">{detail.shortRatio != null ? detail.shortRatio.toFixed(1) + " days" : "N/A"}</span>
            <span className="text-sm text-muted">
              {detail.shortRatio != null && detail.shortRatio > 5 ? "High \u2014 takes many days to cover all shorts" : "Normal coverage time"}
            </span>
          </div>
          <div className="eap-own-card">
            <span className="metric-label">Institutional Ownership</span>
            <span className="eap-own-val">{instOwn != null ? (instOwn * 100).toFixed(1) + "%" : "N/A"}</span>
            <span className="text-sm text-muted">
              {instOwn != null && instOwn > 0.7 ? "Heavily institutional \u2014 follows market trends closely" :
                instOwn != null && instOwn > 0.4 ? "Good institutional interest" : "Low institutional ownership"}
            </span>
          </div>
          <div className="eap-own-card">
            <span className="metric-label">Insider Ownership</span>
            <span className="eap-own-val">{insiderOwn != null ? (insiderOwn * 100).toFixed(1) + "%" : "N/A"}</span>
            <span className="text-sm text-muted">
              {insiderOwn != null && insiderOwn > 0.1 ? "Significant insider ownership \u2014 aligned interests (Buffett likes this)" :
                "Low insider stake"}
            </span>
          </div>
        </div>
      </div>

      <div className="eap-health-section">
        <h4 className="eap-section-title">Financial Health Signals</h4>
        <div className="eap-health-grid">
          {healthSignals.map(h => (
            <div key={h.name} className="eap-health-row">
              <span className={`eap-health-dot dot-${h.signal}`} />
              <span className="eap-health-name">{h.name}</span>
              <span className="eap-health-val">{h.value}</span>
              <span className="text-sm text-muted">{h.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
