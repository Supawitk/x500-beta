import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  BarChart, Bar, Cell, AreaChart, Area,
} from "recharts";
import type { StockDetail } from "../../api/analysis";
import { fmt, fmtPct, fmtB, zone, scoreNorm, grahamNumber, pegAssessment, marginOfSafety } from "./analystHelpers";

interface Props {
  detail: StockDetail;
  currentPrice: number;
}

export function ValuationTab({ detail, currentPrice }: Props) {
  const graham = grahamNumber(detail.trailingEps, detail.bookValue);
  const grahamMos = marginOfSafety(currentPrice, graham);
  const pegInfo = pegAssessment(detail.pegRatio);

  const dcfValue = (() => {
    if (detail.forwardEps == null || detail.earningsGrowth == null) return null;
    const g = detail.earningsGrowth;
    const discountRate = 0.10;
    let value = 0;
    for (let y = 1; y <= 10; y++) {
      const futureEps = detail.forwardEps! * Math.pow(1 + Math.min(g, 0.3), y);
      value += futureEps / Math.pow(1 + discountRate, y);
    }
    const terminalEps = detail.forwardEps! * Math.pow(1 + Math.min(g, 0.3), 10);
    value += (terminalEps * (1 + 0.03)) / (discountRate - 0.03) / Math.pow(1 + discountRate, 10);
    return Math.max(0, value);
  })();
  const dcfMos = marginOfSafety(currentPrice, dcfValue);

  const earningsYield = detail.trailingPE != null && detail.trailingPE > 0 ? (1 / detail.trailingPE) * 100 : null;

  const models = [
    {
      name: "Graham Number",
      theory: "Benjamin Graham (The Intelligent Investor): Intrinsic value = \u221A(22.5 \u00D7 EPS \u00D7 Book Value). Assumes a fair P/E of 15 and P/B of 1.5.",
      value: graham, mos: grahamMos,
      inputs: `EPS: $${fmt(detail.trailingEps)} | Book Value: $${fmt(detail.bookValue)}`,
    },
    {
      name: "PEG Ratio (Peter Lynch)",
      theory: pegInfo.theory,
      value: detail.pegRatio != null ? currentPrice * (detail.pegRatio <= 1 ? 1 : 0) : null,
      mos: null, pegInfo,
      inputs: `PEG: ${fmt(detail.pegRatio)} | P/E: ${fmt(detail.trailingPE)} | Growth: ${fmtPct(detail.earningsGrowth)}`,
    },
    {
      name: "DCF (10-Year Simplified)",
      theory: "Discounted Cash Flow projects future earnings at current growth rate, discounted at 10% WACC with 3% terminal growth. Conservative estimate for screening.",
      value: dcfValue, mos: dcfMos,
      inputs: `Forward EPS: $${fmt(detail.forwardEps)} | Growth: ${fmtPct(detail.earningsGrowth)} | Discount: 10%`,
    },
  ];

  const valScatter = [
    detail.trailingPE != null && detail.priceToBook != null ? {
      x: detail.trailingPE, y: detail.priceToBook,
      z: earningsYield ?? 0, name: "Current"
    } : null,
  ].filter(Boolean);

  return (
    <div className="eap-valuation">
      <div className="eap-val-quick">
        <div className="eap-val-metric">
          <span className="metric-label">Trailing P/E</span>
          <span className="eap-val-num" style={{ color: zone(detail.trailingPE, [15, 25, 40], ["Cheap", "Fair", "Expensive", "Very Expensive"]).color }}>
            {fmt(detail.trailingPE)}
          </span>
          <span className="text-sm text-muted">{zone(detail.trailingPE, [15, 25, 40], ["Cheap (<15)", "Fair (15-25)", "Expensive (25-40)", "Very Expensive (>40)"]).label}</span>
        </div>
        <div className="eap-val-metric">
          <span className="metric-label">Forward P/E</span>
          <span className="eap-val-num">{fmt(detail.forwardPE)}</span>
          {detail.trailingPE != null && detail.forwardPE != null && (
            <span className={`text-sm ${detail.forwardPE < detail.trailingPE ? "text-green" : "text-red"}`}>
              {detail.forwardPE < detail.trailingPE ? "Earnings expected to grow" : "Earnings expected to decline"}
            </span>
          )}
        </div>
        <div className="eap-val-metric">
          <span className="metric-label">P/B Ratio</span>
          <span className="eap-val-num" style={{ color: zone(detail.priceToBook, [1, 3, 5], ["Deep Value", "Fair", "Growth Premium", "Expensive"]).color }}>
            {fmt(detail.priceToBook)}
          </span>
          <span className="text-sm text-muted">{zone(detail.priceToBook, [1, 3, 5], ["Deep Value (<1)", "Fair (1-3)", "Growth Premium (3-5)", "Expensive (>5)"]).label}</span>
        </div>
        <div className="eap-val-metric">
          <span className="metric-label">EV/EBITDA</span>
          <span className="eap-val-num" style={{ color: zone(detail.enterpriseToEbitda, [10, 15, 25], ["Cheap", "Fair", "Expensive", "Very Expensive"]).color }}>
            {fmt(detail.enterpriseToEbitda)}
          </span>
          <span className="text-sm text-muted">{zone(detail.enterpriseToEbitda, [10, 15, 25], ["Cheap (<10)", "Fair (10-15)", "Expensive (15-25)", "Very Expensive (>25)"]).label}</span>
        </div>
        <div className="eap-val-metric">
          <span className="metric-label">Earnings Yield</span>
          <span className="eap-val-num" style={{ color: earningsYield != null && earningsYield > 5 ? "#059669" : "#d97706" }}>
            {earningsYield != null ? earningsYield.toFixed(2) + "%" : "N/A"}
          </span>
          <span className="text-sm text-muted">
            {earningsYield != null && earningsYield > 5 ? "Above risk-free rate — attractive" : "Compare vs. 10Y Treasury (~4.5%)"}
          </span>
        </div>
        <div className="eap-val-metric">
          <span className="metric-label">EV/Revenue</span>
          <span className="eap-val-num">{fmt(detail.enterpriseToRevenue)}</span>
        </div>
      </div>

      <h4 className="eap-section-title">Intrinsic Value Models</h4>
      <div className="eap-models-list">
        {models.map((m) => (
          <div key={m.name} className="eap-model-card">
            <div className="eap-model-header">
              <h5>{m.name}</h5>
              {m.value != null && m.name !== "PEG Ratio (Peter Lynch)" && (
                <span className="eap-model-value">${m.value.toFixed(2)}</span>
              )}
              {m.pegInfo && (
                <span className="eap-model-value" style={{ color: m.pegInfo.color }}>{m.pegInfo.label}</span>
              )}
            </div>
            <p className="eap-model-inputs">{m.inputs}</p>
            {m.mos && (
              <div className="eap-mos-bar">
                <div className="eap-mos-label" style={{ color: m.mos.color }}>
                  Margin of Safety: {m.mos.pct > 0 ? "+" : ""}{m.mos.pct}%
                </div>
                <div className="eap-mos-track">
                  <div className="eap-mos-fill" style={{
                    width: `${Math.min(100, Math.max(0, m.mos.pct + 50))}%`,
                    background: m.mos.color,
                  }} />
                </div>
                <span className="text-sm text-muted">{m.mos.label}</span>
              </div>
            )}
            <p className="eap-theory">{m.theory}</p>
          </div>
        ))}
      </div>

      {valScatter.length > 0 && detail.trailingPE != null && (
        <div className="eap-val-scatter">
          <h4 className="eap-section-title">Valuation Zone Map</h4>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" dataKey="x" name="P/E" label={{ value: "P/E Ratio", position: "bottom", offset: 10 }} />
              <YAxis type="number" dataKey="y" name="P/B" label={{ value: "P/B", angle: -90, position: "left" }} />
              <ZAxis type="number" dataKey="z" range={[100, 400]} name="Earnings Yield" />
              <Tooltip formatter={(v: number, name: string) => [v.toFixed(2), name]} />
              <Scatter data={[{ x: 15, y: 1.5, z: 6.7, name: "Graham Ideal" }]} fill="#059669" shape="star" />
              <Scatter data={valScatter} fill="#4f46e5" shape="circle" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-sm text-muted" style={{ textAlign: "center" }}>
            Star = Graham's ideal (P/E 15, P/B 1.5). Circle = current stock. Size = earnings yield.
          </p>
        </div>
      )}
    </div>
  );
}

export function ScorecardTab({ detail }: { detail: StockDetail }) {
  const d = detail;
  const sn = scoreNorm;
  const dimensions = [
    { name: "Profitability", score: Math.round((sn(d.profitMargins, -0.1, 0.4) + sn(d.grossMargins, 0, 0.8) + sn(d.operatingMargins, -0.1, 0.4)) / 3),
      details: `Net: ${fmtPct(d.profitMargins)} | Gross: ${fmtPct(d.grossMargins)} | Op: ${fmtPct(d.operatingMargins)}`,
      theory: "Buffett's 'moat indicator' \u2014 consistently high margins indicate pricing power and competitive advantage." },
    { name: "Growth", score: Math.round((sn(d.revenueGrowth, -0.2, 0.5) + sn(d.earningsGrowth, -0.3, 0.6)) / 2),
      details: `Revenue: ${fmtPct(d.revenueGrowth)} | Earnings: ${fmtPct(d.earningsGrowth)}`,
      theory: "Philip Fisher: Consistent above-average growth indicates a well-managed company in a growing market." },
    { name: "Value", score: Math.round((sn(d.trailingPE, 5, 50, true) + sn(d.priceToBook, 0, 10, true) + sn(d.enterpriseToEbitda, 3, 30, true)) / 3),
      details: `P/E: ${fmt(d.trailingPE)} | P/B: ${fmt(d.priceToBook)} | EV/EBITDA: ${fmt(d.enterpriseToEbitda)}`,
      theory: "Benjamin Graham: Buy stocks priced below intrinsic value. Lower multiples suggest a wider margin of safety." },
    { name: "Quality", score: Math.round((sn(d.returnOnEquity, -0.1, 0.4) + sn(d.returnOnAssets, -0.05, 0.2) + sn(d.currentRatio, 0.5, 3)) / 3),
      details: `ROE: ${fmtPct(d.returnOnEquity)} | ROA: ${fmtPct(d.returnOnAssets)} | Current Ratio: ${fmt(d.currentRatio)}`,
      theory: "Greenblatt's Magic Formula: High ROE + ROA = efficient capital allocation. Current ratio > 1.5 = healthy liquidity." },
    { name: "Safety", score: Math.round((sn(d.debtToEquity, 0, 200, true) + sn(d.currentRatio, 0.5, 3) + sn(d.beta, 0, 2, true)) / 3),
      details: `D/E: ${fmt(d.debtToEquity)} | Beta: ${fmt(d.beta)} | Quick: ${fmt(d.quickRatio)}`,
      theory: "Low debt-to-equity (Graham < 100%), low beta = defensive. High D/E amplifies risk in downturns." },
    { name: "Momentum", score: sn(d.fiftyTwoWeekChange, -0.5, 0.8),
      details: `52W Change: ${d.fiftyTwoWeekChange != null ? (d.fiftyTwoWeekChange * 100).toFixed(1) + "%" : "N/A"}`,
      theory: "Jegadeesh & Titman (1993): Stocks with positive 12-month momentum tend to continue outperforming." },
  ];

  const radarData = dimensions.map(d => ({ subject: d.name, score: d.score, fullMark: 100 }));
  const overallScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  const overallColor = overallScore >= 70 ? "#059669" : overallScore >= 50 ? "#d97706" : "#dc2626";
  const overallLabel = overallScore >= 80 ? "Excellent" : overallScore >= 65 ? "Good" : overallScore >= 50 ? "Average" : overallScore >= 35 ? "Below Average" : "Weak";

  return (
    <div className="eap-scorecard">
      <div className="eap-overall">
        <div className="eap-overall-circle" style={{ borderColor: overallColor }}>
          <span className="eap-overall-num" style={{ color: overallColor }}>{overallScore}</span>
          <span className="eap-overall-label">{overallLabel}</span>
        </div>
        <div className="eap-overall-info">
          <h4>Fundamental Scorecard</h4>
          <p className="text-muted">Composite score across 6 dimensions based on value investing principles from Graham, Buffett, Lynch, and modern factor research.</p>
        </div>
      </div>

      <div className="eap-radar-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData} outerRadius="75%">
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
            <Radar name="Score" dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.25} strokeWidth={2} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="eap-dim-list">
        {dimensions.map(d => (
          <div key={d.name} className="eap-dim-row">
            <div className="eap-dim-top">
              <span className="eap-dim-name">{d.name}</span>
              <div className="eap-dim-bar-wrap">
                <div className="eap-dim-bar" style={{ width: `${d.score}%`, background: d.score >= 70 ? "#059669" : d.score >= 50 ? "#d97706" : "#dc2626" }} />
              </div>
              <span className="eap-dim-score">{d.score}/100</span>
            </div>
            <p className="eap-dim-details">{d.details}</p>
            <p className="eap-theory">{d.theory}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
