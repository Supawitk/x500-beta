import { useState, useMemo } from "react";
import {
  Search, ChevronDown, ChevronUp, Flame, DollarSign, Shield, Layers,
} from "lucide-react";
import type { StockQuote, IndustrySummary } from "../../types/stock";


interface StockPickerProps {
  allStocks: StockQuote[];
  industries: IndustrySummary[];
  existingSymbols: Set<string>;
  onAddAsset: (sym: string) => void;
  onRemoveAsset: (sym: string) => void;
  onAddMultiple: (stocks: StockQuote[]) => void;
  onAddIndustry: (ind: IndustrySummary) => void;
}

export function StockPicker({
  allStocks, industries, existingSymbols, onAddAsset, onRemoveAsset, onAddMultiple, onAddIndustry,
}: StockPickerProps) {
  const [stockSearch, setStockSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [pickerSort, setPickerSort] = useState<"change" | "dividend" | "pe" | "health" | "cap">("change");
  const [showPicker, setShowPicker] = useState(false);

  const sectors = useMemo(() => {
    const s = new Set(allStocks.map(q => q.sector).filter(Boolean));
    return Array.from(s).sort();
  }, [allStocks]);

  const filteredIndustries = useMemo(() => {
    if (!sectorFilter) return [];
    return industries.filter(i => i.sector === sectorFilter);
  }, [industries, sectorFilter]);

  const hotStocks = useMemo(() => {
    return [...allStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
  }, [allStocks]);

  const topDividend = useMemo(() => {
    return [...allStocks].filter(s => s.dividendYield && s.dividendYield > 0)
      .sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0)).slice(0, 10);
  }, [allStocks]);

  const topValue = useMemo(() => {
    return [...allStocks].filter(s => s.marginOfSafety !== null)
      .sort((a, b) => (b.marginOfSafety || 0) - (a.marginOfSafety || 0)).slice(0, 10);
  }, [allStocks]);

  const pickerStocks = useMemo(() => {
    let list = [...allStocks];
    if (stockSearch) {
      const q = stockSearch.toUpperCase();
      list = list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
    }
    if (sectorFilter) list = list.filter(s => s.sector === sectorFilter);
    if (industryFilter) list = list.filter(s => s.industry === industryFilter);
    switch (pickerSort) {
      case "change": list.sort((a, b) => b.changePercent - a.changePercent); break;
      case "dividend": list.sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0)); break;
      case "pe": list.sort((a, b) => (a.peRatio || 999) - (b.peRatio || 999)); break;
      case "health": list.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0)); break;
      case "cap": list.sort((a, b) => b.marketCap - a.marketCap); break;
    }
    return list.slice(0, 30);
  }, [allStocks, stockSearch, sectorFilter, industryFilter, pickerSort]);

  return (
    <div className="pb-section">
      <h4 className="pb-section-title" style={{ cursor: "pointer" }} onClick={() => setShowPicker(!showPicker)}>
        <span>Stock Picker {allStocks.length > 0 && <span className="pb-stock-count">({allStocks.length} available)</span>}</span>
        {showPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </h4>

      {showPicker && (
        <div className="pb-picker">
          {/* Search bar */}
          <div className="pb-picker-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by symbol or name..."
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
            />
          </div>

          {/* Sector & Industry filters */}
          <div className="pb-picker-filters">
            <select value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setIndustryFilter(""); }}>
              <option value="">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {filteredIndustries.length > 0 && (
              <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
                <option value="">All Industries</option>
                {filteredIndustries.map(i => (
                  <option key={i.industry} value={i.industry}>{i.industry} ({i.count})</option>
                ))}
              </select>
            )}
            <select value={pickerSort} onChange={e => setPickerSort(e.target.value as any)}>
              <option value="change">Top Gainers</option>
              <option value="dividend">Highest Dividend</option>
              <option value="pe">Lowest P/E</option>
              <option value="health">Health Score</option>
              <option value="cap">Market Cap</option>
            </select>
          </div>

          {/* Quick pick buttons */}
          <div className="pb-quick-picks">
            <button className="pb-qp-btn pb-qp-hot" onClick={() => onAddMultiple(hotStocks)}>
              <Flame size={12} /> Hot Stocks
            </button>
            <button className="pb-qp-btn pb-qp-div" onClick={() => onAddMultiple(topDividend)}>
              <DollarSign size={12} /> Top Dividend
            </button>
            <button className="pb-qp-btn pb-qp-val" onClick={() => onAddMultiple(topValue)}>
              <Shield size={12} /> Undervalued
            </button>
            {industryFilter && filteredIndustries.find(i => i.industry === industryFilter) && (
              <button className="pb-qp-btn pb-qp-ind"
                onClick={() => onAddIndustry(filteredIndustries.find(i => i.industry === industryFilter)!)}>
                <Layers size={12} /> Add All {industryFilter}
              </button>
            )}
          </div>

          {/* Stock list */}
          <div className="pb-picker-list">
            {pickerStocks.map(s => {
              const added = existingSymbols.has(s.symbol);
              return (
                <div key={s.symbol} className={`pb-pick-row${added ? " pb-pick-added" : ""}`}>
                  <button
                    className={`pb-pick-add${added ? " pb-pick-added-btn" : ""}`}
                    onClick={() => added ? onRemoveAsset(s.symbol) : onAddAsset(s.symbol)}
                    title={added ? "Remove from portfolio" : "Add to portfolio"}
                  >
                    {added ? "\u2715" : "+"}
                  </button>
                  <span className="pb-pick-sym">{s.symbol}</span>
                  <span className="pb-pick-name">{s.name}</span>
                  <span className={`pb-pick-chg ${s.changePercent >= 0 ? "text-green" : "text-red"}`}>
                    {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                  </span>
                  <span className="pb-pick-meta">
                    {s.sector && <span className="pb-pick-sector">{s.sector}</span>}
                    {s.dividendYield ? <span>Div: {(s.dividendYield * 100).toFixed(1)}%</span> : null}
                    {s.peRatio ? <span>P/E: {s.peRatio.toFixed(1)}</span> : null}
                  </span>
                </div>
              );
            })}
            {pickerStocks.length === 0 && (
              <p className="pb-pick-empty">No stocks match your filters</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
