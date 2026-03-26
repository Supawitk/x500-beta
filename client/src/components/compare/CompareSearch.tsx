import { useState, useEffect, useRef } from "react";
import { Search, Plus, X } from "lucide-react";
import { searchStocks, type SearchResult } from "../../api/analysis";

interface Props {
  symbols: string[];
  onAdd: (sym: string) => void;
  onRemove: (sym: string) => void;
  onCompare: () => void;
  loading: boolean;
}

export function CompareSearch({ symbols, onAdd, onRemove, onCompare, loading }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await searchStocks(query);
      setResults(r);
      setOpen(r.length > 0);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const select = (sym: string) => {
    onAdd(sym);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="compare-search-wrap">
      <div className="compare-search-bar">
        <div className="stock-search" style={{ flex: 1 }}>
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search stocks to compare (e.g. AAPL, Tesla, Microsoft...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
            />
          </div>
          {open && results.length > 0 && (
            <ul className="search-dropdown">
              {results.map((r) => (
                <li key={r.symbol} onMouseDown={() => select(r.symbol)}>
                  <Plus size={14} className="text-muted" />
                  <span className="font-bold">{r.symbol}</span>
                  <span className="text-muted">{r.name}</span>
                  <span className="text-sm text-muted">{r.exchange}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={onCompare}
          disabled={symbols.length < 2 || loading}
        >
          {loading ? "Loading..." : "Compare"}
        </button>
      </div>
      <div className="compare-chips">
        {symbols.map((s) => (
          <span key={s} className="symbol-chip">
            {s}
            <X size={12} onClick={() => onRemove(s)} style={{ cursor: "pointer" }} />
          </span>
        ))}
        {symbols.length < 2 && (
          <span className="text-muted text-sm">Add at least 2 stocks</span>
        )}
      </div>
    </div>
  );
}
