import { useState } from "react";
import { Card } from "../common/Card";
import { ChevronDown, ChevronUp, Building2, TrendingUp, TrendingDown } from "lucide-react";
import type { SectorPerformance, SectorIndustryGroup } from "../../types/stock";

interface Props {
  sectorPerformance: SectorPerformance[];
  onSelectStock: (symbol: string) => void;
}

function heatColor(change: number): string {
  if (change > 2) return "#059669";
  if (change > 1) return "#34d399";
  if (change > 0.2) return "#6ee7b7";
  if (change > -0.2) return "#e5e7eb";
  if (change > -1) return "#fca5a5";
  if (change > -2) return "#f87171";
  return "#dc2626";
}

function textColor(change: number): string {
  return Math.abs(change) > 0.5 ? "#fff" : "#1f2937";
}

function fmtCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}B`;
  return `$${(cap / 1e6).toFixed(0)}M`;
}

function IndustryGroup({
  group, onSelectStock,
}: { group: SectorIndustryGroup; onSelectStock: (s: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="industry-group">
      <div className="industry-header" onClick={() => setOpen(!open)}>
        <div className="industry-header-left">
          <Building2 size={13} style={{ color: "#6b7280", flexShrink: 0 }} />
          <span className="industry-name">{group.industry}</span>
          <span className="industry-count">{group.count}</span>
        </div>
        <div className="industry-header-right">
          <span className="industry-avg-price">${group.avgPrice.toFixed(0)}</span>
          <span className="industry-mktcap text-muted">{fmtCap(group.totalMarketCap)}</span>
          <span className={`industry-change ${group.avgChange >= 0 ? "text-green" : "text-red"}`}>
            {group.avgChange >= 0 ? "+" : ""}{group.avgChange.toFixed(2)}%
          </span>
          <div className="industry-leaders">
            <span className="industry-top text-green" title={`Best: ${group.topStock.symbol}`}>
              ↑{group.topStock.symbol}
            </span>
            <span className="industry-bottom text-red" title={`Worst: ${group.bottomStock.symbol}`}>
              ↓{group.bottomStock.symbol}
            </span>
          </div>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} style={{ opacity: 0.5 }} />}
        </div>
      </div>

      {open && (
        <div className="industry-stocks fade-in">
          <div className="industry-stocks-head">
            <span>Symbol</span><span>Name</span><span>Price</span>
            <span>Change</span><span>Mkt Cap</span><span>P/E</span><span>Div%</span>
          </div>
          {group.stocks.map((st) => (
            <div key={st.symbol} className="industry-stock-row clickable"
              onClick={() => onSelectStock(st.symbol)}>
              <span className="pick-symbol">{st.symbol}</span>
              <span className="stock-name-col">{st.name}</span>
              <span className="pick-price">${st.price.toFixed(2)}</span>
              <span className={st.changePercent >= 0 ? "text-green" : "text-red"}>
                {st.changePercent >= 0 ? "+" : ""}{st.changePercent.toFixed(2)}%
              </span>
              <span className="text-muted">{fmtCap(st.marketCap)}</span>
              <span className="text-muted">{st.peRatio != null ? st.peRatio.toFixed(1) : "—"}</span>
              <span className="text-muted">
                {st.dividendYield != null && st.dividendYield > 0
                  ? `${(st.dividendYield * 100).toFixed(2)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectorHeatmap({ sectorPerformance, onSelectStock }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalLoaded = sectorPerformance.reduce((a, s) => a + s.count, 0);
  const totalFull = sectorPerformance.reduce((a, s) => a + (s.totalCount ?? s.count), 0);

  return (
    <Card title={`Sector Performance (${totalLoaded}/${totalFull} S&P 500) — click to explore`}>
      <div className="heatmap-grid">
        {sectorPerformance.map((s) => {
          const tc = s.totalCount ?? s.count;
          return (
            <div
              key={s.sector}
              className={`heatmap-cell ${expanded === s.sector ? "heatmap-active" : ""}`}
              style={{ background: heatColor(s.avgChange), color: textColor(s.avgChange) }}
              onClick={() => setExpanded(expanded === s.sector ? null : s.sector)}
            >
              <span className="heatmap-sector">{s.sector}</span>
              <span className="heatmap-change">
                {s.avgChange > 0 ? "+" : ""}{s.avgChange.toFixed(2)}%
              </span>
              <span className="heatmap-count">
                {s.count === tc ? `${s.count} stocks` : `${s.count}/${tc} stocks`}
              </span>
              <span className="heatmap-minmax" style={{ fontSize: 10 }}>
                {(s.advancers ?? 0)}↑ {(s.decliners ?? 0)}↓
              </span>
              {expanded === s.sector
                ? <ChevronUp size={14} />
                : <ChevronDown size={14} style={{ opacity: 0.6 }} />}
            </div>
          );
        })}
      </div>

      {expanded && (() => {
        const sector = sectorPerformance.find((s) => s.sector === expanded);
        if (!sector) return null;
        const tc = sector.totalCount ?? sector.count;

        return (
          <div className="sector-detail fade-in">
            <div className="sector-detail-header">
              <div>
                <span className="font-bold" style={{ fontSize: 16 }}>{sector.sector}</span>
                <span className="text-muted" style={{ marginLeft: 12 }}>
                  {sector.count === tc ? `${sector.count} stocks` : `${sector.count}/${tc} stocks`}
                  {" | "}Avg {sector.avgChange > 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%
                  {" | "}{fmtCap(sector.totalMarketCap ?? 0)} total mkt cap
                  {" | "}Avg ${(sector.avgPrice ?? 0).toFixed(0)}
                </span>
              </div>
              <div className="sector-breadth">
                <span className="text-green">
                  <TrendingUp size={13} style={{ verticalAlign: "middle" }} />
                  {" "}{sector.advancers ?? 0} up
                </span>
                <span className="text-red" style={{ marginLeft: 10 }}>
                  <TrendingDown size={13} style={{ verticalAlign: "middle" }} />
                  {" "}{sector.decliners ?? 0} down
                </span>
              </div>
            </div>

            <div className="sector-ind-count text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {(sector.industries ?? []).length} sub-industries
            </div>

            <div className="industry-list">
              {(sector.industries ?? []).map((ind) => (
                <IndustryGroup key={ind.industry} group={ind} onSelectStock={onSelectStock} />
              ))}
            </div>
          </div>
        );
      })()}
    </Card>
  );
}
