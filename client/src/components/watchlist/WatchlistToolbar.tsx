import { Search, Layers, GitCompare } from "lucide-react";

export type SortKey = "changePercent" | "dividendYield" | "peRatio" | "healthScore" | "marginOfSafety" | "price";
export type ViewMode = "grid" | "sector";

interface Props {
  search: string;
  onSearch: (q: string) => void;
  sortBy: SortKey;
  onSort: (key: SortKey) => void;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  selectedCount: number;
  onCompareSelected: () => void;
}

export function WatchlistToolbar(props: Props) {
  const { search, onSearch, sortBy, onSort, viewMode, onViewMode, selectedCount, onCompareSelected } = props;

  return (
    <div className="wl-toolbar">
      <div className="filter-group">
        <Search size={14} />
        <input
          type="text" placeholder="Filter watchlist..."
          value={search} onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="wl-toolbar-right">
        <select value={sortBy} onChange={(e) => onSort(e.target.value as SortKey)}>
          <option value="changePercent">Sort: Change %</option>
          <option value="dividendYield">Sort: Dividend</option>
          <option value="peRatio">Sort: P/E</option>
          <option value="healthScore">Sort: Health</option>
          <option value="marginOfSafety">Sort: Margin</option>
          <option value="price">Sort: Price</option>
        </select>
        <button
          className={`btn btn-outline btn-sm ${viewMode === "grid" ? "active" : ""}`}
          onClick={() => onViewMode(viewMode === "grid" ? "sector" : "grid")}
        >
          <Layers size={13} /> {viewMode === "grid" ? "Group" : "Grid"}
        </button>
        {selectedCount >= 2 && (
          <button className="btn btn-primary btn-sm" onClick={onCompareSelected}>
            <GitCompare size={13} /> Compare ({selectedCount})
          </button>
        )}
      </div>
    </div>
  );
}
