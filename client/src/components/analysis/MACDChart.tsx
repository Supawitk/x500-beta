import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
}

export function MACDChart({ data }: Props) {
  const sliced = data.slice(-120).map((d) => ({
    ...d,
    histColor: (d.macdHist ?? 0) >= 0 ? "#059669" : "#dc2626",
  }));

  return (
    <Card title="MACD (12, 26, 9)">
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={sliced}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="macdHist" name="Histogram"
            fill="#e5e7eb"
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              const color = (payload.macdHist ?? 0) >= 0 ? "#059669" : "#dc2626";
              return <rect x={x} y={y} width={width} height={height} fill={color} />;
            }}
          />
          <Line dataKey="macd" stroke="#4f46e5" dot={false} strokeWidth={1.5} name="MACD" />
          <Line dataKey="macdSignal" stroke="#dc2626" dot={false} strokeWidth={1}
            name="Signal" strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
