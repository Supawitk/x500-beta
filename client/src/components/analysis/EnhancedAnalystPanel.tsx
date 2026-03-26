import { useState } from "react";
import { Card } from "../common/Card";
import type { StockDetail, AnalysisDataPoint } from "../../api/analysis";
import { ConsensusTab } from "./AnalystOverview";
import { ValuationTab, ScorecardTab } from "./AnalystValuation";
import { ThreeDTab, RiskTab } from "./AnalystCharts";

export type { AnalystPanelProps } from "./analystHelpers";

interface Props {
  detail: StockDetail;
  currentPrice: number;
  analysisData: AnalysisDataPoint[];
  symbol: string;
}

const TABS = ["Consensus", "Valuation", "Scorecard", "3D Analysis", "Risk & Ownership"] as const;
type Tab = typeof TABS[number];

export function EnhancedAnalystPanel({ detail, currentPrice, analysisData, symbol }: Props) {
  const [tab, setTab] = useState<Tab>("Consensus");

  return (
    <Card title={`Decision Analysis — ${symbol}`}>
      <div className="eap-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`eap-tab ${tab === t ? "eap-tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="eap-content">
        {tab === "Consensus" && <ConsensusTab detail={detail} currentPrice={currentPrice} />}
        {tab === "Valuation" && <ValuationTab detail={detail} currentPrice={currentPrice} />}
        {tab === "Scorecard" && <ScorecardTab detail={detail} />}
        {tab === "3D Analysis" && <ThreeDTab analysisData={analysisData} />}
        {tab === "Risk & Ownership" && <RiskTab detail={detail} currentPrice={currentPrice} />}
      </div>
    </Card>
  );
}
