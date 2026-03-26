import { WatchlistPanel } from "../components/watchlist/WatchlistPanel";
import { Loading } from "../components/common/Loading";
import { ErrorMessage } from "../components/common/ErrorMessage";
import type { WatchlistEntry } from "../api/watchlist";
import type { StockQuote } from "../types/stock";

interface Props {
  stocks: StockQuote[] | null;
  watchlist: string[];
  entries: WatchlistEntry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRemove: (sym: string) => void;
  onSelectStock: (sym: string) => void;
  onCompareStocks: (syms: string[]) => void;
  onRefresh: () => void;
}

export function WatchlistPage(props: Props) {
  const {
    stocks, watchlist, entries, loading, error,
    onRetry, onRemove, onSelectStock, onCompareStocks, onRefresh,
  } = props;

  if (loading && !stocks) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;

  return (
    <WatchlistPanel
      stocks={stocks ?? []}
      watchlist={watchlist}
      entries={entries}
      onRemove={onRemove}
      onSelectStock={onSelectStock}
      onCompareStocks={onCompareStocks}
      onRefresh={onRefresh}
    />
  );
}
