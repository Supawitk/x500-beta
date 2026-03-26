import { useState, useEffect } from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { X, Target, StickyNote, Check } from "lucide-react";
import { updateWatchlistEntry, type WatchlistEntry } from "../../api/watchlist";
import type { StockQuote } from "../../types/stock";

interface Props {
  stock: StockQuote;
  entry: WatchlistEntry | undefined;
  selected: boolean;
  onSelect: (sym: string) => void;
  onRemove: (sym: string) => void;
  onSelectStock: (sym: string) => void;
  onEntryUpdate: () => void;
}

export function WatchlistCard(props: Props) {
  const { stock: s, entry, selected, onSelect, onRemove, onSelectStock, onEntryUpdate } = props;
  const [editing, setEditing] = useState<"target" | "notes" | null>(null);
  const [targetVal, setTargetVal] = useState(entry?.targetPrice?.toString() || "");
  const [notesVal, setNotesVal] = useState(entry?.notes || "");

  // Sync when entry updates from server
  useEffect(() => {
    if (editing) return; // don't overwrite while user is typing
    setTargetVal(entry?.targetPrice?.toString() || "");
    setNotesVal(entry?.notes || "");
  }, [entry?.targetPrice, entry?.notes, editing]);

  const saveTarget = async () => {
    const num = parseFloat(targetVal);
    await updateWatchlistEntry(s.symbol, { targetPrice: isNaN(num) ? null : num });
    setEditing(null);
    onEntryUpdate();
  };

  const saveNotes = async () => {
    await updateWatchlistEntry(s.symbol, { notes: notesVal });
    setEditing(null);
    onEntryUpdate();
  };

  const targetPrice = entry?.targetPrice;
  const distToTarget = targetPrice ? ((targetPrice - s.price) / s.price * 100) : null;
  const range = s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow;
  const rangePos = range > 0 ? ((s.price - s.fiftyTwoWeekLow) / range) * 100 : 50;

  return (
    <Card className={`wl-card ${selected ? "wl-card-selected" : ""}`}>
      <div className="wl-card-top">
        <input type="checkbox" checked={selected} onChange={() => onSelect(s.symbol)} />
        <span className="font-bold clickable-sym" onClick={() => onSelectStock(s.symbol)}>
          {s.symbol}
        </span>
        <span className="industry-tag">{s.industry}</span>
        <button className="btn-icon" onClick={() => onRemove(s.symbol)}><X size={14} /></button>
      </div>
      <p className="text-muted text-sm">{s.name}</p>

      <div className="wl-card-price-row">
        <span className="watchlist-price">${s.price.toFixed(2)}</span>
        <Badge value={s.changePercent} type="change" />
      </div>

      {/* 52W mini range */}
      <div className="wl-range">
        <span className="text-sm text-muted">${s.fiftyTwoWeekLow.toFixed(0)}</span>
        <div className="range-bar-track" style={{ flex: 1 }}>
          <div className="range-bar-dot dot-blue" style={{ left: `${rangePos}%` }} />
        </div>
        <span className="text-sm text-muted">${s.fiftyTwoWeekHigh.toFixed(0)}</span>
      </div>

      <div className="wl-card-metrics">
        <div><span className="metric-label">P/E</span><span>{s.peRatio?.toFixed(1) ?? "N/A"}</span></div>
        <div><span className="metric-label">Yield</span><span>{s.dividendYield ? `${(s.dividendYield * 100).toFixed(2)}%` : "N/A"}</span></div>
        <div><span className="metric-label">Health</span>
          <span className={`health-badge ${(s.healthScore ?? 0) >= 70 ? "badge-green" : (s.healthScore ?? 0) >= 40 ? "badge-yellow" : "badge-red"}`}>
            {s.healthScore ?? "N/A"}
          </span>
        </div>
        <div><span className="metric-label">Margin</span><Badge value={s.marginOfSafety} type="margin" /></div>
      </div>

      {/* Target price */}
      <div className="wl-target-row">
        <Target size={13} className="text-muted" />
        {editing === "target" ? (
          <div className="wl-edit-inline">
            <input type="number" value={targetVal} onChange={(e) => setTargetVal(e.target.value)}
              placeholder="Target $" autoFocus onKeyDown={(e) => e.key === "Enter" && saveTarget()} />
            <button className="btn-icon" onClick={saveTarget}><Check size={13} /></button>
          </div>
        ) : (
          <span className="wl-target-text clickable" onClick={() => setEditing("target")}>
            {targetPrice ? (
              <>{`$${targetPrice.toFixed(2)}`} <span className={distToTarget! >= 0 ? "text-green" : "text-red"}>
                ({distToTarget! >= 0 ? "+" : ""}{distToTarget!.toFixed(1)}% away)
              </span></>
            ) : "Set target price"}
          </span>
        )}
      </div>

      {/* Notes */}
      <div className="wl-notes-row">
        <StickyNote size={13} className="text-muted" />
        {editing === "notes" ? (
          <div className="wl-edit-inline" style={{ flex: 1 }}>
            <input type="text" value={notesVal} onChange={(e) => setNotesVal(e.target.value)}
              placeholder="Add notes..." autoFocus onKeyDown={(e) => e.key === "Enter" && saveNotes()} />
            <button className="btn-icon" onClick={saveNotes}><Check size={13} /></button>
          </div>
        ) : (
          <span className="wl-notes-text clickable" onClick={() => setEditing("notes")}>
            {entry?.notes || "Add notes..."}
          </span>
        )}
      </div>
    </Card>
  );
}
