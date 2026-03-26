import {
  TrendingUp, TrendingDown, Building2, BarChart3,
} from "lucide-react";
import type { StockDetail, AnalysisDataPoint, SignalSummary } from "../../api/analysis";

interface Props {
  symbol: string;
  detail: StockDetail;
  lastPoint: AnalysisDataPoint | undefined;
  signals: SignalSummary;
}

function fmtB(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function signalColor(signal: string): string {
  if (signal.includes("Bullish") || signal.includes("Oversold") || signal.includes("Above")) return "var(--green)";
  if (signal.includes("Bearish") || signal.includes("Overbought") || signal.includes("Below")) return "var(--red)";
  return "var(--text-muted)";
}

export function StockInfoHeader({ symbol, detail, lastPoint, signals }: Props) {
  const price = lastPoint?.close ?? 0;
  const d = detail;

  const range52 = d.fiftyTwoWeekHigh && d.fiftyTwoWeekLow
    ? ((price - d.fiftyTwoWeekLow) / (d.fiftyTwoWeekHigh - d.fiftyTwoWeekLow)) * 100
    : null;

  return (
    <div className="sih-container">
      {/* Left: symbol + price */}
      <div className="sih-main">
        <div className="sih-sym-row">
          <span className="sih-symbol">{symbol}</span>
          {d.sector && (
            <span className="sih-sector"><Building2 size={11} /> {d.sector}</span>
          )}
          {d.industry && <span className="sih-industry">{d.industry}</span>}
        </div>
        <div className="sih-price-row">
          <span className="sih-price">${price.toFixed(2)}</span>
          {d.fiftyTwoWeekChange != null && (
            <span className={`sih-change ${d.fiftyTwoWeekChange >= 0 ? "text-green" : "text-red"}`}>
              {d.fiftyTwoWeekChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {(d.fiftyTwoWeekChange * 100).toFixed(1)}% (52W)
            </span>
          )}
        </div>
        {/* 52W range bar */}
        {range52 != null && (
          <div className="sih-range">
            <span className="sih-range-label">${fmt(d.fiftyTwoWeekLow)}</span>
            <div className="sih-range-bar">
              <div className="sih-range-fill" style={{ width: `${Math.max(0, Math.min(100, range52))}%` }} />
              <div className="sih-range-dot" style={{ left: `${Math.max(0, Math.min(100, range52))}%` }} />
            </div>
            <span className="sih-range-label">${fmt(d.fiftyTwoWeekHigh)}</span>
          </div>
        )}
      </div>

      {/* Key metrics */}
      <div className="sih-metrics">
        <div className="sih-metric">
          <span className="sih-m-label">Market Cap</span>
          <span className="sih-m-val">{fmtB(d.marketCap)}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">P/E (TTM)</span>
          <span className="sih-m-val">{fmt(d.trailingPE)}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">Fwd P/E</span>
          <span className="sih-m-val">{fmt(d.forwardPE)}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">EPS (TTM)</span>
          <span className="sih-m-val">${fmt(d.trailingEps)}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">Div Yield</span>
          <span className="sih-m-val">{d.dividendYield ? fmtPct(d.dividendYield) : "—"}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">Beta</span>
          <span className="sih-m-val">{fmt(d.beta)}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">50D Avg</span>
          <span className="sih-m-val">${fmt(d.fiftyDayAverage)}</span>
        </div>
        <div className="sih-metric">
          <span className="sih-m-label">200D Avg</span>
          <span className="sih-m-val">${fmt(d.twoHundredDayAverage)}</span>
        </div>
      </div>

      {/* Signals strip */}
      <div className="sih-signals">
        <BarChart3 size={13} />
        <span className="sih-sig" style={{ color: signalColor(signals.overall) }}>{signals.overall}</span>
        <span className="sih-sig-sep">|</span>
        <span className="sih-sig-label">EMA</span>
        <span className="sih-sig" style={{ color: signalColor(signals.emaSignal) }}>{signals.emaSignal}</span>
        <span className="sih-sig-sep">|</span>
        <span className="sih-sig-label">RSI</span>
        <span className="sih-sig" style={{ color: signalColor(signals.rsiSignal) }}>{signals.rsiSignal}</span>
        <span className="sih-sig-sep">|</span>
        <span className="sih-sig-label">MACD</span>
        <span className="sih-sig" style={{ color: signalColor(signals.macdSignal) }}>{signals.macdSignal}</span>
        {signals.ichimokuSignal && signals.ichimokuSignal !== "N/A" && (
          <>
            <span className="sih-sig-sep">|</span>
            <span className="sih-sig-label">Ichimoku</span>
            <span className="sih-sig" style={{ color: signalColor(signals.ichimokuSignal) }}>{signals.ichimokuSignal}</span>
          </>
        )}
      </div>
    </div>
  );
}
