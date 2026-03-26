import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { StockQuote } from "../../types/stock";

interface Props {
  gainers: StockQuote[];
  losers: StockQuote[];
  mostActive: StockQuote[];
  onSelectStock: (symbol: string) => void;
}

function MoverRow({ stock, onClick, idx }: { stock: StockQuote; onClick: () => void; idx: number }) {
  const cap = stock.marketCap >= 1e12
    ? `$${(stock.marketCap / 1e12).toFixed(1)}T`
    : stock.marketCap >= 1e9
    ? `$${(stock.marketCap / 1e9).toFixed(0)}B`
    : "";

  return (
    <div className="mover-row clickable fade-in" style={{ animationDelay: `${idx * 25}ms` }}
      onClick={onClick}>
      <span className="pick-symbol">{stock.symbol}</span>
      <span className="pick-name">{stock.name}</span>
      {cap && <span className="text-muted" style={{ fontSize: 11 }}>{cap}</span>}
      <span className="pick-price">${stock.price.toFixed(2)}</span>
      <Badge value={stock.changePercent} type="change" />
    </div>
  );
}

export function TodayMovers({ gainers, losers, mostActive, onSelectStock }: Props) {
  return (
    <div className="movers-grid">
      <Card title={`Top Gainers (${gainers.length})`} className="mover-card">
        <TrendingUp size={16} style={{ color: "#059669", marginBottom: 6 }} />
        {gainers.slice(0, 15).map((s, i) => (
          <MoverRow key={s.symbol} stock={s} idx={i} onClick={() => onSelectStock(s.symbol)} />
        ))}
        {gainers.length === 0 && <p className="text-muted text-sm">No gainers today</p>}
      </Card>

      <Card title={`Top Losers (${losers.length})`} className="mover-card">
        <TrendingDown size={16} style={{ color: "#dc2626", marginBottom: 6 }} />
        {losers.slice(0, 15).map((s, i) => (
          <MoverRow key={s.symbol} stock={s} idx={i} onClick={() => onSelectStock(s.symbol)} />
        ))}
        {losers.length === 0 && <p className="text-muted text-sm">No losers today</p>}
      </Card>

      <Card title={`Most Active (${mostActive.length})`} className="mover-card">
        <Zap size={16} style={{ color: "#d97706", marginBottom: 6 }} />
        {mostActive.slice(0, 15).map((s, i) => (
          <MoverRow key={s.symbol} stock={s} idx={i} onClick={() => onSelectStock(s.symbol)} />
        ))}
      </Card>
    </div>
  );
}
