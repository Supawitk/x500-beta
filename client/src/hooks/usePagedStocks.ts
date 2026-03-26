import { useState, useCallback, useEffect, useRef } from "react";
import { fetchStockPage } from "../api/stocks";
import type { StockQuote } from "../types/stock";

interface PagedStocksState {
  data: StockQuote[] | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  totalSymbols: number;
  loaded: number;
  done: boolean;
  loadMore: () => void;
  loadAll: () => void;
  refetch: () => void;
}

export function usePagedStocks(): PagedStocksState {
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSymbols, setTotalSymbols] = useState(0);
  const loadingRef = useRef(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval>>();

  const fetchPage = useCallback(async (p: number, isFirst: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (isFirst) setLoading(true); else setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchStockPage(p);
      setTotalPages(result.totalPages);
      setTotalSymbols(result.totalSymbols);

      if (isFirst) {
        setStocks(result.stocks);
      } else {
        setStocks(prev => {
          // Merge, avoiding duplicates
          const existing = new Set(prev.map(s => s.symbol));
          const newOnes = result.stocks.filter(s => !existing.has(s.symbol));
          return [...prev, ...newOnes];
        });
      }
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stocks");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, []);

  // Load first page on mount
  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  // Auto-refresh loaded data every 60s
  useEffect(() => {
    autoRefreshRef.current = setInterval(async () => {
      if (loadingRef.current) return;
      // Silently refresh all loaded pages
      const all: StockQuote[] = [];
      for (let p = 0; p <= page; p++) {
        try {
          const result = await fetchStockPage(p);
          all.push(...result.stocks);
        } catch { break; }
      }
      if (all.length > 0) setStocks(all);
    }, 60_000);
    return () => clearInterval(autoRefreshRef.current);
  }, [page]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    if (next < totalPages) fetchPage(next, false);
  }, [page, totalPages, fetchPage]);

  const loadAll = useCallback(async () => {
    if (loadingRef.current) return;
    setLoadingMore(true);
    loadingRef.current = true;

    const all: StockQuote[] = [...stocks];
    const existing = new Set(all.map(s => s.symbol));

    for (let p = page + 1; p < totalPages; p++) {
      try {
        const result = await fetchStockPage(p);
        const newOnes = result.stocks.filter(s => !existing.has(s.symbol));
        all.push(...newOnes);
        newOnes.forEach(s => existing.add(s.symbol));
        setStocks([...all]);
        setPage(p);
      } catch { break; }
    }

    setLoadingMore(false);
    loadingRef.current = false;
  }, [stocks, page, totalPages]);

  const refetch = useCallback(() => {
    setStocks([]);
    setPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  return {
    data: stocks.length > 0 ? stocks : loading ? null : [],
    loading,
    loadingMore,
    error,
    page,
    totalPages,
    totalSymbols,
    loaded: stocks.length,
    done: page >= totalPages - 1,
    loadMore,
    loadAll,
    refetch,
  };
}
