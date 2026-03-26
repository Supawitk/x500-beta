import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { StockSearch } from "../components/analysis/StockSearch";
import { PeriodSelector } from "../components/analysis/PeriodSelector";
import { TimeSlider } from "../components/analysis/TimeSlider";
import { CandlestickChart, type NewsMarker } from "../components/analysis/CandlestickChart";
import { CombinedChart } from "../components/analysis/CombinedChart";
import { IchimokuChart } from "../components/analysis/IchimokuChart";
import { WeightedSignalPanel } from "../components/analysis/WeightedSignalPanel";
import { StockInfoHeader } from "../components/analysis/StockInfoHeader";
import { SupportResistancePanel } from "../components/analysis/SupportResistancePanel";
import { RiskMetricsPanel } from "../components/analysis/RiskMetricsPanel";
import { RelativePerformancePanel } from "../components/analysis/RelativePerformancePanel";
import { MonthlyReturnsHeatmap } from "../components/analysis/MonthlyReturnsHeatmap";
import { EnhancedAnalystPanel } from "../components/analysis/EnhancedAnalystPanel";
import { FinancialsPanel } from "../components/analysis/FinancialsPanel";
import { EarningsDividendPanel } from "../components/analysis/EarningsDividendPanel";
import { StockNewsPanel } from "../components/analysis/StockNewsPanel";
import { TrendingStocks } from "../components/analysis/TrendingStocks";
import { StockCorrelationPanel } from "../components/analysis/StockCorrelationPanel";
import { PredictionLoader } from "../components/prediction/PredictionLoader";
import { Loading } from "../components/common/Loading";
import { ErrorMessage } from "../components/common/ErrorMessage";
import {
  fetchAnalysis, fetchTrending, fetchHistoryRange,
  type AnalysisResult, type AnalysisDataPoint, type TrendingData,
} from "../api/analysis";

interface Props {
  initialSymbol: string;
  onSelectStock: (symbol: string) => void;
}

export function AnalysisPage({ initialSymbol, onSelectStock }: Props) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [period, setPeriod] = useState("6mo");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 0]);
  const [newsMarkers, setNewsMarkers] = useState<NewsMarker[]>([]);

  // Extra historical data prepended via infinite scroll
  const [extraData, setExtraData] = useState<AnalysisDataPoint[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const earliestDateRef = useRef<string | null>(null);

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExtraData([]);
    earliestDateRef.current = null;
    try {
      const data = await fetchAnalysis(symbol, period);
      setAnalysis(data);
      setTimeRange([0, data.data.length - 1]);
      if (data.data.length > 0) {
        earliestDateRef.current = data.data[0].date;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);
  useEffect(() => { fetchTrending().then(setTrending).catch(() => {}); }, []);

  // Infinite scroll: load more when slider hits the start
  const loadMoreHistory = useCallback(async () => {
    if (loadingMore || !earliestDateRef.current || !analysis) return;
    setLoadingMore(true);
    try {
      const earliest = new Date(earliestDateRef.current);
      const newEnd = new Date(earliest.getTime() - 86400000); // day before
      const newStart = new Date(newEnd.getTime() - 180 * 86400000); // 6 more months
      const result = await fetchHistoryRange(
        symbol,
        newStart.toISOString().split("T")[0],
        newEnd.toISOString().split("T")[0],
      );
      if (result.data.length > 0) {
        // Convert to AnalysisDataPoint (only OHLCV, no indicators)
        const newPoints: AnalysisDataPoint[] = result.data.map(d => ({
          date: d.date, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
          ema12: null, ema26: null, ema50: null, ema200: null,
          rsi: null, stochK: null, stochD: null,
          macd: null, macdSignal: null, macdHist: null,
          regressionLine: null,
          ichimokuTenkan: null, ichimokuKijun: null, ichimokuSpanA: null, ichimokuSpanB: null, ichimokuChikou: null,
          bbUpper: null, bbMiddle: null, bbLower: null,
          atr: null, adx: null, plusDI: null, minusDI: null,
        }));
        setExtraData(prev => [...newPoints, ...prev]);
        earliestDateRef.current = result.data[0].date;
        // Shift range to keep the same visible window
        setTimeRange(prev => [prev[0] + newPoints.length, prev[1] + newPoints.length]);
      }
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [symbol, analysis, loadingMore]);

  const handleSelect = useCallback((sym: string) => {
    setSymbol(sym);
    onSelectStock(sym);
  }, [onSelectStock]);

  // Merged data: extra historical + analysis data
  const allData = useMemo(() => {
    if (!analysis) return [];
    return [...extraData, ...analysis.data];
  }, [analysis, extraData]);

  const slicedData = useMemo(() => {
    return allData.slice(timeRange[0], timeRange[1] + 1);
  }, [allData, timeRange]);

  const dates = useMemo(() => allData.map(d => d.date), [allData]);
  const lastPrice = slicedData[slicedData.length - 1]?.close ?? 0;

  // Handle time range changes with infinite scroll trigger
  const handleTimeRangeChange = useCallback((range: [number, number]) => {
    setTimeRange(range);
    // When user slides to start, load more data
    if (range[0] === 0 && !loadingMore && allData.length > 0) {
      loadMoreHistory();
    }
  }, [loadMoreHistory, loadingMore, allData.length]);

  const handleNewsLoaded = useCallback((events: { date: string; title: string; link?: string | null }[]) => {
    setNewsMarkers(events);
  }, []);

  return (
    <div className="analysis-page">
      <div className="analysis-toolbar">
        <StockSearch onSelect={handleSelect} currentSymbol={symbol} />
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {loading && !analysis && <Loading message={`Loading ${symbol}...`} />}
      {error && <ErrorMessage message={error} onRetry={loadAnalysis} />}

      {analysis && (
        <>
          {analysis.detail && (
            <StockInfoHeader
              symbol={analysis.symbol}
              detail={analysis.detail}
              lastPoint={slicedData[slicedData.length - 1]}
              signals={analysis.signals}
            />
          )}
          {dates.length > 0 && (
            <div style={{ position: "relative" }}>
              <TimeSlider
                totalPoints={dates.length}
                range={timeRange}
                onChange={handleTimeRangeChange}
                dates={dates}
              />
              {loadingMore && (
                <span className="load-more-indicator">Loading more history...</span>
              )}
            </div>
          )}
          <CandlestickChart data={slicedData} symbol={analysis.symbol} newsMarkers={newsMarkers} />
          <CombinedChart data={slicedData} symbol={analysis.symbol} />
          <IchimokuChart data={slicedData} symbol={analysis.symbol} />
          <WeightedSignalPanel
            signals={analysis.signals}
            regression={analysis.regression}
            lastPoint={slicedData[slicedData.length - 1]}
            data={slicedData}
          />
          <SupportResistancePanel data={slicedData} symbol={analysis.symbol} />
          <RiskMetricsPanel data={slicedData} symbol={analysis.symbol} />
          <RelativePerformancePanel symbol={analysis.symbol} period={period} />
          <MonthlyReturnsHeatmap data={slicedData} symbol={analysis.symbol} />
          {analysis.detail && (
            <>
              <EnhancedAnalystPanel
                detail={analysis.detail}
                currentPrice={lastPrice}
                analysisData={slicedData}
                symbol={analysis.symbol}
              />
              <EarningsDividendPanel symbol={analysis.symbol} />
              <FinancialsPanel detail={analysis.detail} symbol={analysis.symbol} />
            </>
          )}
          <StockNewsPanel symbol={analysis.symbol} onNewsLoaded={handleNewsLoaded} />
        </>
      )}

      <PredictionLoader symbol={symbol} />
      <StockCorrelationPanel symbol={symbol} />

      {trending && (
        <TrendingStocks
          gainers={trending.gainers}
          losers={trending.losers}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
