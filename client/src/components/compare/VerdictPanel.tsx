import { Card } from "../common/Card";
import { Trophy, AlertTriangle, TrendingUp } from "lucide-react";
import type { ScoredStock } from "../../api/compare";

interface Props {
  scored: ScoredStock[];
  summary: string;
}

function scoreColor(score: number): string {
  if (score >= 40) return "badge-green";
  if (score >= 15) return "badge-yellow";
  return "badge-red";
}

function scoreLabel(score: number): string {
  if (score >= 50) return "Strong";
  if (score >= 30) return "Good";
  if (score >= 15) return "Moderate";
  if (score >= 0) return "Weak";
  return "Poor";
}

export function VerdictPanel({ scored, summary }: Props) {
  const allBad = scored.every((s) => s.score < 10);

  return (
    <Card title="Verdict" className="verdict-card">
      <div className="verdict-header">
        {allBad
          ? <AlertTriangle size={24} className="text-red" />
          : <Trophy size={24} style={{ color: "#d97706" }} />
        }
        <p className="verdict-summary">{summary}</p>
      </div>

      <div className="verdict-scores">
        {scored.map((s, i) => (
          <div key={s.symbol} className={`verdict-stock ${i === 0 && !allBad ? "verdict-winner" : ""}`}>
            <div className="verdict-stock-header">
              {i === 0 && !allBad && <TrendingUp size={16} />}
              <span className="font-bold">{s.symbol}</span>
              <span className={`health-badge ${scoreColor(s.score)}`}>
                {s.score} pts - {scoreLabel(s.score)}
              </span>
            </div>
            <div className="verdict-reasons">
              {s.reasons.map((r, ri) => (
                <span key={ri} className="verdict-reason">{r}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
