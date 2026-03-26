import { useState, useMemo, useCallback } from "react";
import { Filters } from "../components/screener/Filters";
import { StockTable } from "../components/screener/StockTable";
import { ScreenerStats } from "../components/screener/ScreenerStats";
import { Loading } from "../components/common/Loading";
import { ErrorMessage } from "../components/common/ErrorMessage";
import type { StockQuote, FilterParams } from "../types/stock";

interface Props {
  stocks: StockQuote[] | null;
  watchlist: string[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onToggleWatch: (symbol: string) => void;
  onSelectStock: (symbol: string) => void;
  onCompareStocks?: (symbols: string[]) => void;
  loadingMore?: boolean;
  loaded?: number;
  totalSymbols?: number;
  done?: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
}

const EMPTY_FILTERS: FilterParams = {};

export function Screener(props: Props) {
  const {
    stocks, watchlist, loading, error, onRetry, onToggleWatch, onSelectStock, onCompareStocks,
    loadingMore, loaded, totalSymbols, done, onLoadMore, onLoadAll,
  } = props;
  const [filters, setFilters] = useState<FilterParams>(EMPTY_FILTERS);

  const sectors = useMemo(() => {
    if (!stocks) return [];
    return [...new Set(stocks.map((s) => s.sector))].sort();
  }, [stocks]);

  const industries = useMemo(() => {
    if (!stocks) return [];
    if (filters.sector) {
      return [...new Set(stocks.filter(s => s.sector === filters.sector).map(s => s.industry))].sort();
    }
    return [...new Set(stocks.map((s) => s.industry))].sort();
  }, [stocks, filters.sector]);

  const filtered = useMemo(() => {
    if (!stocks) return [];
    let result = [...stocks];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry.toLowerCase().includes(q)
      );
    }
    if (filters.sector) result = result.filter((s) => s.sector === filters.sector);
    if (filters.industry) result = result.filter((s) => s.industry === filters.industry);
    if (filters.minDividendYield) {
      const min = parseFloat(filters.minDividendYield) / 100;
      result = result.filter((s) => (s.dividendYield ?? 0) >= min);
    }
    if (filters.maxPE) {
      const max = parseFloat(filters.maxPE);
      result = result.filter((s) => s.peRatio !== null && s.peRatio <= max);
    }
    if (filters.minHealthScore) {
      const min = parseFloat(filters.minHealthScore);
      result = result.filter((s) => (s.healthScore ?? 0) >= min);
    }
    if (filters.minMoS) {
      const min = parseFloat(filters.minMoS);
      result = result.filter((s) => (s.marginOfSafety ?? -999) >= min);
    }
    if (filters.maxBeta) {
      const max = parseFloat(filters.maxBeta);
      result = result.filter((s) => s.beta !== null && s.beta <= max);
    }
    if (filters.minMarketCap) {
      const min = parseFloat(filters.minMarketCap);
      result = result.filter((s) => s.marketCap >= min);
    }
    if (filters.sortBy) {
      const key = filters.sortBy as keyof StockQuote;
      // P/E sort should be ascending (low is better)
      if (key === "peRatio") {
        result.sort((a, b) => ((a[key] as number) ?? 999) - ((b[key] as number) ?? 999));
      } else {
        result.sort((a, b) => ((b[key] as number) ?? 0) - ((a[key] as number) ?? 0));
      }
    }
    return result;
  }, [stocks, filters]);

  const handleReset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  if (loading && !stocks) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;

  return (
    <div className="scr-page">
      <Filters
        filters={filters} sectors={sectors} industries={industries}
        onChange={setFilters} onReset={handleReset}
      />
      <ScreenerStats stocks={filtered} total={stocks?.length ?? 0} />
      <StockTable
        stocks={filtered} watchlist={watchlist}
        onToggleWatch={onToggleWatch} onSelectStock={onSelectStock}
        onCompareSelected={onCompareStocks}
      />
      {!done && totalSymbols && totalSymbols > 0 && (
        <div className="scr-load-more">
          <div className="scr-load-progress">
            <div className="scr-load-bar">
              <div
                className="scr-load-bar-fill"
                style={{ width: `${((loaded ?? 0) / totalSymbols) * 100}%` }}
              />
            </div>
            <span className="scr-load-text">
              Loaded {loaded ?? 0} of {totalSymbols} stocks
            </span>
          </div>
          <div className="scr-load-actions">
            <button
              className="scr-btn scr-btn-load"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load More"}
            </button>
            <button
              className="scr-btn scr-btn-load-all"
              onClick={onLoadAll}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load All"}
            </button>
          </div>
        </div>
      )}
      {done && totalSymbols && totalSymbols > 0 && (
        <div className="scr-load-done">
          ✓ All {totalSymbols} stocks loaded
        </div>
      )}
    </div>
  );
}
