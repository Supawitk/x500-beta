import { Card } from "../common/Card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import type { StockDetail } from "../../api/analysis";

interface Props {
  detail: StockDetail;
  currentPrice: number;
}

const REC_COLORS: Record<string, string> = {
  "Strong Buy": "#059669", Buy: "#34d399", Hold: "#d97706",
  Sell: "#f87171", "Strong Sell": "#dc2626",
};

export function AnalystPanel({ detail, currentPrice }: Props) {
  const recData = detail.recommendations ? [
    { name: "Strong Buy", value: detail.recommendations.strongBuy },
    { name: "Buy", value: detail.recommendations.buy },
    { name: "Hold", value: detail.recommendations.hold },
    { name: "Sell", value: detail.recommendations.sell },
    { name: "Strong Sell", value: detail.recommendations.strongSell },
  ] : [];

  const targetMean = typeof detail.analystTargetMean === "number" ? detail.analystTargetMean : null;
  const targetLow = typeof detail.analystTargetLow === "number" ? detail.analystTargetLow : null;
  const targetHigh = typeof detail.analystTargetHigh === "number" ? detail.analystTargetHigh : null;
  const upside = targetMean
    ? ((targetMean - currentPrice) / currentPrice * 100).toFixed(1)
    : null;

  return (
    <Card title="Analyst Consensus">
      <div className="analyst-grid">
        <div className="analyst-target">
          <span className="metric-label">Target Mean</span>
          <span className="analyst-price">
            {targetMean != null ? `$${targetMean.toFixed(2)}` : "N/A"}
          </span>
          {upside && (
            <span className={Number(upside) > 0 ? "text-green" : "text-red"}>
              {Number(upside) > 0 ? "+" : ""}{upside}% upside
            </span>
          )}
        </div>
        <div className="analyst-range">
          <div className="target-range-bar">
            <span>{targetLow != null ? `$${targetLow.toFixed(0)}` : "?"}</span>
            <div className="target-bar-track">
              <div className="target-bar-current" style={{
                left: targetLow != null && targetHigh != null && targetHigh > targetLow
                  ? `${Math.max(0, Math.min(100, ((currentPrice - targetLow) / (targetHigh - targetLow)) * 100))}%`
                  : "50%"
              }} />
            </div>
            <span>{targetHigh != null ? `$${targetHigh.toFixed(0)}` : "?"}</span>
          </div>
          <span className="text-sm text-muted">
            {typeof detail.numberOfAnalysts === "number" ? detail.numberOfAnalysts : "?"} analysts
            {typeof detail.recommendationKey === "string" && detail.recommendationKey
              ? ` | Rec: ${detail.recommendationKey.toUpperCase()}` : ""}
          </span>
        </div>
      </div>
      {recData.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={recData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar shape={SafeBarShape} dataKey="value" radius={[0, 4, 4, 0]}>
              {recData.map((d) => (
                <Cell key={d.name} fill={REC_COLORS[d.name] || "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
