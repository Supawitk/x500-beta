import { createContext } from "react";

// ── Shared Settings Context ─────────────────────────────────────────────────
export interface Settings { period: string; horizon: number; }
export const SettingsCtx = createContext<Settings>({ period: "1y", horizon: 14 });

// ── Helpers ─────────────────────────────────────────────────────────────────
export function Stat({ label, val, color, sm }: { label: string; val: string; color?: string; sm?: boolean }) {
  return (
    <div className="pd-stat">
      <span className="metric-label">{label}</span>
      <span className={`pd-stat-val ${sm ? "pd-stat-sm" : ""}`} style={color ? { color } : {}}>{val}</span>
    </div>
  );
}
export function fmtPct(v: number | null, d = 1): string { return v == null ? "N/A" : `${v.toFixed(d)}%`; }
export function pctCol(v: number, mid = 0): string { return v > mid ? "#059669" : v < -mid ? "#dc2626" : "#d97706"; }

// ── Model colors ──────────────────────────────────────────────────────────
export const MODEL_COLORS: Record<string, string> = {
  "ARIMA": "#4f46e5",
  "GARCH": "#059669",
  "Holt-Winters": "#d97706",
  "Bayesian": "#dc2626",
  "Regime": "#7c3aed",
};
