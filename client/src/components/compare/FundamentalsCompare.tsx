import { useMemo } from "react";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

interface Props {
  stocks: CompareStock[];
}

type Status = "good" | "neutral" | "bad";

interface MetricDef {
  label: string;
  category: string;
  get: (s: CompareStock) => number | null;
  format: (v: number | null) => string;
  status: (v: number | null) => Status;
  higherBetter?: boolean;
}

function pct(v: number | null): string { return v !== null ? `${(v * 100).toFixed(1)}%` : "—"; }
function num(v: number | null, d = 2): string { return v !== null ? v.toFixed(d) : "—"; }
function fmtCap(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

const METRICS: MetricDef[] = [
  // Valuation
  { label: "P/E Ratio", category: "Valuation", get: s => s.quote?.peRatio ?? null, format: v => num(v, 1),
    status: v => v === null ? "neutral" : v < 20 ? "good" : v > 40 ? "bad" : "neutral", higherBetter: false },
  { label: "Forward P/E", category: "Valuation", get: s => s.quote?.forwardPE ?? null, format: v => num(v, 1),
    status: v => v === null ? "neutral" : v < 18 ? "good" : v > 35 ? "bad" : "neutral", higherBetter: false },
  { label: "PEG", category: "Valuation", get: s => s.detail?.pegRatio ?? null, format: v => num(v),
    status: v => v === null ? "neutral" : v < 1 ? "good" : v > 2 ? "bad" : "neutral", higherBetter: false },
  { label: "Price/Book", category: "Valuation", get: s => s.quote?.priceToBook ?? null, format: v => num(v, 1),
    status: v => v === null ? "neutral" : v < 3 ? "good" : v > 10 ? "bad" : "neutral", higherBetter: false },
  { label: "EV/EBITDA", category: "Valuation", get: s => s.detail?.enterpriseToEbitda ?? null, format: v => num(v, 1),
    status: v => v === null ? "neutral" : v < 12 ? "good" : v > 25 ? "bad" : "neutral", higherBetter: false },
  { label: "Margin of Safety", category: "Valuation", get: s => s.quote?.marginOfSafety ?? null, format: v => v !== null ? `${v.toFixed(1)}%` : "—",
    status: v => v === null ? "neutral" : v > 10 ? "good" : v < -20 ? "bad" : "neutral", higherBetter: true },

  // Profitability
  { label: "Gross Margin", category: "Profitability", get: s => s.detail?.grossMargins ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.4 ? "good" : v < 0.2 ? "bad" : "neutral", higherBetter: true },
  { label: "Operating Margin", category: "Profitability", get: s => s.detail?.operatingMargins ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.2 ? "good" : v < 0.05 ? "bad" : "neutral", higherBetter: true },
  { label: "Profit Margin", category: "Profitability", get: s => s.detail?.profitMargins ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.15 ? "good" : v < 0.03 ? "bad" : "neutral", higherBetter: true },
  { label: "ROE", category: "Profitability", get: s => s.quote?.returnOnEquity ?? null, format: v => v !== null ? `${(v * 100).toFixed(1)}%` : "—",
    status: v => v === null ? "neutral" : v > 0.15 ? "good" : v < 0.05 ? "bad" : "neutral", higherBetter: true },
  { label: "ROA", category: "Profitability", get: s => s.detail?.returnOnAssets ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.08 ? "good" : v < 0.02 ? "bad" : "neutral", higherBetter: true },

  // Growth
  { label: "Revenue Growth", category: "Growth", get: s => s.detail?.revenueGrowth ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.15 ? "good" : v < 0 ? "bad" : "neutral", higherBetter: true },
  { label: "Earnings Growth", category: "Growth", get: s => s.detail?.earningsGrowth ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.15 ? "good" : v < 0 ? "bad" : "neutral", higherBetter: true },

  // Financial Health
  { label: "Current Ratio", category: "Health", get: s => s.detail?.currentRatio ?? null, format: v => num(v),
    status: v => v === null ? "neutral" : v > 1.5 ? "good" : v < 1 ? "bad" : "neutral", higherBetter: true },
  { label: "Debt/Equity", category: "Health", get: s => s.quote?.debtToEquity ?? null, format: v => v !== null ? v.toFixed(0) : "—",
    status: v => v === null ? "neutral" : v < 50 ? "good" : v > 150 ? "bad" : "neutral", higherBetter: false },
  { label: "Beta", category: "Health", get: s => s.quote?.beta ?? null, format: v => num(v),
    status: v => v === null ? "neutral" : Math.abs(v - 1) < 0.3 ? "good" : v > 1.5 ? "bad" : "neutral" },
  { label: "Health Score", category: "Health", get: s => s.quote?.healthScore ?? null, format: v => v !== null ? String(Math.round(v)) : "—",
    status: v => v === null ? "neutral" : v > 70 ? "good" : v < 30 ? "bad" : "neutral", higherBetter: true },

  // Income
  { label: "Dividend Yield", category: "Income", get: s => s.quote?.dividendYield ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0.02 ? "good" : v === 0 ? "bad" : "neutral", higherBetter: true },
  { label: "Payout Ratio", category: "Income", get: s => s.quote?.payoutRatio ?? null, format: pct,
    status: v => v === null ? "neutral" : v > 0 && v < 0.6 ? "good" : v > 0.8 ? "bad" : "neutral" },

  // Size
  { label: "Market Cap", category: "Size", get: s => s.quote?.marketCap ?? null, format: fmtCap,
    status: () => "neutral" },
  { label: "Avg Volume", category: "Size", get: s => s.avgVolume, format: v => v !== null ? fmtCap(v).replace("$", "") : "—",
    status: () => "neutral" },
];

export function FundamentalsCompare({ stocks }: Props) {
  const categories = useMemo(() => {
    const cats = new Map<string, MetricDef[]>();
    METRICS.forEach(m => {
      if (!cats.has(m.category)) cats.set(m.category, []);
      cats.get(m.category)!.push(m);
    });
    return cats;
  }, []);

  // Find best value per metric for highlighting
  const bestPerMetric = useMemo(() => {
    const result: Record<string, string> = {};
    METRICS.forEach(m => {
      if (m.higherBetter === undefined) return;
      let bestSym = "";
      let bestVal = m.higherBetter ? -Infinity : Infinity;
      stocks.forEach(s => {
        const v = m.get(s);
        if (v === null) return;
        if (m.higherBetter && v > bestVal) { bestVal = v; bestSym = s.symbol; }
        if (!m.higherBetter && v < bestVal) { bestVal = v; bestSym = s.symbol; }
      });
      if (bestSym) result[m.label] = bestSym;
    });
    return result;
  }, [stocks]);

  return (
    <Card title="Comprehensive Fundamentals">
      <div className="cmp-fund-table-wrap">
        <table className="cmp-fund-table">
          <thead>
            <tr>
              <th>Metric</th>
              {stocks.map((s, i) => (
                <th key={s.symbol} style={{ color: COLORS[i % COLORS.length] }}>{s.symbol}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(categories.entries()).map(([cat, metrics]) => (
              <>
                <tr key={cat} className="cmp-fund-cat-row">
                  <td colSpan={stocks.length + 1}>{cat}</td>
                </tr>
                {metrics.map(m => (
                  <tr key={m.label}>
                    <td className="cmp-fund-label">{m.label}</td>
                    {stocks.map((s, si) => {
                      const v = m.get(s);
                      const st = m.status(v);
                      const isBest = bestPerMetric[m.label] === s.symbol;
                      return (
                        <td key={s.symbol} className={`cmp-fund-val cmp-fund-${st}`}>
                          <span className="cmp-fund-num">{m.format(v)}</span>
                          {v !== null && (
                            <span className="cmp-fund-bar-wrap">
                              <span className={`cmp-fund-bar cmp-fund-bar-${st}`}
                                style={{ width: `${Math.min(100, Math.max(5, Math.abs(v) < 1 ? Math.abs(v) * 100 : Math.min(Math.abs(v), 100)))}%` }} />
                            </span>
                          )}
                          {isBest && <span className="cmp-fund-best">★</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
