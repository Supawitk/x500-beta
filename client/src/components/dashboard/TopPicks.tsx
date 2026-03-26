import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import type { StockQuote } from "../../types/stock";

interface Props {
  valueStocks: StockQuote[];
  dividendStocks: StockQuote[];
  onSelectStock: (symbol: string) => void;
}

function StockRow({ stock, metric, onClick }: {
  stock: StockQuote; metric: "value" | "dividend"; onClick: () => void;
}) {
  return (
    <div className="pick-row clickable" onClick={onClick}>
      <span className="pick-symbol">{stock.symbol}</span>
      <span className="pick-name">{stock.name}</span>
      <span className="pick-price">${stock.price.toFixed(2)}</span>
      {metric === "value" ? (
        <Badge value={stock.marginOfSafety} type="margin" />
      ) : (
        <Badge value={stock.dividendYield ? stock.dividendYield * 100 : null} type="yield" />
      )}
    </div>
  );
}

export function TopPicks({ valueStocks, dividendStocks, onSelectStock }: Props) {
  return (
    <div className="charts-grid">
      <Card title="Top Value Picks (Margin of Safety)">
        {valueStocks.slice(0, 10).map((s) => (
          <StockRow key={s.symbol} stock={s} metric="value" onClick={() => onSelectStock(s.symbol)} />
        ))}
        {valueStocks.length === 0 && <p className="text-muted">No undervalued stocks found</p>}
      </Card>
      <Card title="Top Dividend Picks (Yield)">
        {dividendStocks.slice(0, 10).map((s) => (
          <StockRow key={s.symbol} stock={s} metric="dividend" onClick={() => onSelectStock(s.symbol)} />
        ))}
        {dividendStocks.length === 0 && <p className="text-muted">No dividend stocks found</p>}
      </Card>
    </div>
  );
}
