import { useState, useMemo } from "react";
import { Badge } from "../common/Badge";
import {
  Star, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutGrid, List, GitCompareArrows,
} from "lucide-react";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
  watchlist: string[];
  onToggleWatch: (symbol: string) => void;
  onSelectStock: (symbol: string) => void;
  onCompareSelected?: (symbols: string[]) => void;
}

function fmt(val: number | null, d = 2): string {
  return val !== null ? val.toFixed(d) : "N/A";
}

function fmtCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val}`;
}

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted">N/A</span>;
  const cls = score >= 70 ? "badge-green" : score >= 40 ? "badge-yellow" : "badge-red";
  return <span className={`health-badge ${cls}`}>{score}</span>;
}

/** 52-week position bar */
function WeekBar({ price, low, high }: { price: number; low: number; high: number }) {
  const range = high - low;
  const pct = range > 0 ? ((price - low) / range) * 100 : 50;
  return (
    <div className="scr-week-bar">
      <span className="scr-week-lo">{low.toFixed(0)}</span>
      <div className="scr-week-track">
        <div className="scr-week-fill" style={{ width: `${pct}%` }} />
        <div className="scr-week-dot" style={{ left: `${pct}%` }} />
      </div>
      <span className="scr-week-hi">{high.toFixed(0)}</span>
    </div>
  );
}

type SortKey = "symbol" | "price" | "changePercent" | "marketCap" | "peRatio" |
  "dividendYield" | "marginOfSafety" | "healthScore";

interface Column {
  key: SortKey;
  label: string;
  render: (s: StockQuote) => React.ReactNode;
}

export function StockTable({ stocks, watchlist, onToggleWatch, onSelectStock, onCompareSelected }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (sym: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === stocks.length) setSelected(new Set());
    else setSelected(new Set(stocks.map(s => s.symbol)));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return stocks;
    return [...stocks].sort((a, b) => {
      const av = (a[sortKey] as number) ?? (sortAsc ? Infinity : -Infinity);
      const bv = (b[sortKey] as number) ?? (sortAsc ? Infinity : -Infinity);
      return sortAsc ? av - bv : bv - av;
    });
  }, [stocks, sortKey, sortAsc]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={10} className="scr-sort-idle" />;
    return sortAsc ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  };

  if (stocks.length === 0) {
    return <p className="text-muted" style={{ padding: 20 }}>No stocks match your filters</p>;
  }

  const columns: Column[] = [
    { key: "symbol", label: "Symbol", render: s => (
      <><span className="font-bold">{s.symbol}</span><span className="text-muted text-sm block">{s.name}</span></>
    )},
    { key: "price", label: "Price", render: s => <span className="scr-mono">${s.price.toFixed(2)}</span> },
    { key: "changePercent", label: "Change", render: s => <Badge value={s.changePercent} type="change" /> },
    { key: "marketCap", label: "Mkt Cap", render: s => <span className="scr-mono">{fmtCap(s.marketCap)}</span> },
    { key: "peRatio", label: "P/E", render: s => <span className="scr-mono">{fmt(s.peRatio, 1)}</span> },
    { key: "dividendYield", label: "Div Yield", render: s => (
      s.dividendYield
        ? <span className="text-green scr-mono">{(s.dividendYield * 100).toFixed(2)}%</span>
        : <span className="text-muted">—</span>
    )},
    { key: "marginOfSafety", label: "MoS", render: s => <Badge value={s.marginOfSafety} type="margin" /> },
    { key: "healthScore", label: "Health", render: s => <HealthBadge score={s.healthScore} /> },
  ];

  return (
    <div className="scr-table-section">
      {/* Toolbar */}
      <div className="scr-toolbar">
        <div className="scr-toolbar-left">
          <span className="scr-result-count">{stocks.length} stocks</span>
          {selected.size > 0 && (
            <div className="scr-bulk-actions">
              <span className="scr-sel-count">{selected.size} selected</span>
              {onCompareSelected && selected.size >= 2 && (
                <button className="scr-bulk-btn" onClick={() => onCompareSelected(Array.from(selected))}>
                  <GitCompareArrows size={12} /> Compare
                </button>
              )}
              <button className="scr-bulk-btn" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
        </div>
        <div className="scr-toolbar-right">
          <button className={`scr-view-btn${view === "table" ? " scr-view-active" : ""}`}
            onClick={() => setView("table")}><List size={14} /></button>
          <button className={`scr-view-btn${view === "grid" ? " scr-view-active" : ""}`}
            onClick={() => setView("grid")}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {/* Table view */}
      {view === "table" && (
        <div className="table-wrapper">
          <table className="stock-table scr-enhanced-table">
            <thead>
              <tr>
                <th className="scr-th-check">
                  <input type="checkbox" checked={selected.size === stocks.length && stocks.length > 0}
                    onChange={toggleAll} />
                </th>
                <th></th>
                {columns.map(c => (
                  <th key={c.key} className="scr-th-sortable" onClick={() => handleSort(c.key)}>
                    {c.label} <SortIcon col={c.key} />
                  </th>
                ))}
                <th>52W Position</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.symbol} className={`clickable-row${selected.has(s.symbol) ? " scr-row-selected" : ""}`}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(s.symbol)}
                      onChange={() => toggleSelect(s.symbol)} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className={`watch-btn ${watchlist.includes(s.symbol) ? "watched" : ""}`}
                      onClick={() => onToggleWatch(s.symbol)}>
                      <Star size={14} />
                    </button>
                  </td>
                  {columns.map(c => (
                    <td key={c.key} onClick={() => onSelectStock(s.symbol)}>{c.render(s)}</td>
                  ))}
                  <td onClick={() => onSelectStock(s.symbol)}>
                    <WeekBar price={s.price} low={s.fiftyTwoWeekLow} high={s.fiftyTwoWeekHigh} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid / card view */}
      {view === "grid" && (
        <div className="scr-grid">
          {sorted.map((s) => {
            const isWatched = watchlist.includes(s.symbol);
            const isSel = selected.has(s.symbol);
            return (
              <div key={s.symbol} className={`scr-card${isSel ? " scr-card-selected" : ""}`}
                onClick={() => onSelectStock(s.symbol)}>
                <div className="scr-card-top">
                  <div className="scr-card-head">
                    <input type="checkbox" checked={isSel}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(s.symbol); }} />
                    <span className="scr-card-sym">{s.symbol}</span>
                    <Badge value={s.changePercent} type="change" />
                  </div>
                  <button className={`watch-btn ${isWatched ? "watched" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleWatch(s.symbol); }}>
                    <Star size={14} />
                  </button>
                </div>
                <span className="scr-card-name">{s.name}</span>
                <span className="scr-card-industry">{s.industry}</span>
                <div className="scr-card-price">${s.price.toFixed(2)}</div>
                <WeekBar price={s.price} low={s.fiftyTwoWeekLow} high={s.fiftyTwoWeekHigh} />
                <div className="scr-card-metrics">
                  <div className="scr-card-m">
                    <span>P/E</span><span className="scr-mono">{fmt(s.peRatio, 1)}</span>
                  </div>
                  <div className="scr-card-m">
                    <span>Div</span>
                    <span className="scr-mono text-green">{s.dividendYield ? `${(s.dividendYield * 100).toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="scr-card-m">
                    <span>MoS</span><Badge value={s.marginOfSafety} type="margin" />
                  </div>
                  <div className="scr-card-m">
                    <span>Health</span><HealthBadge score={s.healthScore} />
                  </div>
                  <div className="scr-card-m">
                    <span>Cap</span><span className="scr-mono">{fmtCap(s.marketCap)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
