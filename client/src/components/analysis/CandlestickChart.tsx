import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart, type IChartApi, ColorType,
  CandlestickSeries, HistogramSeries, LineSeries,
  createSeriesMarkers,
} from "lightweight-charts";
import { Card } from "../common/Card";
import type { AnalysisDataPoint } from "../../api/analysis";
import { Minus, TrendingUp, Square, Type, Move, RotateCcw, Trash2, Save, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";

export interface NewsMarker {
  date: string;
  title: string;
  link?: string | null;
}

interface Props {
  data: AnalysisDataPoint[];
  symbol: string;
  newsMarkers?: NewsMarker[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidOHLC(d: AnalysisDataPoint): boolean {
  return (
    DATE_RE.test(d.date) &&
    isFinite(d.open) && d.open > 0 &&
    isFinite(d.high) && d.high > 0 &&
    isFinite(d.low) && d.low > 0 &&
    isFinite(d.close) && d.close > 0 &&
    d.high >= d.low &&
    d.high >= d.open &&
    d.high >= d.close &&
    d.low <= d.open &&
    d.low <= d.close
  );
}

function prepareData(data: AnalysisDataPoint[]) {
  const map = new Map<string, AnalysisDataPoint>();
  for (const d of data) {
    if (isValidOHLC(d)) map.set(d.date, d);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Drawing types ──
type Tool = "none" | "hline" | "trendline" | "rectangle" | "text" | "fib";
interface Point { x: number; y: number }
interface Drawing {
  id: string;
  tool: Exclude<Tool, "none">;
  start: Point;
  end: Point;
  text?: string;
  color: string;
  lineWidth: number;
  // Price-based coords for persistence
  priceStart?: { time: string; price: number };
  priceEnd?: { time: string; price: number };
}

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#0891b2", "#7c3aed", "#1f2937"];
const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#6b7280", "#059669", "#10b981", "#d97706", "#f59e0b", "#ef4444", "#6b7280"];
const TOOL_META: { tool: Tool; label: string; icon: any; tip: string }[] = [
  { tool: "hline", icon: Minus, label: "H-Line", tip: "Horizontal support/resistance line" },
  { tool: "trendline", icon: TrendingUp, label: "Trend", tip: "Diagonal trendline with arrow" },
  { tool: "rectangle", icon: Square, label: "Rect", tip: "Highlight a price/time zone" },
  { tool: "text", icon: Type, label: "Text", tip: "Add a text label" },
  { tool: "fib", icon: Move, label: "Fib", tip: "Fibonacci retracement levels" },
];

function uid() { return Math.random().toString(36).slice(2); }

function renderDrawing(ctx: CanvasRenderingContext2D, d: Drawing, w: number) {
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = d.lineWidth;
  ctx.setLineDash([]);
  if (d.tool === "hline") {
    ctx.beginPath(); ctx.moveTo(0, d.start.y); ctx.lineTo(w, d.start.y); ctx.stroke();
    ctx.font = "11px monospace"; ctx.fillText(`${d.text || ""}`, 4, d.start.y - 3);
  } else if (d.tool === "trendline") {
    ctx.beginPath(); ctx.moveTo(d.start.x, d.start.y); ctx.lineTo(d.end.x, d.end.y); ctx.stroke();
    const angle = Math.atan2(d.end.y - d.start.y, d.end.x - d.start.x);
    ctx.beginPath();
    ctx.moveTo(d.end.x - 10 * Math.cos(angle - 0.4), d.end.y - 10 * Math.sin(angle - 0.4));
    ctx.lineTo(d.end.x, d.end.y);
    ctx.lineTo(d.end.x - 10 * Math.cos(angle + 0.4), d.end.y - 10 * Math.sin(angle + 0.4));
    ctx.stroke();
  } else if (d.tool === "rectangle") {
    ctx.strokeRect(d.start.x, d.start.y, d.end.x - d.start.x, d.end.y - d.start.y);
    ctx.globalAlpha = 0.06;
    ctx.fillRect(d.start.x, d.start.y, d.end.x - d.start.x, d.end.y - d.start.y);
    ctx.globalAlpha = 1;
  } else if (d.tool === "text") {
    ctx.font = "bold 13px Inter, system-ui, sans-serif";
    ctx.fillText(d.text || "Label", d.start.x, d.start.y);
  } else if (d.tool === "fib") {
    const y1 = Math.min(d.start.y, d.end.y), y2 = Math.max(d.start.y, d.end.y), span = y2 - y1;
    FIB_RATIOS.forEach((r, i) => {
      const y = y2 - span * r;
      ctx.strokeStyle = FIB_COLORS[i]; ctx.fillStyle = FIB_COLORS[i];
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(d.start.x, y); ctx.lineTo(w - 4, y); ctx.stroke();
      ctx.setLineDash([]); ctx.font = "10px monospace";
      ctx.fillText(`${(r * 100).toFixed(1)}%`, w - 50, y - 2);
    });
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth;
  }
}

function redrawAll(ctx: CanvasRenderingContext2D, drawings: Drawing[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  drawings.forEach(d => renderDrawing(ctx, d, w));
}

function saveKey(symbol: string) { return `drawings_${symbol}`; }

export function CandlestickChart({ data, symbol, newsMarkers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState(COLORS[0]);
  const [lineW, setLineW] = useState(1.5);
  const [drawing, setDrawing] = useState<Partial<Drawing> | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [mousePos, setMousePos] = useState<Point | null>(null);

  // Load saved drawings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(saveKey(symbol));
      if (saved) setDrawings(JSON.parse(saved));
      else setDrawings([]);
    } catch { setDrawings([]); }
  }, [symbol]);

  // Create chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length < 2) return;
    if (el.clientWidth === 0) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* ok */ }
      chartRef.current = null;
    }

    const clean = prepareData(data);
    if (clean.length < 2) return;

    let chart: IChartApi;
    try {
      chart = createChart(el, {
        layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#6b7280", fontSize: 11 },
        grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
        width: el.clientWidth, height: 400,
        crosshair: { mode: 0 },
        timeScale: { borderColor: "#e5e7eb", timeVisible: false },
        rightPriceScale: { borderColor: "#e5e7eb" },
      });
    } catch { return; }
    chartRef.current = chart;

    try {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: "#059669", downColor: "#dc2626",
        borderDownColor: "#dc2626", borderUpColor: "#059669",
        wickDownColor: "#dc2626", wickUpColor: "#059669",
      });
      candles.setData(clean.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })));

      // News markers on chart
      if (newsMarkers && newsMarkers.length > 0) {
        const dateSet = new Set(clean.map(d => d.date));
        const markers = newsMarkers
          .filter(m => dateSet.has(m.date))
          .reduce((acc, m) => {
            // Deduplicate by date — combine titles
            const existing = acc.find(a => a.time === m.date);
            if (existing) {
              existing.text = `${existing.text} +${acc.filter(a => a.time === m.date).length}`;
            } else {
              acc.push({
                time: m.date,
                position: "belowBar" as const,
                color: "#4f46e5",
                shape: "arrowUp" as const,
                text: m.title.length > 30 ? m.title.slice(0, 28) + "..." : m.title,
              });
            }
            return acc;
          }, [] as { time: string; position: "belowBar"; color: string; shape: "arrowUp"; text: string }[])
          .sort((a, b) => a.time.localeCompare(b.time));

        if (markers.length > 0) {
          createSeriesMarkers(candles, markers);
        }
      }

      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volume.setData(clean.map(d => ({ time: d.date, value: d.volume, color: d.close >= d.open ? "#dcfce7" : "#fee2e2" })));

      const ema12Data = clean.filter(d => d.ema12 !== null);
      if (ema12Data.length > 1) {
        const ema12 = chart.addSeries(LineSeries, { color: "#4f46e5", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        ema12.setData(ema12Data.map(d => ({ time: d.date, value: d.ema12! })));
      }
      const ema50Data = clean.filter(d => d.ema50 !== null);
      if (ema50Data.length > 1) {
        const ema50 = chart.addSeries(LineSeries, { color: "#d97706", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        ema50.setData(ema50Data.map(d => ({ time: d.date, value: d.ema50! })));
      }
      chart.timeScale().fitContent();
    } catch { /* ok */ }

    const ro = new ResizeObserver(() => {
      if (el && chartRef.current && el.clientWidth > 0) {
        chartRef.current.applyOptions({ width: el.clientWidth });
        // Resize overlay too
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.width = el.clientWidth;
          overlay.height = 400;
          const ctx = overlay.getContext("2d");
          if (ctx) redrawAll(ctx, drawings, overlay.width, overlay.height);
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch { /* ok */ }
      chartRef.current = null;
    };
  }, [data, symbol, newsMarkers]); // eslint-disable-line

  // Redraw overlay when drawings change
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (ctx) redrawAll(ctx, drawings, overlay.width, overlay.height);
  }, [drawings]);

  // Init overlay size
  useEffect(() => {
    const el = containerRef.current;
    const overlay = overlayRef.current;
    if (el && overlay) {
      overlay.width = el.clientWidth;
      overlay.height = 400;
    }
  }, [data]);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const addDrawing = useCallback((d: Drawing) => {
    const newDs = [...drawings, d];
    setDrawings(newDs);
    try { localStorage.setItem(saveKey(symbol), JSON.stringify(newDs)); } catch { /* ok */ }
  }, [drawings, symbol]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "none") return;
    const pos = getPos(e);
    if (tool === "text") {
      const label = prompt("Enter label text:", "Target");
      if (!label) return;
      addDrawing({ id: uid(), tool: "text", start: pos, end: pos, text: label, color, lineWidth: lineW });
      return;
    }
    if (tool === "hline") {
      const label = prompt("Label (e.g. $185):", "");
      addDrawing({ id: uid(), tool: "hline", start: pos, end: pos, text: label || "", color, lineWidth: lineW });
      return;
    }
    setDrawing({ id: uid(), tool, start: pos, end: pos, color, lineWidth: lineW });
  }, [tool, color, lineW, getPos, addDrawing]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    setMousePos(pos);
    if (!drawing || !overlayRef.current) return;
    const d = { ...drawing, end: pos } as Drawing;
    const ctx = overlayRef.current.getContext("2d");
    if (!ctx) return;
    redrawAll(ctx, drawings, overlayRef.current.width, overlayRef.current.height);
    ctx.setLineDash([4, 3]);
    renderDrawing(ctx, d, overlayRef.current.width);
    ctx.setLineDash([]);
  }, [drawing, drawings, getPos]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const pos = getPos(e);
    const d = { ...drawing, end: pos } as Drawing;
    addDrawing(d);
    setDrawing(null);
  }, [drawing, getPos, addDrawing]);

  const undoLast = () => {
    const newDs = drawings.slice(0, -1);
    setDrawings(newDs);
    try { localStorage.setItem(saveKey(symbol), JSON.stringify(newDs)); } catch { /* ok */ }
  };

  const clearAll = () => {
    setDrawings([]);
    try { localStorage.removeItem(saveKey(symbol)); } catch { /* ok */ }
    const ctx = overlayRef.current?.getContext("2d");
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
  };

  const deleteDrawing = (id: string) => {
    const newDs = drawings.filter(d => d.id !== id);
    setDrawings(newDs);
    try { localStorage.setItem(saveKey(symbol), JSON.stringify(newDs)); } catch { /* ok */ }
  };

  const cursor = tool === "none" ? "default" : tool === "text" ? "text" : tool === "hline" ? "row-resize" : "crosshair";

  if (data.length < 2) {
    return <Card title={`${symbol} Candlestick Chart`}><p className="text-muted">Loading chart data...</p></Card>;
  }

  return (
    <Card title={`${symbol} Candlestick Chart`}>
      {/* Drawing toolbar */}
      <div className="draw-toolbar-inline">
        <button className="draw-toggle-btn" onClick={() => setShowTools(!showTools)} title="Toggle drawing tools">
          <TrendingUp size={13} />
          <span>Draw</span>
          {showTools ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showTools && (
          <>
            <div className="draw-tools-row">
              <button className={`draw-tool-btn-sm ${tool === "none" ? "active" : ""}`} onClick={() => setTool("none")} title="Pan (no draw)">
                <Move size={12} />
              </button>
              {TOOL_META.map(({ tool: t, label, icon: Icon, tip }) => (
                <button key={t} className={`draw-tool-btn-sm ${tool === t ? "active" : ""}`} onClick={() => setTool(t)} title={tip}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
            <div className="draw-colors-row">
              {COLORS.map(c => (
                <button key={c} className={`draw-color-dot ${color === c ? "active" : ""}`}
                        style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <select className="draw-width-sel" value={lineW} onChange={e => setLineW(Number(e.target.value))}>
              <option value={1}>Thin</option><option value={1.5}>Normal</option><option value={2.5}>Thick</option><option value={4}>Heavy</option>
            </select>
            <button className="draw-action-sm" onClick={undoLast} disabled={drawings.length === 0} title="Undo"><RotateCcw size={12} /></button>
            <button className="draw-action-sm" onClick={clearAll} disabled={drawings.length === 0} title="Clear all"><Trash2 size={12} /></button>
            <span className="text-muted text-sm draw-count">{drawings.length} saved</span>
          </>
        )}
      </div>

      {/* Chart + overlay */}
      <div className="candle-chart-wrapper" style={{ position: "relative" }}>
        <div ref={containerRef} className="candlestick-container" />
        <canvas
          ref={overlayRef}
          className="draw-overlay"
          style={{ cursor, pointerEvents: tool === "none" ? "none" : "auto" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setMousePos(null); if (drawing) setDrawing(null); }}
        />
        {mousePos && tool !== "none" && (
          <div className="draw-coords-overlay">x:{Math.round(mousePos.x)} y:{Math.round(mousePos.y)}</div>
        )}
      </div>

      {/* Drawing hint */}
      {tool !== "none" && (
        <div className="draw-hint-bar">
          {tool === "hline" && "Click to place a horizontal level"}
          {tool === "trendline" && "Click and drag to draw a trendline"}
          {tool === "rectangle" && "Click and drag to highlight a zone"}
          {tool === "text" && "Click to place a text label"}
          {tool === "fib" && "Click and drag from high to low for Fibonacci"}
        </div>
      )}

      {/* Drawing list */}
      {drawings.length > 0 && showTools && (
        <div className="draw-list-inline">
          {drawings.map((d, i) => (
            <span key={d.id} className="draw-list-chip">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
              <span className="text-muted" style={{ fontSize: 10 }}>{i + 1}.{d.tool}{d.text ? ` "${d.text}"` : ""}</span>
              <button className="draw-chip-del" onClick={() => deleteDrawing(d.id)}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="candle-legend">
        <span><span className="legend-dot" style={{ background: "#4f46e5" }} /> EMA 12</span>
        <span><span className="legend-dot" style={{ background: "#d97706" }} /> EMA 50</span>
        <span><span className="legend-dot" style={{ background: "#059669" }} /> Bullish</span>
        <span><span className="legend-dot" style={{ background: "#dc2626" }} /> Bearish</span>
      </div>
    </Card>
  );
}
