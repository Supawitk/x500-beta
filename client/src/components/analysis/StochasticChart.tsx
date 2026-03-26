import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
}

export function StochasticChart({ data }: Props) {
  const sliced = data.slice(-120);

  return (
    <Card title="Modified Stochastic (14, 3, 3)">
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={sliced}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} ticks={[20, 50, 80]} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <ReferenceLine y={80} stroke="#dc2626" strokeDasharray="3 3" label="80" />
          <ReferenceLine y={20} stroke="#059669" strokeDasharray="3 3" label="20" />
          <Line dataKey="stochK" stroke="#4f46e5" dot={false} strokeWidth={1.5} name="%K" />
          <Line dataKey="stochD" stroke="#dc2626" dot={false} strokeWidth={1} name="%D"
            strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
