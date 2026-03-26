import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, ReferenceLine,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import type { CompareStock } from "../../api/compare";

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

interface Props {
  stocks: CompareStock[];
}

export function MonthlyReturnsCompare({ stocks }: Props) {
  // Merge monthly returns across stocks
  const months = new Set<string>();
  stocks.forEach(s => s.monthlyReturns.forEach(m => months.add(m.month)));
  const sortedMonths = Array.from(months).sort();

  const data = sortedMonths.map(month => {
    const point: Record<string, any> = { month };
    stocks.forEach(s => {
      const mr = s.monthlyReturns.find(m => m.month === month);
      point[s.symbol] = mr ? mr.return : null;
    });
    return point;
  });

  // Summary stats
  const stats = stocks.map(s => {
    const rets = s.monthlyReturns.map(m => m.return);
    const pos = rets.filter(r => r > 0).length;
    const best = rets.length > 0 ? Math.max(...rets) : 0;
    const worst = rets.length > 0 ? Math.min(...rets) : 0;
    return { symbol: s.symbol, positive: pos, total: rets.length, best, worst };
  });

  return (
    <Card title="Monthly Returns Comparison">
      <div className="cmp-monthly-stats">
        {stats.map((s, i) => (
          <div key={s.symbol} className="cmp-monthly-badge">
            <span style={{ color: COLORS[i % COLORS.length], fontWeight: 600 }}>{s.symbol}</span>
            <span>{s.positive}/{s.total} positive</span>
            <span style={{ color: "#059669" }}>Best: +{s.best.toFixed(1)}%</span>
            <span style={{ color: "#dc2626" }}>Worst: {s.worst.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={m => m?.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#d1d5db" />
          {stocks.map((s, i) => (
            <Bar shape={SafeBarShape} key={s.symbol} dataKey={s.symbol} fill={COLORS[i % COLORS.length]}
              radius={[2, 2, 0, 0]} opacity={0.8} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
