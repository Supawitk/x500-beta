import { useState } from "react";
import { Card } from "../common/Card";
import { Search } from "lucide-react";
import type { IndustrySummary } from "../../types/stock";

interface Props {
  industries: IndustrySummary[];
}

export function IndustryBreakdown({ industries }: Props) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? industries.filter((i) =>
        i.industry.toLowerCase().includes(search.toLowerCase()) ||
        i.sector.toLowerCase().includes(search.toLowerCase())
      )
    : industries;

  return (
    <Card title="Industry Breakdown" className="industry-card">
      <div className="filter-group" style={{ marginBottom: 12 }}>
        <Search size={14} />
        <input
          type="text"
          placeholder="Search industries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="industry-search"
        />
      </div>
      <div className="industry-list">
        {filtered.map((ind) => (
          <div key={ind.industry} className="industry-row">
            <div className="industry-info">
              <span className="industry-name">{ind.industry}</span>
              <span className="industry-sector">{ind.sector}</span>
            </div>
            <div className="industry-metrics">
              <span className="industry-metric">
                <span className="metric-label">Stocks</span>
                {ind.count}
              </span>
              <span className="industry-metric">
                <span className="metric-label">Avg P/E</span>
                {ind.avgPE?.toFixed(1) ?? "N/A"}
              </span>
              <span className="industry-metric">
                <span className="metric-label">Avg Yield</span>
                {ind.avgDividendYield
                  ? `${(ind.avgDividendYield * 100).toFixed(2)}%`
                  : "N/A"}
              </span>
              <span className="industry-metric">
                <span className="metric-label">Margin</span>
                <span className={
                  (ind.avgMarginOfSafety ?? 0) > 0 ? "text-green" : "text-red"
                }>
                  {ind.avgMarginOfSafety?.toFixed(1) ?? "N/A"}%
                </span>
              </span>
            </div>
            <div className="industry-symbols">
              {ind.symbols.map((s) => (
                <span key={s} className="symbol-chip">{s}</span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted">No industries match your search</p>
        )}
      </div>
    </Card>
  );
}
