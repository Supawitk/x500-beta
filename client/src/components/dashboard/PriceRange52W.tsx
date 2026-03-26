import { Card } from "../common/Card";
import type { StockQuote } from "../../types/stock";

interface Props {
  stocks: StockQuote[];
  onSelectStock: (symbol: string) => void;
}

function RangeBar({ stock, onClick }: { stock: StockQuote; onClick: () => void }) {
  const range = stock.fiftyTwoWeekHigh - stock.fiftyTwoWeekLow;
  const pos = range > 0 ? ((stock.price - stock.fiftyTwoWeekLow) / range) * 100 : 50;
  const nearHigh = pos > 85;
  const nearLow = pos < 15;

  return (
    <div className="range-row clickable" onClick={onClick}>
      <span className="pick-symbol">{stock.symbol}</span>
      <span className="text-sm text-muted">${stock.fiftyTwoWeekLow.toFixed(0)}</span>
      <div className="range-bar-track">
        <div
          className={`range-bar-dot ${nearHigh ? "dot-green" : nearLow ? "dot-red" : "dot-blue"}`}
          style={{ left: `${pos}%` }}
        />
      </div>
      <span className="text-sm text-muted">${stock.fiftyTwoWeekHigh.toFixed(0)}</span>
      <span className={`text-sm ${nearLow ? "text-red" : nearHigh ? "text-green" : "text-muted"}`}>
        {pos.toFixed(0)}%
      </span>
    </div>
  );
}

export function PriceRange52W({ stocks, onSelectStock }: Props) {
  const sorted = [...stocks].sort((a, b) => {
    const ra = a.fiftyTwoWeekHigh - a.fiftyTwoWeekLow;
    const pa = ra > 0 ? (a.price - a.fiftyTwoWeekLow) / ra : 0.5;
    const rb = b.fiftyTwoWeekHigh - b.fiftyTwoWeekLow;
    const pb = rb > 0 ? (b.price - b.fiftyTwoWeekLow) / rb : 0.5;
    return pb - pa;
  });

  return (
    <div className="charts-grid">
      <Card title="Near 52-Week High">
        {sorted.slice(0, 5).map((s) => (
          <RangeBar key={s.symbol} stock={s} onClick={() => onSelectStock(s.symbol)} />
        ))}
      </Card>
      <Card title="Near 52-Week Low">
        {sorted.slice(-5).reverse().map((s) => (
          <RangeBar key={s.symbol} stock={s} onClick={() => onSelectStock(s.symbol)} />
        ))}
      </Card>
    </div>
  );
}
