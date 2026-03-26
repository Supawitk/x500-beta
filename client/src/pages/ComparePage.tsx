import { useState, useCallback, useEffect } from "react";
import { CompareSearch } from "../components/compare/CompareSearch";
import { PriceOverlay } from "../components/compare/PriceOverlay";
import { RadarCompare } from "../components/compare/RadarCompare";
import { CompareMetrics } from "../components/compare/CompareMetrics";
import { CorrelationMatrix } from "../components/compare/CorrelationMatrix";
import { VerdictPanel } from "../components/compare/VerdictPanel";
import { RiskCompare } from "../components/compare/RiskCompare";
import { DrawdownCompare } from "../components/compare/DrawdownCompare";
import { VolatilityCompare } from "../components/compare/VolatilityCompare";
import { MonthlyReturnsCompare } from "../components/compare/MonthlyReturnsCompare";
import { ReturnDistribution } from "../components/compare/ReturnDistribution";
import { FundamentalsCompare } from "../components/compare/FundamentalsCompare";
import { PeriodSelector } from "../components/analysis/PeriodSelector";
import { Loading } from "../components/common/Loading";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { fetchFullCompare } from "../api/compare";
import type { CompareResult } from "../api/compare";
import { PortfolioPanel } from "../components/prediction/PortfolioPanel";
import { fetchPortfolio } from "../api/prediction";
import type { PortfolioResult } from "../api/prediction";

interface Props {
  initialSymbols?: string[];
}

export function ComparePage({ initialSymbols }: Props) {
  const [symbols, setSymbols] = useState<string[]>(
    initialSymbols && initialSymbols.length >= 2 ? initialSymbols : ["AAPL", "MSFT"]
  );
  const [period, setPeriod] = useState("6mo");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResult | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [section, setSection] = useState<"overview" | "risk" | "fundamentals">("overview");

  useEffect(() => {
    if (initialSymbols && initialSymbols.length >= 2) {
      setSymbols(initialSymbols);
      setResult(null);
      setPortfolio(null);
    }
  }, [initialSymbols]);

  const addSymbol = useCallback((sym: string) => {
    const upper = sym.toUpperCase();
    if (!symbols.includes(upper)) setSymbols([...symbols, upper]);
  }, [symbols]);

  const removeSymbol = useCallback((sym: string) => {
    setSymbols(symbols.filter((s) => s !== sym));
  }, [symbols]);

  const doCompare = useCallback(async () => {
    if (symbols.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFullCompare(symbols, period);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [symbols, period]);

  const marketCorrs: Record<string, number> = {};
  result?.stocks.forEach((s) => { marketCorrs[s.symbol] = s.marketCorrelation; });

  return (
    <div className="compare-page">
      <div className="compare-toolbar">
        <CompareSearch
          symbols={symbols}
          onAdd={addSymbol}
          onRemove={removeSymbol}
          onCompare={doCompare}
          loading={loading}
        />
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {loading && <Loading message="Comparing stocks..." />}
      {error && <ErrorMessage message={error} onRetry={doCompare} />}

      {result && !loading && (
        <>
          <VerdictPanel scored={result.verdict.scored} summary={result.verdict.summary} />

          {/* Section tabs */}
          <div className="cmp-section-tabs">
            {(["overview", "risk", "fundamentals"] as const).map(t => (
              <button key={t} className={`cmp-sec-tab${section === t ? " cmp-sec-tab-active" : ""}`}
                onClick={() => setSection(t)}>
                {t === "overview" ? "Price & Overview" : t === "risk" ? "Risk & Volatility" : "Fundamentals"}
              </button>
            ))}
          </div>

          {section === "overview" && (
            <>
              <PriceOverlay chartData={result.chartData} symbols={symbols} />
              <div className="charts-grid">
                <RadarCompare stocks={result.stocks} />
                <CorrelationMatrix
                  symbols={symbols}
                  pairCorrelations={result.pairCorrelations}
                  marketCorrelations={marketCorrs}
                />
              </div>
              <MonthlyReturnsCompare stocks={result.stocks} />
              <CompareMetrics stocks={result.stocks} />
            </>
          )}

          {section === "risk" && (
            <>
              <RiskCompare stocks={result.stocks} />
              <div className="charts-grid charts-grid-equal">
                <DrawdownCompare
                  drawdownData={result.drawdownData}
                  symbols={symbols}
                  stocks={result.stocks}
                />
                <VolatilityCompare volData={result.volData} symbols={symbols} stocks={result.stocks} />
              </div>
              <ReturnDistribution stocks={result.stocks} />
            </>
          )}

          {section === "fundamentals" && (
            <>
              <FundamentalsCompare stocks={result.stocks} />
            </>
          )}

          {!portfolio && !portfolioLoading && (
            <button className="btn btn-primary" onClick={async () => {
              setPortfolioLoading(true);
              try { setPortfolio(await fetchPortfolio(symbols)); } catch {}
              setPortfolioLoading(false);
            }}>
              Run Portfolio Optimization (R)
            </button>
          )}
          {portfolioLoading && <Loading message="Running R models..." />}
          {portfolio && <PortfolioPanel data={portfolio} />}
        </>
      )}
    </div>
  );
}
