import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import type { CompareStock } from "../../api/compare";

interface Props {
  stocks: CompareStock[];
}

function pct(v: number | null): string {
  return v !== null ? `${(v * 100).toFixed(1)}%` : "N/A";
}

function fmtCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

export function CompareMetrics({ stocks }: Props) {
  const rows = [
    { label: "Price", fn: (s: CompareStock) => `$${s.quote?.price.toFixed(2)}` },
    { label: "Market Cap", fn: (s: CompareStock) => fmtCap(s.quote?.marketCap || 0) },
    { label: "Industry", fn: (s: CompareStock) => s.quote?.industry || "N/A" },
    { label: "P/E Ratio", fn: (s: CompareStock) => s.quote?.peRatio?.toFixed(1) ?? "N/A" },
    { label: "Forward P/E", fn: (s: CompareStock) => s.quote?.forwardPE?.toFixed(1) ?? "N/A" },
    { label: "Dividend Yield", fn: (s: CompareStock) => pct(s.quote?.dividendYield ?? null) },
    { label: "Health Score", fn: (s: CompareStock) => String(s.quote?.healthScore ?? "N/A") },
    { label: "Margin of Safety", fn: (s: CompareStock) => `${s.quote?.marginOfSafety?.toFixed(1) ?? "N/A"}%`, badge: true },
    { label: "Graham Number", fn: (s: CompareStock) => s.quote?.grahamNumber ? `$${s.quote.grahamNumber.toFixed(0)}` : "N/A" },
    { label: "Total Return", fn: (s: CompareStock) => `${s.totalReturn.toFixed(2)}%`, badge: true },
    { label: "Trend", fn: (s: CompareStock) => s.regression.trend },
    { label: "R²", fn: (s: CompareStock) => s.regression.rSquared.toFixed(4) },
    { label: "Market Correlation (R)", fn: (s: CompareStock) => s.marketCorrelation.toFixed(4) },
    { label: "Beta vs S&P 500", fn: (s: CompareStock) => s.marketBeta.toFixed(2) },
    { label: "Analyst Target", fn: (s: CompareStock) => s.detail?.analystTargetMean ? `$${s.detail.analystTargetMean.toFixed(0)}` : "N/A" },
    { label: "Analyst Rec", fn: (s: CompareStock) => s.detail?.recommendationKey?.toUpperCase() ?? "N/A" },
    { label: "Revenue Growth", fn: (s: CompareStock) => pct(s.detail?.revenueGrowth ?? null) },
    { label: "Profit Margin", fn: (s: CompareStock) => pct(s.detail?.profitMargins ?? null) },
    { label: "EV/EBITDA", fn: (s: CompareStock) => s.detail?.enterpriseToEbitda?.toFixed(1) ?? "N/A" },
    { label: "Short % Float", fn: (s: CompareStock) => pct(s.detail?.shortPercentOfFloat ?? null) },
    { label: "Institutional %", fn: (s: CompareStock) => pct(s.detail?.heldPercentInstitutions ?? null) },
    { label: "52W Range", fn: (s: CompareStock) => s.quote?.fiftyTwoWeekRange || "N/A" },
  ];

  return (
    <Card title="Full Comparison">
      <div className="table-wrapper">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Metric</th>
              {stocks.map((s) => <th key={s.symbol}>{s.symbol}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="font-bold">{r.label}</td>
                {stocks.map((s) => (
                  <td key={s.symbol}>
                    {r.badge ? <Badge value={parseFloat(r.fn(s))} type="margin" /> : r.fn(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
