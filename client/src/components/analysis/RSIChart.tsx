import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
}

export function RSIChart({ data }: Props) {
  const sliced = data.slice(-120);

  return (
    <Card title="RSI (14)">
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={sliced}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} ticks={[20, 30, 50, 70, 80]} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="3 3" label="70" />
          <ReferenceLine y={30} stroke="#059669" strokeDasharray="3 3" label="30" />
          <Line dataKey="rsi" stroke="#7c3aed" dot={false} strokeWidth={1.5} name="RSI" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
