import { useState, useMemo, useCallback } from "react";
import { Star } from "lucide-react";
import { Card } from "../common/Card";
import { WatchlistSummary } from "./WatchlistSummary";
import { WatchlistToolbar, type SortKey, type ViewMode } from "./WatchlistToolbar";
import { WatchlistCard } from "./WatchlistCard";
import type { WatchlistEntry } from "../../api/watchlist";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
  watchlist: string[];
  entries: WatchlistEntry[];
  onRemove: (sym: string) => void;
  onSelectStock: (sym: string) => void;
  onCompareStocks: (syms: string[]) => void;
  onRefresh: () => void;
}

export function WatchlistPanel(props: Props) {
  const { stocks, watchlist, entries, onRemove, onSelectStock, onCompareStocks, onRefresh } = props;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("changePercent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const watched = useMemo(() => {
    let list = stocks.filter((s) => watchlist.includes(s.symbol));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = (a[sortBy] as number) ?? 0;
      const bv = (b[sortBy] as number) ?? 0;
      return bv - av;
    });
    return list;
  }, [stocks, watchlist, search, sortBy]);

  const toggleSelect = useCallback((sym: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  }, []);

  const entryMap = useMemo(() => {
    const m = new Map<string, WatchlistEntry>();
    entries.forEach((e) => m.set(e.symbol, e));
    return m;
  }, [entries]);

  if (watchlist.length === 0) {
    return (
      <Card className="empty-state">
        <Star size={32} />
        <p>No stocks in your watchlist yet.</p>
        <p className="text-muted">Use the star icon in the Screener tab to add stocks.</p>
      </Card>
    );
  }

  // Group by sector view
  const sectors = useMemo(() => {
    const map = new Map<string, StockQuote[]>();
    watched.forEach((s) => {
      const arr = map.get(s.sector) || [];
      arr.push(s);
      map.set(s.sector, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [watched]);

  return (
    <div className="wl-page">
      <WatchlistSummary stocks={watched} />
      <WatchlistToolbar
        search={search} onSearch={setSearch}
        sortBy={sortBy} onSort={setSortBy}
        viewMode={viewMode} onViewMode={setViewMode}
        selectedCount={selected.size}
        onCompareSelected={() => onCompareStocks(Array.from(selected))}
      />
      {viewMode === "grid" ? (
        <div className="wl-grid">
          {watched.map((s) => (
            <WatchlistCard
              key={s.symbol} stock={s}
              entry={entryMap.get(s.symbol)}
              selected={selected.has(s.symbol)}
              onSelect={toggleSelect}
              onRemove={onRemove}
              onSelectStock={onSelectStock}
              onEntryUpdate={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="wl-sectors">
          {sectors.map(([sector, list]) => (
            <div key={sector} className="wl-sector-group">
              <h3 className="wl-sector-title">{sector} ({list.length})</h3>
              <div className="wl-grid">
                {list.map((s) => (
                  <WatchlistCard
                    key={s.symbol} stock={s}
                    entry={entryMap.get(s.symbol)}
                    selected={selected.has(s.symbol)}
                    onSelect={toggleSelect}
                    onRemove={onRemove}
                    onSelectStock={onSelectStock}
                    onEntryUpdate={onRefresh}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {watched.length === 0 && search && (
        <p className="text-muted" style={{ textAlign: "center", padding: 20 }}>
          No stocks match "{search}"
        </p>
      )}
    </div>
  );
}
