import type { ReactNode } from "react";
import type { StockQuote } from "../../types/stock";

interface Props {
  stock: StockQuote;
  children?: ReactNode;
}

interface Factor {
  label: string;
  value: string;
  points: number;
  maxPoints: number;
  reason: string;
}

function scorePE(pe: number | null): Factor {
  const max = 25;
  if (pe === null) return { label: "P/E Ratio", value: "N/A", points: 0, maxPoints: max, reason: "No data available" };
  let pts = 0;
  let reason = "";
  if (pe > 0 && pe < 15) { pts = 25; reason = `P/E of ${pe.toFixed(1)} is excellent (under 15)`; }
  else if (pe < 25) { pts = 15; reason = `P/E of ${pe.toFixed(1)} is reasonable (15-25)`; }
  else if (pe < 35) { pts = 5; reason = `P/E of ${pe.toFixed(1)} is high (25-35)`; }
  else { pts = 0; reason = `P/E of ${pe.toFixed(1)} is expensive (over 35)`; }
  return { label: "P/E Ratio", value: pe.toFixed(1), points: pts, maxPoints: max, reason };
}

function scoreDividend(dy: number | null): Factor {
  const max = 20;
  if (dy === null) return { label: "Dividend Yield", value: "N/A", points: 0, maxPoints: max, reason: "No dividend data" };
  const pct = (dy * 100).toFixed(2);
  if (dy > 0.04) return { label: "Dividend Yield", value: `${pct}%`, points: 20, maxPoints: max, reason: `${pct}% yield is strong (over 4%)` };
  if (dy > 0.02) return { label: "Dividend Yield", value: `${pct}%`, points: 15, maxPoints: max, reason: `${pct}% yield is solid (2-4%)` };
  if (dy > 0) return { label: "Dividend Yield", value: `${pct}%`, points: 10, maxPoints: max, reason: `${pct}% yield is modest (under 2%)` };
  return { label: "Dividend Yield", value: "0%", points: 0, maxPoints: max, reason: "No dividend paid" };
}

function scoreMOS(mos: number | null): Factor {
  const max = 25;
  if (mos === null) return { label: "Margin of Safety", value: "N/A", points: 0, maxPoints: max, reason: "Cannot calculate intrinsic value" };
  if (mos > 20) return { label: "Margin of Safety", value: `${mos.toFixed(1)}%`, points: 25, maxPoints: max, reason: `${mos.toFixed(1)}% margin — significantly undervalued` };
  if (mos > 0) return { label: "Margin of Safety", value: `${mos.toFixed(1)}%`, points: 15, maxPoints: max, reason: `${mos.toFixed(1)}% margin — slightly undervalued` };
  if (mos > -20) return { label: "Margin of Safety", value: `${mos.toFixed(1)}%`, points: 5, maxPoints: max, reason: `${mos.toFixed(1)}% — slightly overvalued` };
  return { label: "Margin of Safety", value: `${mos.toFixed(1)}%`, points: 0, maxPoints: max, reason: `${mos.toFixed(1)}% — significantly overvalued` };
}

function scoreDTE(dte: number | null): Factor {
  const max = 15;
  if (dte === null) return { label: "Debt/Equity", value: "N/A", points: 0, maxPoints: max, reason: "No debt data" };
  if (dte >= 0 && dte < 50) return { label: "Debt/Equity", value: dte.toFixed(0), points: 15, maxPoints: max, reason: `D/E of ${dte.toFixed(0)} — low leverage, healthy` };
  if (dte < 100) return { label: "Debt/Equity", value: dte.toFixed(0), points: 10, maxPoints: max, reason: `D/E of ${dte.toFixed(0)} — moderate leverage` };
  if (dte < 200) return { label: "Debt/Equity", value: dte.toFixed(0), points: 5, maxPoints: max, reason: `D/E of ${dte.toFixed(0)} — high leverage` };
  return { label: "Debt/Equity", value: dte.toFixed(0), points: 0, maxPoints: max, reason: `D/E of ${dte.toFixed(0)} — very high leverage` };
}

function scoreROE(roe: number | null): Factor {
  const max = 15;
  if (roe === null) return { label: "Return on Equity", value: "N/A", points: 0, maxPoints: max, reason: "No ROE data" };
  const pct = (roe * 100).toFixed(1);
  if (roe > 0.2) return { label: "Return on Equity", value: `${pct}%`, points: 15, maxPoints: max, reason: `ROE of ${pct}% — excellent profitability` };
  if (roe > 0.1) return { label: "Return on Equity", value: `${pct}%`, points: 10, maxPoints: max, reason: `ROE of ${pct}% — good profitability` };
  if (roe > 0) return { label: "Return on Equity", value: `${pct}%`, points: 5, maxPoints: max, reason: `ROE of ${pct}% — low profitability` };
  return { label: "Return on Equity", value: `${pct}%`, points: 0, maxPoints: max, reason: `ROE of ${pct}% — negative, losing money` };
}

export function HealthDetail({ stock, children }: Props) {
  const factors = [
    scorePE(stock.peRatio),
    scoreDividend(stock.dividendYield),
    scoreMOS(stock.marginOfSafety),
    scoreDTE(stock.debtToEquity),
    scoreROE(stock.returnOnEquity),
  ];

  const active = factors.filter((f) => f.value !== "N/A");
  const totalPts = factors.reduce((s, f) => s + f.points, 0);
  const totalMax = active.length > 0 ? active.length * 20 : 1;
  const finalScore = Math.round((totalPts / totalMax) * 100);

  return (
    <div className="health-detail">
      <div className="health-detail-header">
        <span>{stock.symbol} — Score Breakdown</span>
        <span className="font-bold">{finalScore} / 100</span>
      </div>
      {factors.map((f) => (
        <div key={f.label} className="health-factor">
          <div className="health-factor-top">
            <span className="health-factor-label">{f.label}</span>
            <span className="health-factor-value">{f.value}</span>
            <span className={`health-factor-pts ${f.points >= f.maxPoints * 0.7 ? "text-green" : f.points > 0 ? "text-muted" : "text-red"}`}>
              {f.points}/{f.maxPoints}
            </span>
          </div>
          <div className="health-factor-bar-track">
            <div
              className="health-factor-bar-fill"
              style={{
                width: `${Math.min((f.points / f.maxPoints) * 100, 100)}%`,
                background: f.points >= f.maxPoints * 0.7 ? "var(--green)" : f.points > 0 ? "#d97706" : "var(--red)",
              }}
            />
          </div>
          <p className="health-factor-reason">{f.reason}</p>
        </div>
      ))}
      <div className="health-detail-footer">
        <p>Formula: Raw points ({totalPts}) / active factors ({active.length}) normalized to 0-100</p>
        <p>Factors with N/A data are excluded from calculation</p>
        {children && <div style={{ marginTop: 8 }}>{children}</div>}
      </div>
    </div>
  );
}
