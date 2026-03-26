import { PredictionDashboard } from "./PredictionDashboard";

interface Props {
  symbol: string;
}

export function PredictionLoader({ symbol }: Props) {
  return (
    <div className="prediction-section">
      <PredictionDashboard symbol={symbol} />
    </div>
  );
}
