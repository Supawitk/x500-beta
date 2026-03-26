import type { StockDetail, AnalysisDataPoint } from "../../api/analysis";

export interface AnalystPanelProps {
  detail: StockDetail;
  currentPrice: number;
  analysisData: AnalysisDataPoint[];
  symbol: string;
}

export const REC_COLORS: Record<string, string> = {
  "Strong Buy": "#059669", Buy: "#34d399", Hold: "#d97706",
  Sell: "#f87171", "Strong Sell": "#dc2626",
};

// ── Helpers ─────────────────────────────────────────────────────────────────
export function fmt(n: number | null, dec = 2): string {
  if (n == null || !isFinite(n)) return "N/A";
  return n.toFixed(dec);
}
export function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return "N/A";
  return (n * 100).toFixed(1) + "%";
}
export function fmtB(n: number | null): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return n.toLocaleString();
}
export function zone(val: number | null, thresholds: [number, number, number], labels: [string, string, string, string]): { label: string; color: string } {
  if (val == null) return { label: "N/A", color: "#6b7280" };
  const colors = ["#059669", "#34d399", "#d97706", "#dc2626"];
  if (val <= thresholds[0]) return { label: labels[0], color: colors[0] };
  if (val <= thresholds[1]) return { label: labels[1], color: colors[1] };
  if (val <= thresholds[2]) return { label: labels[2], color: colors[2] };
  return { label: labels[3], color: colors[3] };
}

export function scoreNorm(val: number | null, min: number, max: number, invert = false): number {
  if (val == null || !isFinite(val)) return 50;
  const clamped = Math.max(min, Math.min(max, val));
  const s = ((clamped - min) / (max - min)) * 100;
  return invert ? 100 - s : s;
}

// ── Valuation models ────────────────────────────────────────────────────────
export function grahamNumber(eps: number | null, bv: number | null): number | null {
  if (eps == null || bv == null || eps <= 0 || bv <= 0) return null;
  return Math.sqrt(22.5 * eps * bv);
}

export function pegAssessment(peg: number | null): { label: string; color: string; theory: string } {
  if (peg == null) return { label: "N/A", color: "#6b7280", theory: "" };
  if (peg < 0) return { label: "Negative earnings growth", color: "#dc2626", theory: "A negative PEG suggests declining earnings — exercise caution." };
  if (peg < 0.5) return { label: "Deeply undervalued", color: "#059669", theory: "Peter Lynch considered PEG < 1 as undervalued. Below 0.5 is exceptionally cheap relative to growth." };
  if (peg <= 1) return { label: "Undervalued", color: "#34d399", theory: "Peter Lynch Rule: PEG ≤ 1 indicates the stock price is fairly valued or undervalued relative to its earnings growth." };
  if (peg <= 1.5) return { label: "Fairly valued", color: "#d97706", theory: "PEG between 1-1.5 suggests fair valuation. The market is pricing in expected growth." };
  if (peg <= 2) return { label: "Mildly overvalued", color: "#f59e0b", theory: "PEG > 1.5 may indicate the market expects above-average growth, or the stock is slightly expensive." };
  return { label: "Overvalued", color: "#dc2626", theory: "PEG > 2 suggests the stock is expensive relative to its growth rate. Warren Buffett and Lynch would likely avoid." };
}

export function marginOfSafety(currentPrice: number, intrinsic: number | null): { pct: number; label: string; color: string } | null {
  if (intrinsic == null || intrinsic <= 0) return null;
  const pct = ((intrinsic - currentPrice) / intrinsic) * 100;
  const label = pct > 30 ? "Strong margin of safety (>30%)" :
    pct > 15 ? "Moderate margin of safety" :
      pct > 0 ? "Slim margin of safety" :
        "No margin of safety — trading above intrinsic value";
  const color = pct > 30 ? "#059669" : pct > 15 ? "#34d399" : pct > 0 ? "#d97706" : "#dc2626";
  return { pct: Math.round(pct * 10) / 10, label, color };
}
