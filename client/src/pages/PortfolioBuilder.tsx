import { useState, useCallback, useEffect } from "react";
import { Card } from "../components/common/Card";
import { fetchStocks } from "../api/stocks";
import { fetchIndustries } from "../api/market";
import type { StockQuote, IndustrySummary } from "../types/stock";
import type { AssetEntry, Strategy, SimResult } from "../components/portfolio/portfolioConstants";
import { RISK_TOLERANCE, REBALANCE_FREQ } from "../components/portfolio/portfolioConstants";
import { PortfolioConfig } from "../components/portfolio/PortfolioConfig";
import { PortfolioResults } from "../components/portfolio/PortfolioResults";

const BASE = "/api/predict";

export function PortfolioBuilder() {
  const [assets, setAssets] = useState<AssetEntry[]>([
    { symbol: "AAPL", weight: 30 }, { symbol: "MSFT", weight: 30 },
    { symbol: "GOOGL", weight: 20 }, { symbol: "JNJ", weight: 20 },
  ]);
  const [strategies, setStrategies] = useState<Strategy[]>(["long"]);
  const [goalReturn, setGoalReturn] = useState(10);
  const [goalYears, setGoalYears] = useState(5);
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [riskTolerance, setRiskTolerance] = useState<typeof RISK_TOLERANCE[number]>("Moderate");
  const [rebalance, setRebalance] = useState<typeof REBALANCE_FREQ[number]>("Quarterly");
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"backtest" | "projection" | "assets">("backtest");

  const [allStocks, setAllStocks] = useState<StockQuote[]>([]);
  const [industries, setIndustries] = useState<IndustrySummary[]>([]);

  useEffect(() => {
    fetchStocks().then(setAllStocks).catch(() => {});
    fetchIndustries().then(setIndustries).catch(() => {});
  }, []);

  const totalWeight = assets.reduce((s, a) => s + a.weight, 0);

  const toggleStrategy = useCallback((id: Strategy) => {
    setStrategies(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter(s => s !== id);
      }
      if (prev.length >= 2) return [prev[0], id];
      return [...prev, id];
    });
  }, []);

  const runSimulation = useCallback(async () => {
    if (assets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const symbols = assets.map(a => a.symbol).join(",");
      const weights = assets.map(a => a.weight / totalWeight).join(",");
      const primaryStrategy = strategies[0];
      const secondaryStrategy = strategies.length > 1 ? strategies[1] : "";
      const url = `${BASE}/portfolio-strategy?symbols=${symbols}&weights=${weights}&strategy=${primaryStrategy}&strategy2=${secondaryStrategy}&goal_return=${goalReturn}&goal_years=${goalYears}&initial=${initial}&monthly=${monthly}&risk_tolerance=${riskTolerance}&rebalance=${rebalance}&stop_loss=${stopLoss}&take_profit=${takeProfit}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      setResult(data);
      setActiveTab("backtest");
    } catch (e: any) {
      setError(e.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  }, [assets, strategies, goalReturn, goalYears, initial, monthly, totalWeight, riskTolerance, rebalance, stopLoss, takeProfit]);

  return (
    <div className="portfolio-builder">
      <Card title="Portfolio Builder — Strategy Simulator">
        <div className="pb-layout">
          <PortfolioConfig
            assets={assets} setAssets={setAssets}
            strategies={strategies} toggleStrategy={toggleStrategy}
            goalReturn={goalReturn} setGoalReturn={setGoalReturn}
            goalYears={goalYears} setGoalYears={setGoalYears}
            initial={initial} setInitial={setInitial}
            monthly={monthly} setMonthly={setMonthly}
            riskTolerance={riskTolerance} setRiskTolerance={setRiskTolerance}
            rebalance={rebalance} setRebalance={setRebalance}
            stopLoss={stopLoss} setStopLoss={setStopLoss}
            takeProfit={takeProfit} setTakeProfit={setTakeProfit}
            allStocks={allStocks} industries={industries}
            loading={loading} error={error}
            runSimulation={runSimulation}
          />
          <PortfolioResults
            result={result} loading={loading}
            strategies={strategies} goalYears={goalYears}
            riskTolerance={riskTolerance} initial={initial}
            activeTab={activeTab} setActiveTab={setActiveTab}
          />
        </div>
      </Card>
    </div>
  );
}
