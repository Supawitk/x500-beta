import { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { Loading } from "../common/Loading";
import { fetchStockCorrelation, type StockCorrelation } from "../../api/correlation";

interface Props {
  symbol: string;
}

function cellColor(r: number): string {
  if (r >= 0.7) return "#059669";
  if (r >= 0.4) return "#34d399";
  if (r >= 0.1) return "#a7f3d0";
  if (r >= -0.1) return "#f3f4f6";
  if (r >= -0.4) return "#fca5a5";
  if (r >= -0.7) return "#f87171";
  return "#dc2626";
}

function cellText(r: number): string {
  return Math.abs(r) > 0.3 ? "#fff" : "#1f2937";
}

function pct(v: number): string { return `${(v * 100).toFixed(2)}%`; }

export function StockCorrelationPanel({ symbol }: Props) {
  const [data, setData] = useState<StockCorrelation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchStockCorrelation(symbol)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return <Loading message={`Computing ${symbol} correlations...`} />;
  if (!data) return null;

  const { benchmarkCorrelations: bc, parameterMatrix: pm, stats } = data;

  // Sort benchmarks: SPY first, then by absolute correlation
  const benchEntries = Object.entries(bc).sort((a, b) => {
    if (a[0] === "S&P 500") return -1;
    if (b[0] === "S&P 500") return 1;
    return Math.abs(b[1].returns_corr) - Math.abs(a[1].returns_corr);
  });

  return (
    <div className="stock-corr-section">
      <Card title={`${symbol} vs Market — Correlation Analysis`}>
        <div className="risk-grid" style={{ marginBottom: 14 }}>
          <Stat label="Total Return (6mo)" value={pct(stats.totalReturn)} cls={stats.totalReturn >= 0 ? "text-green" : "text-red"} />
          <Stat label="Ann. Volatility" value={pct(stats.annualizedVol)} />
          <Stat label="Reg. Slope" value={stats.regressionSlope.toFixed(4)} />
          <Stat label="Reg. R²" value={stats.regressionR2.toFixed(4)} />
          <Stat label="Avg Daily Return" value={pct(stats.avgDailyReturn)} />
        </div>

        <h4 className="mc-title">{symbol} Returns vs Market & Sectors</h4>
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Benchmark</th>
                <th>ETF</th>
                <th>Returns R</th>
                <th>Interpretation</th>
                <th>Beta</th>
              </tr>
            </thead>
            <tbody>
              {benchEntries.slice(0, 8).map(([name, v]) => (
                <tr key={name}>
                  <td className="font-bold">{name}</td>
                  <td className="text-muted">{v.etf}</td>
                  <td style={{
                    background: cellColor(v.returns_corr),
                    color: cellText(v.returns_corr),
                    fontWeight: 600, fontFamily: "var(--mono)", textAlign: "center",
                  }}>
                    {v.returns_corr.toFixed(4)}
                  </td>
                  <td className="text-sm">
                    {v.returns_corr > 0.7 ? "Strongly correlated"
                      : v.returns_corr > 0.4 ? "Moderately correlated"
                      : v.returns_corr > 0.1 ? "Weakly correlated"
                      : v.returns_corr > -0.1 ? "Uncorrelated"
                      : v.returns_corr > -0.4 ? "Weak inverse"
                      : "Strong inverse"}
                  </td>
                  <td style={{ fontFamily: "var(--mono)" }}>
                    {v.beta.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`${symbol} Internal Parameter Correlations`}>
        <p className="text-muted text-sm" style={{ marginBottom: 10 }}>
          How this stock's price, daily returns, volume, and volatility relate to each other.
        </p>
        <div className="corr-matrix-wrap">
          <table className="corr-matrix">
            <thead>
              <tr>
                <th></th>
                {pm.params.map((p) => <th key={p} className="corr-header">{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {pm.params.map((row) => (
                <tr key={row}>
                  <td className="corr-row-label">{row}</td>
                  {pm.params.map((col) => {
                    const r = pm.matrix[row]?.[col] ?? 0;
                    return (
                      <td key={col} className="corr-cell"
                        style={{ background: cellColor(r), color: cellText(r) }}
                        title={`${row} vs ${col}: ${r.toFixed(4)}`}>
                        {r === 1 ? "" : r.toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="param-interp" style={{ marginTop: 10 }}>
          {interpretParams(pm.matrix)}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="risk-metric">
      <span className="metric-label">{label}</span>
      <span className={`risk-value ${cls || ""}`}>{value}</span>
    </div>
  );
}

function interpretParams(matrix: Record<string, Record<string, number>>) {
  const insights: string[] = [];
  const pv = matrix["Price"]?.["Volume"];
  const rv = matrix["Returns"]?.["Volume"];
  const vr = matrix["Volatility"]?.["Returns"];

  if (pv !== undefined) {
    if (pv > 0.3) insights.push("Price and volume move together — volume confirms price moves.");
    else if (pv < -0.3) insights.push("Price drops tend to come with higher volume — selling pressure pattern.");
    else insights.push("Price and volume are largely independent.");
  }
  if (rv !== undefined) {
    if (rv > 0.2) insights.push("Positive returns correlate with higher volume — bullish volume pattern.");
    else if (rv < -0.2) insights.push("Negative returns come with higher volume — bearish volume pattern.");
  }
  if (vr !== undefined) {
    if (vr < -0.2) insights.push("Higher volatility tends to accompany negative returns — typical fear pattern.");
    else if (vr > 0.2) insights.push("Volatility rises with positive returns — unusual, momentum-driven.");
  }

  if (insights.length === 0) insights.push("No strong internal parameter relationships detected.");

  return (
    <div className="text-sm text-muted">
      {insights.map((t, i) => <p key={i} style={{ marginBottom: 4 }}>{t}</p>)}
    </div>
  );
}
