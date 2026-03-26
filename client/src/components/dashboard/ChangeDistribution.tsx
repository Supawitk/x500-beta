import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
}

export function ChangeDistribution({ stocks }: Props) {
  // Bucket stocks by change percentage
  const buckets = [
    { label: "< -3%", min: -Infinity, max: -3 },
    { label: "-3 to -2%", min: -3, max: -2 },
    { label: "-2 to -1%", min: -2, max: -1 },
    { label: "-1 to 0%", min: -1, max: 0 },
    { label: "0 to 1%", min: 0, max: 1 },
    { label: "1 to 2%", min: 1, max: 2 },
    { label: "2 to 3%", min: 2, max: 3 },
    { label: "> 3%", min: 3, max: Infinity },
  ];

  const data = buckets.map((b) => ({
    name: b.label,
    count: stocks.filter((s) => s.changePercent >= b.min && s.changePercent < b.max).length,
    isPositive: b.min >= 0,
  }));

  return (
    <Card title="Today's Change Distribution">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar shape={SafeBarShape} dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isPositive ? "#059669" : "#dc2626"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
