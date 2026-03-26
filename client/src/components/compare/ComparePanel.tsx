import { useState } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Plus, X } from "lucide-react";
import { fetchCompare } from "../../api/stocks";
import type { StockQuote } from "../../types/stock";

function fmt(val: number | null, d = 2): string {
  return val !== null ? val.toFixed(d) : "N/A";
}

export function ComparePanel() {
  const [input, setInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [results, setResults] = useState<StockQuote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addSymbol = () => {
    const s = input.trim().toUpperCase();
    if (s && !symbols.includes(s)) {
      setSymbols([...symbols, s]);
      setInput("");
    }
  };

  const remove = (s: string) => setSymbols(symbols.filter((x) => x !== s));

  const compare = async () => {
    if (symbols.length < 2) { setError("Add at least 2 symbols"); return; }
    try {
      setError(null);
      const data = await fetchCompare(symbols);
      setResults(data);
    } catch {
      setError("Failed to fetch comparison data");
    }
  };

  const metrics: { label: string; key: keyof StockQuote; fmt?: (v: any) => string }[] = [
    { label: "Price", key: "price", fmt: (v) => `$${v?.toFixed(2)}` },
    { label: "Industry", key: "industry" },
    { label: "P/E Ratio", key: "peRatio", fmt: (v) => fmt(v, 1) },
    { label: "Div Yield", key: "dividendYield", fmt: (v) => v ? `${(v * 100).toFixed(2)}%` : "N/A" },
    { label: "Margin of Safety", key: "marginOfSafety", fmt: (v) => fmt(v, 1) + "%" },
    { label: "Health Score", key: "healthScore", fmt: (v) => fmt(v, 0) },
    { label: "Graham #", key: "grahamNumber", fmt: (v) => v ? `$${v.toFixed(0)}` : "N/A" },
    { label: "52W Range", key: "fiftyTwoWeekRange" },
  ];

  return (
    <Card title="Compare Stocks">
      <div className="compare-input-row">
        <input
          type="text" placeholder="Enter symbol (e.g. AAPL)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSymbol()}
        />
        <button className="btn btn-outline" onClick={addSymbol}><Plus size={14} /> Add</button>
        <button className="btn btn-primary" onClick={compare}>Compare</button>
      </div>
      <div className="compare-chips">
        {symbols.map((s) => (
          <span key={s} className="symbol-chip">
            {s} <X size={12} onClick={() => remove(s)} style={{ cursor: "pointer" }} />
          </span>
        ))}
      </div>
      {error && <p className="text-red text-sm">{error}</p>}
      {results.length > 0 && (
        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table className="stock-table">
            <thead>
              <tr>
                <th>Metric</th>
                {results.map((s) => <th key={s.symbol}>{s.symbol}</th>)}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.label}>
                  <td className="font-bold">{m.label}</td>
                  {results.map((s) => (
                    <td key={s.symbol}>
                      {m.key === "marginOfSafety"
                        ? <Badge value={s[m.key] as number} type="margin" />
                        : m.fmt ? m.fmt(s[m.key]) : String(s[m.key] ?? "N/A")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
