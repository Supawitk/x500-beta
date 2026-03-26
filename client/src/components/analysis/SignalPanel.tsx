import { Card } from "../common/Card";
import type { SignalSummary } from "../../api/analysis";

interface Props {
  signals: SignalSummary;
  regression: { slope: number; rSquared: number; trend: string };
}

function signalColor(signal: string): string {
  if (signal.includes("Bullish") || signal.includes("Oversold") || signal.includes("Above"))
    return "badge-green";
  if (signal.includes("Bearish") || signal.includes("Overbought") || signal.includes("Below"))
    return "badge-red";
  return "badge-yellow";
}

export function SignalPanel({ signals, regression }: Props) {
  const items = [
    { label: "EMA Crossover", value: signals.emaSignal },
    { label: "RSI (14)", value: signals.rsiSignal },
    { label: "Stochastic", value: signals.stochSignal },
    { label: "MACD", value: signals.macdSignal },
    { label: "Trend (EMA50)", value: signals.trendSignal },
    { label: "Regression", value: regression.trend },
  ];

  return (
    <Card title="Signal Summary">
      <div className={`overall-signal ${signalColor(signals.overall)}`}>
        {signals.overall}
      </div>
      <div className="signal-grid">
        {items.map((item) => (
          <div key={item.label} className="signal-item">
            <span className="metric-label">{item.label}</span>
            <span className={`health-badge ${signalColor(item.value)}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <div className="regression-info">
        <span>R² = {regression.rSquared.toFixed(4)}</span>
        <span>Slope = {regression.slope.toFixed(4)}</span>
      </div>
    </Card>
  );
}
