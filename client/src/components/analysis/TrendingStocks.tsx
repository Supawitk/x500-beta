import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { StockQuote } from "../../types/stock";

interface Props {
  gainers: StockQuote[];
  losers: StockQuote[];
  onSelect: (symbol: string) => void;
}

function StockRow({ stock, onClick }: { stock: StockQuote; onClick: () => void }) {
  return (
    <div className="trending-row" onClick={onClick}>
      <span className="pick-symbol">{stock.symbol}</span>
      <span className="pick-name">{stock.name}</span>
      <span className="pick-price">${stock.price.toFixed(2)}</span>
      <Badge value={stock.changePercent} type="change" />
    </div>
  );
}

export function TrendingStocks({ gainers, losers, onSelect }: Props) {
  return (
    <div className="charts-grid">
      <Card title="Top Gainers Today">
        <div className="trending-icon"><TrendingUp size={16} className="text-green" /></div>
        {gainers.map((s) => (
          <StockRow key={s.symbol} stock={s} onClick={() => onSelect(s.symbol)} />
        ))}
        {gainers.length === 0 && <p className="text-muted">No data</p>}
      </Card>
      <Card title="Top Losers Today">
        <div className="trending-icon"><TrendingDown size={16} className="text-red" /></div>
        {losers.map((s) => (
          <StockRow key={s.symbol} stock={s} onClick={() => onSelect(s.symbol)} />
        ))}
        {losers.length === 0 && <p className="text-muted">No data</p>}
      </Card>
    </div>
  );
}
