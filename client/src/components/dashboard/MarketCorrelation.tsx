import { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { fetchSectorCorrelations, type CorrelationMatrix } from "../../api/correlation";

function cellColor(r: number): string {
  if (r >= 0.8) return "#059669";
  if (r >= 0.5) return "#34d399";
  if (r >= 0.2) return "#a7f3d0";
  if (r >= -0.2) return "#f3f4f6";
  if (r >= -0.5) return "#fca5a5";
  if (r >= -0.8) return "#f87171";
  return "#dc2626";
}

function cellText(r: number): string {
  return Math.abs(r) > 0.3 ? "#fff" : "#1f2937";
}

export function MarketCorrelation() {
  const [data, setData] = useState<CorrelationMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSectorCorrelations()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card title="Sector Correlation Matrix"><p className="text-muted">Computing correlations...</p></Card>;
  if (!data) return null;

  const { sectors, matrix } = data;

  return (
    <Card title="Sector Correlation Matrix (6-Month Daily Returns)">
      <div className="corr-matrix-wrap">
        <table className="corr-matrix">
          <thead>
            <tr>
              <th></th>
              {sectors.map((s) => (
                <th key={s} className="corr-header">{shortSector(s)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.map((row) => (
              <tr key={row}>
                <td className="corr-row-label">{shortSector(row)}</td>
                {sectors.map((col) => {
                  const r = matrix[row]?.[col] ?? 0;
                  return (
                    <td
                      key={col}
                      className="corr-cell"
                      style={{ background: cellColor(r), color: cellText(r) }}
                      title={`${row} vs ${col}: ${r.toFixed(4)}`}
                    >
                      {r === 1 ? "" : r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="corr-legend-bar">
        <span className="text-sm">-1.0</span>
        <div className="corr-gradient" />
        <span className="text-sm">+1.0</span>
        <span className="text-muted text-sm" style={{ marginLeft: 12 }}>
          High R = move together | Low R = diversification
        </span>
      </div>
    </Card>
  );
}

function shortSector(s: string): string {
  const map: Record<string, string> = {
    "Technology": "Tech", "Healthcare": "Health", "Financial Services": "Finance",
    "Consumer Cyclical": "Cyclical", "Consumer Defensive": "Defensive",
    "Energy": "Energy", "Industrials": "Indust.", "Utilities": "Util.",
    "Real Estate": "RE", "Communication Services": "Comm.", "Basic Materials": "Mater.",
    "S&P 500": "S&P",
  };
  return map[s] || s.slice(0, 6);
}
