import { Card } from "../common/Card";
import { ShieldAlert, TrendingUp, Activity } from "lucide-react";
import type { RiskResult } from "../../api/prediction";

interface Props {
  risk: RiskResult;
}

function pct(v: number): string { return `${(v * 100).toFixed(2)}%`; }

function riskColor(regime: string): string {
  if (regime.includes("High")) return "badge-red";
  if (regime.includes("Low")) return "badge-green";
  return "badge-yellow";
}

export function RiskPanel({ risk }: Props) {
  const rows = [
    { label: "Annual Return", value: pct(risk.ann_return), icon: <TrendingUp size={14} /> },
    { label: "Annual Volatility", value: pct(risk.ann_volatility), icon: <Activity size={14} /> },
    { label: "Sharpe Ratio", value: risk.sharpe_ratio.toFixed(2) },
    { label: "Sortino Ratio", value: risk.sortino_ratio.toFixed(2) },
    { label: "Max Drawdown", value: pct(risk.max_drawdown), cls: "text-red" },
    { label: "Drawdown Period", value: risk.max_dd_period },
    { label: "Calmar Ratio", value: risk.calmar_ratio.toFixed(2) },
    { label: "Win Rate", value: pct(risk.win_rate) },
    { label: "Skewness", value: risk.skewness.toFixed(3) },
    { label: "Kurtosis", value: risk.kurtosis.toFixed(3) },
    { label: "Total Return", value: pct(risk.total_return) },
    { label: "Trading Days", value: risk.trading_days.toString() },
  ];

  return (
    <Card title="Risk Metrics (R-computed)">
      <div className="risk-header">
        <ShieldAlert size={18} />
        <span className={`health-badge ${riskColor(risk.vol_regime)}`}>
          {risk.vol_regime}
        </span>
        <span className="text-muted text-sm">
          Vol percentile: {(risk.current_vol_percentile * 100).toFixed(0)}%
        </span>
      </div>
      <div className="risk-grid">
        {rows.map((r) => (
          <div key={r.label} className="risk-metric">
            <span className="metric-label">{r.label}</span>
            <span className={`risk-value ${r.cls || ""}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
