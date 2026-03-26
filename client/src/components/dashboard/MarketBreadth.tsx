import { Card } from "../common/Card";
import type { MarketSummary } from "../../types/stock";

interface Props {
  summary: MarketSummary;
}

export function MarketBreadth({ summary }: Props) {
  const total = summary.advancers + summary.decliners + summary.unchanged;
  const advPct = total > 0 ? (summary.advancers / total) * 100 : 0;
  const decPct = total > 0 ? (summary.decliners / total) * 100 : 0;
  const unchPct = 100 - advPct - decPct;

  return (
    <Card title="Market Breadth">
      <div className="breadth-bar">
        <div className="breadth-fill breadth-green" style={{ width: `${advPct}%` }} />
        <div className="breadth-fill breadth-gray" style={{ width: `${unchPct}%` }} />
        <div className="breadth-fill breadth-red" style={{ width: `${decPct}%` }} />
      </div>
      <div className="breadth-labels">
        <span className="text-green">{summary.advancers} Advancing ({advPct.toFixed(0)}%)</span>
        <span className="text-muted">{summary.unchanged} Flat</span>
        <span className="text-red">{summary.decliners} Declining ({decPct.toFixed(0)}%)</span>
      </div>
    </Card>
  );
}
