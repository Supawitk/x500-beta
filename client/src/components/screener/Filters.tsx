import { useState } from "react";
import {
  Search, RotateCcw, ChevronDown, ChevronUp,
  Flame, DollarSign, Shield, TrendingUp, Building2, Zap, Target,
} from "lucide-react";
import type { FilterParams } from "../../types/stock";

interface Props {
  filters: FilterParams;
  sectors: string[];
  industries: string[];
  onChange: (filters: FilterParams) => void;
  onReset: () => void;
}

interface Preset {
  label: string;
  icon: React.ReactNode;
  filters: Partial<FilterParams>;
  className: string;
}

const PRESETS: Preset[] = [
  { label: "Top Dividend", icon: <DollarSign size={12} />, className: "scr-pre-div",
    filters: { minDividendYield: "2", sortBy: "dividendYield" } },
  { label: "Undervalued", icon: <Shield size={12} />, className: "scr-pre-val",
    filters: { sortBy: "marginOfSafety" } },
  { label: "Healthiest", icon: <Zap size={12} />, className: "scr-pre-health",
    filters: { minHealthScore: "70", sortBy: "healthScore" } },
  { label: "Growth", icon: <TrendingUp size={12} />, className: "scr-pre-growth",
    filters: { sortBy: "changePercent" } },
  { label: "Low P/E", icon: <Target size={12} />, className: "scr-pre-pe",
    filters: { maxPE: "15", sortBy: "peRatio" } },
  { label: "Blue Chips", icon: <Building2 size={12} />, className: "scr-pre-blue",
    filters: { sortBy: "marketCap" } },
  { label: "Hot Today", icon: <Flame size={12} />, className: "scr-pre-hot",
    filters: { sortBy: "changePercent" } },
];

export function Filters({ filters, sectors, industries, onChange, onReset }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (key: keyof FilterParams, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const applyPreset = (preset: Preset) => {
    onChange({ ...preset.filters });
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="scr-filters">
      {/* Search + primary controls */}
      <div className="scr-filter-main">
        <div className="scr-search-wrap">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search symbol, name, industry..."
            value={filters.search || ""}
            onChange={(e) => update("search", e.target.value)}
          />
          {filters.search && (
            <button className="scr-search-clear" onClick={() => update("search", "")}>×</button>
          )}
        </div>
        <select value={filters.sector || ""} onChange={(e) => update("sector", e.target.value)}>
          <option value="">All Sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.industry || ""} onChange={(e) => update("industry", e.target.value)}>
          <option value="">All Industries</option>
          {industries.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.sortBy || ""} onChange={(e) => update("sortBy", e.target.value)}>
          <option value="">Sort by...</option>
          <option value="dividendYield">Dividend Yield</option>
          <option value="peRatio">P/E Ratio (low→high)</option>
          <option value="marginOfSafety">Margin of Safety</option>
          <option value="healthScore">Health Score</option>
          <option value="marketCap">Market Cap</option>
          <option value="price">Price</option>
          <option value="changePercent">Change %</option>
          <option value="beta">Beta</option>
        </select>
        <button className="scr-adv-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Filters {activeCount > 0 && <span className="scr-filter-count">{activeCount}</span>}
        </button>
        <button className="btn btn-outline scr-reset-btn" onClick={onReset}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* Preset buttons */}
      <div className="scr-presets">
        {PRESETS.map(p => (
          <button key={p.label} className={`scr-preset-btn ${p.className}`} onClick={() => applyPreset(p)}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="scr-advanced">
          <div className="scr-adv-group">
            <label>Min Dividend Yield (%)</label>
            <div className="scr-range-row">
              <input type="range" min={0} max={10} step={0.5}
                value={filters.minDividendYield || 0}
                onChange={(e) => update("minDividendYield", e.target.value === "0" ? "" : e.target.value)} />
              <span className="scr-range-val">{filters.minDividendYield || "Any"}{filters.minDividendYield ? "%" : ""}</span>
            </div>
          </div>
          <div className="scr-adv-group">
            <label>Max P/E Ratio</label>
            <div className="scr-range-row">
              <input type="range" min={0} max={100} step={5}
                value={filters.maxPE || 100}
                onChange={(e) => update("maxPE", e.target.value === "100" ? "" : e.target.value)} />
              <span className="scr-range-val">{filters.maxPE || "Any"}</span>
            </div>
          </div>
          <div className="scr-adv-group">
            <label>Min Health Score</label>
            <div className="scr-range-row">
              <input type="range" min={0} max={100} step={5}
                value={filters.minHealthScore || 0}
                onChange={(e) => update("minHealthScore", e.target.value === "0" ? "" : e.target.value)} />
              <span className="scr-range-val">{filters.minHealthScore || "Any"}</span>
            </div>
          </div>
          <div className="scr-adv-group">
            <label>Min Margin of Safety (%)</label>
            <div className="scr-range-row">
              <input type="range" min={-50} max={50} step={5}
                value={filters.minMoS || -50}
                onChange={(e) => update("minMoS", e.target.value === "-50" ? "" : e.target.value)} />
              <span className="scr-range-val">{filters.minMoS ? `${filters.minMoS}%` : "Any"}</span>
            </div>
          </div>
          <div className="scr-adv-group">
            <label>Max Beta</label>
            <div className="scr-range-row">
              <input type="range" min={0} max={3} step={0.1}
                value={filters.maxBeta || 3}
                onChange={(e) => update("maxBeta", e.target.value === "3" ? "" : e.target.value)} />
              <span className="scr-range-val">{filters.maxBeta || "Any"}</span>
            </div>
          </div>
          <div className="scr-adv-group">
            <label>Min Market Cap</label>
            <select value={filters.minMarketCap || ""} onChange={(e) => update("minMarketCap", e.target.value)}>
              <option value="">Any</option>
              <option value="10000000000">Large Cap ($10B+)</option>
              <option value="2000000000">Mid Cap ($2B+)</option>
              <option value="300000000">Small Cap ($300M+)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
