import { TrendingUp, TrendingDown } from "lucide-react";
import type { MarketIndex } from "../../types/stock";

interface Props {
  indices: MarketIndex[];
}

function fmtPrice(p: number): string {
  return p >= 10000 ? p.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : p.toFixed(2);
}

export function MarketIndices({ indices }: Props) {
  if (indices.length === 0) return null;

  return (
    <div className="indices-bar">
      {indices.map((idx) => {
        const up = idx.changePercent >= 0;
        return (
          <div key={idx.symbol} className="index-item">
            <span className="index-name">{idx.name}</span>
            <span className="index-price">{fmtPrice(idx.price)}</span>
            <span className={up ? "text-green" : "text-red"}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? "+" : ""}{idx.changePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
