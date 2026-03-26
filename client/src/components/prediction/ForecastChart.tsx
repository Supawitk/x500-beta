import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card } from "../common/Card";
import type { ForecastResult } from "../../api/prediction";

interface Props {
  forecast: ForecastResult;
}

export function ForecastChart({ forecast }: Props) {
  const { lastPrice, model, aic, residual_sd } = forecast;

  const data = forecast.forecast.map((f, i) => ({
    day: `Day ${i + 1}`,
    point: f.point,
    lo80: f.lo80,
    hi80: f.hi80,
    lo95: f.lo95,
    hi95: f.hi95,
  }));

  // Prepend current price
  data.unshift({ day: "Now", point: lastPrice, lo80: lastPrice, hi80: lastPrice, lo95: lastPrice, hi95: lastPrice });

  return (
    <Card title={`Price Forecast — ${model}`}>
      <div className="forecast-meta">
        <span>AIC: {aic}</span>
        <span>Residual SD: ${residual_sd.toFixed(2)}</span>
        <span>Current: ${lastPrice.toFixed(2)}</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
          <ReferenceLine y={lastPrice} stroke="#6b7280" strokeDasharray="3 3" label="Current" />
          <Area dataKey="hi95" stroke="none" fill="#dbeafe" fillOpacity={0.4} />
          <Area dataKey="lo95" stroke="none" fill="#ffffff" fillOpacity={1} />
          <Area dataKey="hi80" stroke="none" fill="#bfdbfe" fillOpacity={0.5} />
          <Area dataKey="lo80" stroke="none" fill="#ffffff" fillOpacity={1} />
          <Line dataKey="point" stroke="#4f46e5" strokeWidth={2} dot={false} name="Forecast" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="forecast-legend">
        <span><span className="legend-dot" style={{ background: "#4f46e5" }} /> Point forecast</span>
        <span><span className="legend-dot" style={{ background: "#bfdbfe" }} /> 80% confidence</span>
        <span><span className="legend-dot" style={{ background: "#dbeafe" }} /> 95% confidence</span>
      </div>
      {typeof forecast.warning === "string" && forecast.warning && (
        <p className="text-red text-sm">{forecast.warning}</p>
      )}
      <p className="text-muted text-sm" style={{ marginTop: 6 }}>
        Wider bands = more uncertainty. ARIMA does not predict direction well beyond a few days.
      </p>
    </Card>
  );
}
