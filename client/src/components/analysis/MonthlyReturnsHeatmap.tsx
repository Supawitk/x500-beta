import { useMemo } from "react";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
}

interface MonthlyReturn {
  year: number;
  month: number;
  ret: number;
  monthLabel: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function computeMonthlyReturns(data: AnalysisDataPoint[]): {
  monthly: MonthlyReturn[];
  years: number[];
  avgByMonth: (number | null)[];
  yearlyTotals: Map<number, number>;
} {
  if (data.length < 2) return { monthly: [], years: [], avgByMonth: new Array(12).fill(null), yearlyTotals: new Map() };

  // Group by year-month, get first and last close per month
  const groups = new Map<string, { opens: number; closes: number; year: number; month: number }>();
  for (const d of data) {
    const [y, m] = d.date.split("-").map(Number);
    const key = `${y}-${m}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { opens: d.close, closes: d.close, year: y, month: m });
    } else {
      existing.closes = d.close;
    }
  }

  const monthly: MonthlyReturn[] = [];
  for (const [, g] of groups) {
    if (g.opens === 0) continue;
    monthly.push({
      year: g.year,
      month: g.month,
      ret: ((g.closes - g.opens) / g.opens) * 100,
      monthLabel: MONTHS[g.month - 1],
    });
  }

  const years = [...new Set(monthly.map(m => m.year))].sort();

  // Average per month
  const avgByMonth: (number | null)[] = [];
  for (let m = 1; m <= 12; m++) {
    const rets = monthly.filter(r => r.month === m);
    if (rets.length === 0) { avgByMonth.push(null); continue; }
    avgByMonth.push(rets.reduce((s, r) => s + r.ret, 0) / rets.length);
  }

  // Yearly totals
  const yearlyTotals = new Map<number, number>();
  for (const y of years) {
    const rets = monthly.filter(m => m.year === y);
    // Compound monthly returns
    let cum = 1;
    for (const r of rets.sort((a, b) => a.month - b.month)) {
      cum *= (1 + r.ret / 100);
    }
    yearlyTotals.set(y, (cum - 1) * 100);
  }

  return { monthly, years, avgByMonth, yearlyTotals };
}

function retColor(ret: number): string {
  if (ret > 8) return "#065f46";
  if (ret > 5) return "#059669";
  if (ret > 2) return "#34d399";
  if (ret > 0) return "#86efac";
  if (ret > -2) return "#fca5a5";
  if (ret > -5) return "#f87171";
  if (ret > -8) return "#dc2626";
  return "#991b1b";
}

function retBg(ret: number): string {
  if (ret > 8) return "#d1fae5";
  if (ret > 5) return "#ecfdf5";
  if (ret > 2) return "#f0fdf4";
  if (ret > 0) return "#f7fee7";
  if (ret > -2) return "#fef2f2";
  if (ret > -5) return "#fee2e2";
  if (ret > -8) return "#fecaca";
  return "#fca5a5";
}

export function MonthlyReturnsHeatmap({ data, symbol }: Props) {
  const { monthly, years, avgByMonth, yearlyTotals } = useMemo(() => computeMonthlyReturns(data), [data]);

  if (monthly.length === 0) return null;

  const getReturn = (year: number, month: number) => {
    return monthly.find(m => m.year === year && m.month === month);
  };

  // Stats
  const allRets = monthly.map(m => m.ret);
  const avgRet = allRets.reduce((a, b) => a + b, 0) / allRets.length;
  const posMonths = allRets.filter(r => r > 0).length;
  const bestMonth = monthly.reduce((a, b) => a.ret > b.ret ? a : b);
  const worstMonth = monthly.reduce((a, b) => a.ret < b.ret ? a : b);

  return (
    <Card title={`Monthly Returns Heatmap — ${symbol}`}>
      {/* Stats strip */}
      <div className="mh-stats">
        <div className="mh-stat">
          <span className="mh-stat-label">Avg Monthly</span>
          <span className="mh-stat-val" style={{ color: avgRet >= 0 ? "#059669" : "#dc2626" }}>
            {avgRet >= 0 ? "+" : ""}{avgRet.toFixed(2)}%
          </span>
        </div>
        <div className="mh-stat">
          <span className="mh-stat-label">Win Rate</span>
          <span className="mh-stat-val" style={{ color: "#059669" }}>
            {((posMonths / allRets.length) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="mh-stat">
          <span className="mh-stat-label">Best Month</span>
          <span className="mh-stat-val" style={{ color: "#059669" }}>
            +{bestMonth.ret.toFixed(1)}% <span className="mh-stat-sub">{MONTHS[bestMonth.month - 1]} {bestMonth.year}</span>
          </span>
        </div>
        <div className="mh-stat">
          <span className="mh-stat-label">Worst Month</span>
          <span className="mh-stat-val" style={{ color: "#dc2626" }}>
            {worstMonth.ret.toFixed(1)}% <span className="mh-stat-sub">{MONTHS[worstMonth.month - 1]} {worstMonth.year}</span>
          </span>
        </div>
      </div>

      {/* Heatmap table */}
      <div className="mh-table-wrap">
        <table className="mh-table">
          <thead>
            <tr>
              <th className="mh-th">Year</th>
              {MONTHS.map(m => <th key={m} className="mh-th">{m}</th>)}
              <th className="mh-th mh-th-total">Year</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => (
              <tr key={year}>
                <td className="mh-year">{year}</td>
                {MONTHS.map((_, mi) => {
                  const r = getReturn(year, mi + 1);
                  if (!r) return <td key={mi} className="mh-cell mh-cell-empty">—</td>;
                  return (
                    <td key={mi} className="mh-cell"
                      style={{ color: retColor(r.ret), background: retBg(r.ret) }}
                      title={`${MONTHS[mi]} ${year}: ${r.ret >= 0 ? "+" : ""}${r.ret.toFixed(2)}%`}
                    >
                      {r.ret >= 0 ? "+" : ""}{r.ret.toFixed(1)}
                    </td>
                  );
                })}
                <td className="mh-cell mh-cell-total" style={{
                  color: (yearlyTotals.get(year) ?? 0) >= 0 ? "#059669" : "#dc2626",
                  fontWeight: 700,
                }}>
                  {(yearlyTotals.get(year) ?? 0) >= 0 ? "+" : ""}
                  {(yearlyTotals.get(year) ?? 0).toFixed(1)}%
                </td>
              </tr>
            ))}
            {/* Average row */}
            <tr className="mh-avg-row">
              <td className="mh-year" style={{ fontWeight: 700 }}>Avg</td>
              {avgByMonth.map((avg, i) => (
                <td key={i} className="mh-cell"
                  style={avg != null ? { color: retColor(avg), background: retBg(avg), fontWeight: 600 } : undefined}
                >
                  {avg != null ? `${avg >= 0 ? "+" : ""}${avg.toFixed(1)}` : "—"}
                </td>
              ))}
              <td className="mh-cell mh-cell-total" style={{
                color: avgRet >= 0 ? "#059669" : "#dc2626",
                fontWeight: 700,
              }}>
                {avgRet >= 0 ? "+" : ""}{(avgRet * 12).toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Seasonality bar */}
      <div className="mh-season">
        <div className="mh-season-title">Seasonality (Avg Monthly Returns)</div>
        <div className="mh-season-bars">
          {avgByMonth.map((avg, i) => {
            if (avg == null) return <div key={i} className="mh-bar-col"><span className="mh-bar-label">{MONTHS[i]}</span></div>;
            const maxAbs = Math.max(...avgByMonth.filter(v => v != null).map(v => Math.abs(v!)), 1);
            const height = Math.abs(avg) / maxAbs * 50;
            return (
              <div key={i} className="mh-bar-col">
                <div className="mh-bar-val" style={{ color: avg >= 0 ? "#059669" : "#dc2626" }}>
                  {avg >= 0 ? "+" : ""}{avg.toFixed(1)}%
                </div>
                <div className="mh-bar-track">
                  <div className="mh-bar-fill" style={{
                    height: `${height}px`,
                    background: avg >= 0 ? "#34d399" : "#f87171",
                    [avg >= 0 ? "bottom" : "top"]: "50%",
                  }} />
                  <div className="mh-bar-zero" />
                </div>
                <span className="mh-bar-label">{MONTHS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
