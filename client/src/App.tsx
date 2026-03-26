import { useState, useCallback } from "react";
import { Header } from "./components/layout/Header";
import { TabNav } from "./components/layout/TabNav";
import { Dashboard } from "./pages/Dashboard";
import { Screener } from "./pages/Screener";
import { ComparePage } from "./pages/ComparePage";
import { AnalysisPage } from "./pages/AnalysisPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { PortfolioBuilder } from "./pages/PortfolioBuilder";
import { usePolling } from "./hooks/usePolling";
import { usePagedStocks } from "./hooks/usePagedStocks";
import { fetchTopValue, fetchTopDividend } from "./api/stocks";
import { fetchMarketSummary, fetchSectors } from "./api/market";
import {
  fetchWatchlist, addToWatchlist, removeFromWatchlist,
} from "./api/watchlist";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "analysis", label: "Analysis" },
  { id: "screener", label: "Screener" },
  { id: "compare", label: "Compare" },
  { id: "watchlist", label: "Watchlist" },
  { id: "portfolio", label: "Portfolio" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [analysisSymbol, setAnalysisSymbol] = useState("AAPL");
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);

  const stocks = usePagedStocks();
  const summary = usePolling(fetchMarketSummary, 30000);
  const sectors = usePolling(fetchSectors, 60000);
  const value = usePolling(fetchTopValue, 30000);
  const dividend = usePolling(fetchTopDividend, 30000);
  const wl = usePolling(fetchWatchlist, 10000);

  const watchlist = wl.data?.symbols ?? [];
  const entries = wl.data?.entries ?? [];

  const onSelectStock = useCallback((symbol: string) => {
    setAnalysisSymbol(symbol.toUpperCase());
    setTab("analysis");
  }, []);

  const onCompareStocks = useCallback((syms: string[]) => {
    setCompareSymbols(syms);
    setTab("compare");
  }, []);

  const toggleWatch = useCallback(async (symbol: string) => {
    if (watchlist.includes(symbol)) {
      await removeFromWatchlist(symbol);
    } else {
      await addToWatchlist(symbol);
    }
    wl.refetch();
  }, [watchlist, wl]);

  const handleRemove = useCallback(async (symbol: string) => {
    await removeFromWatchlist(symbol);
    wl.refetch();
  }, [wl]);

  return (
    <div className="app">
      <Header lastUpdated={summary.data?.lastUpdated} />
      <TabNav tabs={TABS} activeTab={tab} onTabChange={setTab} />
      <main className="main">
        <div key={tab} className="page-transition">
        {tab === "dashboard" && (
          <Dashboard
            summary={summary.data}
            sectors={sectors.data}
            stocks={stocks.data}
            valueStocks={value.data}
            dividendStocks={dividend.data}
            loading={stocks.loading}
            error={stocks.error}
            onRetry={stocks.refetch}
            onSelectStock={onSelectStock}
          />
        )}
        {tab === "analysis" && (
          <AnalysisPage
            initialSymbol={analysisSymbol}
            onSelectStock={onSelectStock}
          />
        )}
        {tab === "screener" && (
          <Screener
            stocks={stocks.data}
            watchlist={watchlist}
            loading={stocks.loading}
            error={stocks.error}
            onRetry={stocks.refetch}
            onToggleWatch={toggleWatch}
            onSelectStock={onSelectStock}
            onCompareStocks={onCompareStocks}
            loadingMore={stocks.loadingMore}
            loaded={stocks.loaded}
            totalSymbols={stocks.totalSymbols}
            done={stocks.done}
            onLoadMore={stocks.loadMore}
            onLoadAll={stocks.loadAll}
          />
        )}
        {tab === "compare" && (
          <ComparePage initialSymbols={compareSymbols} />
        )}
        {tab === "watchlist" && (
          <WatchlistPage
            stocks={stocks.data}
            watchlist={watchlist}
            entries={entries}
            loading={stocks.loading}
            error={stocks.error}
            onRetry={stocks.refetch}
            onRemove={handleRemove}
            onSelectStock={onSelectStock}
            onCompareStocks={onCompareStocks}
            onRefresh={wl.refetch}
          />
        )}
        {tab === "portfolio" && <PortfolioBuilder />}
        </div>
      </main>
    </div>
  );
}
