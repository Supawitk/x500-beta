import { MarketIndices } from "../components/dashboard/MarketIndices";
import { MarketSummary } from "../components/dashboard/MarketSummary";
import { MarketBreadth } from "../components/dashboard/MarketBreadth";
import { TodayMovers } from "../components/dashboard/TodayMovers";
import { SectorHeatmap } from "../components/dashboard/SectorHeatmap";
import { ChangeDistribution } from "../components/dashboard/ChangeDistribution";
import { PriceRange52W } from "../components/dashboard/PriceRange52W";
import { SectorCharts } from "../components/dashboard/SectorCharts";
import { ValueScatter } from "../components/dashboard/ValueScatter";
import { MarketCorrelation } from "../components/dashboard/MarketCorrelation";
import { TopPicks } from "../components/dashboard/TopPicks";
import { HealthLeaders } from "../components/dashboard/HealthLeaders";
import { Loading } from "../components/common/Loading";
import { ErrorMessage } from "../components/common/ErrorMessage";
import type {
  MarketSummary as MSType, SectorSummary, StockQuote,
} from "../types/stock";

interface Props {
  summary: MSType | null;
  sectors: SectorSummary[] | null;
  stocks: StockQuote[] | null;
  valueStocks: StockQuote[] | null;
  dividendStocks: StockQuote[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectStock: (symbol: string) => void;
}

export function Dashboard(props: Props) {
  const {
    summary, sectors, stocks, valueStocks, dividendStocks,
    loading, error, onRetry, onSelectStock,
  } = props;

  if (loading && !summary) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;

  return (
    <div className="dashboard">
      {summary && summary.indices.length > 0 && (
        <MarketIndices indices={summary.indices} />
      )}
      {summary && <MarketSummary summary={summary} onSelectStock={onSelectStock} />}
      {summary && <MarketBreadth summary={summary} />}
      {summary && summary.sectorPerformance.length > 0 && (
        <SectorHeatmap
          sectorPerformance={summary.sectorPerformance}
          onSelectStock={onSelectStock}
        />
      )}
      {summary && (
        <TodayMovers
          gainers={summary.gainers}
          losers={summary.losers}
          mostActive={summary.mostActive}
          onSelectStock={onSelectStock}
        />
      )}
      {stocks && stocks.length > 0 && <ChangeDistribution stocks={stocks} />}
      {stocks && stocks.length > 0 && (
        <PriceRange52W stocks={stocks} onSelectStock={onSelectStock} />
      )}
      {sectors && sectors.length > 0 && (
        <SectorCharts
          sectors={sectors}
          sectorPerformance={summary?.sectorPerformance ?? []}
          onSelectStock={onSelectStock}
        />
      )}
      {stocks && stocks.length > 0 && (
        <ValueScatter stocks={stocks} onSelectStock={onSelectStock} />
      )}
      <MarketCorrelation />
      {valueStocks && dividendStocks && (
        <TopPicks
          valueStocks={valueStocks}
          dividendStocks={dividendStocks}
          onSelectStock={onSelectStock}
        />
      )}
      {stocks && stocks.length > 0 && (
        <HealthLeaders stocks={stocks} onSelectStock={onSelectStock} />
      )}
    </div>
  );
}
