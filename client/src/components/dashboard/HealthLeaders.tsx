import { useState } from "react";
import { Card } from "../common/Card";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { StockQuote } from "../../types/stock";
import { HealthDetail } from "./HealthDetail";

interface Props {
  stocks: StockQuote[];
  onSelectStock: (symbol: string) => void;
}

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.min(score, 100);
  const color = score >= 70 ? "var(--green)" : score >= 40 ? "#d97706" : "var(--red)";
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

export function HealthLeaders({ stocks, onSelectStock }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...stocks]
    .filter((s) => s.healthScore !== null)
    .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))
    .slice(0, 10);

  const toggle = (sym: string) => setExpanded(expanded === sym ? null : sym);

  return (
    <Card title="Top Health Scores (Value Investing) — click to expand">
      {sorted.map((s) => (
        <div key={s.symbol} className="health-item">
          <div className="health-row health-clickable" onClick={() => toggle(s.symbol)}>
            <span
              className="pick-symbol clickable-sym"
              onClick={(e) => { e.stopPropagation(); onSelectStock(s.symbol); }}
            >
              {s.symbol}
            </span>
            <span className="pick-name">{s.name}</span>
            <ScoreBar score={s.healthScore!} />
            <span className="health-score-num">{s.healthScore}</span>
            {expanded === s.symbol
              ? <ChevronUp size={14} />
              : <ChevronDown size={14} className="text-muted" />}
          </div>
          {expanded === s.symbol && (
            <HealthDetail stock={s}>
              <button className="btn btn-outline btn-sm" onClick={() => onSelectStock(s.symbol)}>
                <ExternalLink size={12} /> View Analysis
              </button>
            </HealthDetail>
          )}
        </div>
      ))}
      {sorted.length === 0 && <p className="text-muted">No data available</p>}
    </Card>
  );
}
