import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { searchStocks, type SearchResult } from "../../api/analysis";

interface Props {
  onSelect: (symbol: string) => void;
  currentSymbol: string;
}

export function StockSearch({ onSelect, currentSymbol }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await searchStocks(query);
      setResults(r);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const select = (sym: string) => {
    onSelect(sym);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="stock-search">
      <div className="search-input-wrap">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search any stock (e.g. AAPL, Tesla...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        <span className="current-symbol">{currentSymbol}</span>
      </div>
      {open && results.length > 0 && (
        <ul className="search-dropdown">
          {results.map((r) => (
            <li key={r.symbol} onMouseDown={() => select(r.symbol)}>
              <span className="font-bold">{r.symbol}</span>
              <span className="text-muted">{r.name}</span>
              <span className="text-sm text-muted">{r.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
