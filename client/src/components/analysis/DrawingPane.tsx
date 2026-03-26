import { useRef, useState, useEffect, useCallback } from "react";
import { Minus, TrendingUp, Square, Type, Trash2, RotateCcw, ChevronDown, ChevronUp, Move } from "lucide-react";

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
}

const COLORS = ["#4f46e5", "#dc2626", "#059669", "#d97706", "#0891b2", "#7c3aed", "#1f2937"];
const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#6b7280", "#059669", "#10b981", "#d97706", "#f59e0b", "#ef4444", "#6b7280"];

function uid() { return Math.random().toString(36).slice(2); }

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 10;
  ctx.beginPath();
  ctx.moveTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
  ctx.stroke();
}

function renderDrawing(ctx: CanvasRenderingContext2D, d: Drawing, canvas: HTMLCanvasElement) {
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = d.lineWidth;
  ctx.setLineDash([]);

  if (d.tool === "hline") {
    ctx.beginPath();
    ctx.moveTo(0, d.start.y);
    ctx.lineTo(canvas.width, d.start.y);
    ctx.stroke();
    ctx.font = "11px monospace";
    ctx.fillText(`—  ${ d.text || "" }`, 4, d.start.y - 3);
  }
  else if (d.tool === "trendline") {
    ctx.beginPath();
    ctx.moveTo(d.start.x, d.start.y);
    ctx.lineTo(d.end.x, d.end.y);
    ctx.stroke();
    drawArrow(ctx, d.start.x, d.start.y, d.end.x, d.end.y);
  }
  else if (d.tool === "rectangle") {
    ctx.strokeRect(d.start.x, d.start.y, d.end.x - d.start.x, d.end.y - d.start.y);
    ctx.globalAlpha = 0.06;
    ctx.fillRect(d.start.x, d.start.y, d.end.x - d.start.x, d.end.y - d.start.y);
    ctx.globalAlpha = 1;
  }
  else if (d.tool === "text") {
    ctx.font = "bold 13px Inter, system-ui, sans-serif";
    ctx.fillText(d.text || "Label", d.start.x, d.start.y);
  }
  else if (d.tool === "fib") {
    const y1 = Math.min(d.start.y, d.end.y);
    const y2 = Math.max(d.start.y, d.end.y);
    const span = y2 - y1;
    FIB_RATIOS.forEach((r, i) => {
      const y = y2 - span * r;
      ctx.strokeStyle = FIB_COLORS[i];
      ctx.fillStyle   = FIB_COLORS[i];
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.start.x, y);
      ctx.lineTo(canvas.width - 4, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "10px monospace";
      ctx.fillText(`${(r * 100).toFixed(1)}%`, canvas.width - 50, y - 2);
    });
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth;
  }
}

function redrawAll(ctx: CanvasRenderingContext2D, drawings: Drawing[], canvas: HTMLCanvasElement) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawings.forEach((d) => renderDrawing(ctx, d, canvas));
}

const TOOL_META: { tool: Tool; label: string; icon: any; tip: string }[] = [
  { tool: "hline",     icon: Minus,     label: "H-Line",   tip: "Horizontal support/resistance line" },
  { tool: "trendline", icon: TrendingUp, label: "Trendline", tip: "Diagonal trendline with arrow" },
  { tool: "rectangle", icon: Square,     label: "Rectangle", tip: "Highlight a price/time zone" },
  { tool: "text",      icon: Type,       label: "Text",      tip: "Add a text label" },
  { tool: "fib",       icon: Move,       label: "Fibonacci",  tip: "Draw Fibonacci retracement levels" },
];

export function DrawingPane() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings]   = useState<Drawing[]>([]);
  const [tool, setTool]           = useState<Tool>("none");
  const [color, setColor]         = useState(COLORS[0]);
  const [lineW, setLineW]         = useState(1.5);
  const [open, setOpen]           = useState(false);
  const [drawing, setDrawing]     = useState<Partial<Drawing> | null>(null);
  const [mousePos, setMousePos]   = useState<Point | null>(null);

  // resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) redrawAll(ctx, drawings, canvas);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawings]);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "none") return;
    const pos = getPos(e);
    if (tool === "text") {
      const label = prompt("Enter label text:", "Target");
      if (!label) return;
      const d: Drawing = { id: uid(), tool: "text", start: pos, end: pos, text: label, color, lineWidth: lineW };
      const newDs = [...drawings, d];
      setDrawings(newDs);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) redrawAll(ctx, newDs, canvasRef.current!);
      return;
    }
    if (tool === "hline") {
      const label = prompt("Label for this level (optional, e.g. $185):", "");
      const d: Drawing = { id: uid(), tool: "hline", start: pos, end: pos, text: label || "", color, lineWidth: lineW };
      const newDs = [...drawings, d];
      setDrawings(newDs);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) redrawAll(ctx, newDs, canvasRef.current!);
      return;
    }
    setDrawing({ id: uid(), tool, start: pos, end: pos, color, lineWidth: lineW });
  }, [tool, color, lineW, drawings, getPos]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    setMousePos(pos);
    if (!drawing || !canvasRef.current) return;
    const d = { ...drawing, end: pos } as Drawing;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    redrawAll(ctx, drawings, canvasRef.current);
    // draw preview
    ctx.setLineDash([4, 3]);
    renderDrawing(ctx, d, canvasRef.current);
    ctx.setLineDash([]);
  }, [drawing, drawings, getPos]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasRef.current) return;
    const pos = getPos(e);
    const d = { ...drawing, end: pos } as Drawing;
    const newDs = [...drawings, d];
    setDrawings(newDs);
    setDrawing(null);
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) redrawAll(ctx, newDs, canvasRef.current);
  }, [drawing, drawings, getPos]);

  const undoLast = () => {
    const newDs = drawings.slice(0, -1);
    setDrawings(newDs);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) redrawAll(ctx, newDs, canvasRef.current!);
  };

  const clearAll = () => {
    setDrawings([]);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  };

  const cursor = tool === "none" ? "default"
    : tool === "text" ? "text"
    : tool === "hline" ? "row-resize"
    : "crosshair";

  return (
    <div className="drawing-pane-wrapper">
      {/* Header / toggle */}
      <div className="drawing-header" onClick={() => setOpen((v) => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={15} style={{ color: "#4f46e5" }} />
          <span className="font-bold" style={{ fontSize: 13 }}>Drawing Tools</span>
          <span className="text-muted" style={{ fontSize: 11 }}>
            — overlay trend lines, levels & annotations on top of the chart
          </span>
        </div>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </div>

      {open && (
        <div className="drawing-body fade-in">
          {/* Toolbar */}
          <div className="drawing-toolbar">
            <div className="drawing-tools">
              <button
                className={`draw-tool-btn ${tool === "none" ? "active" : ""}`}
                onClick={() => setTool("none")}
                title="Select / Pan (no drawing)"
              >
                <Move size={14} /> Off
              </button>
              {TOOL_META.map(({ tool: t, label, icon: Icon, tip }) => (
                <button key={t}
                  className={`draw-tool-btn ${tool === t ? "active" : ""}`}
                  onClick={() => setTool(t)}
                  title={tip}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            <div className="drawing-options">
              {/* Color picker */}
              <div className="draw-colors">
                {COLORS.map((c) => (
                  <button key={c} className={`draw-color-btn ${color === c ? "active" : ""}`}
                    style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
              {/* Line width */}
              <select className="draw-select" value={lineW}
                onChange={(e) => setLineW(Number(e.target.value))}>
                <option value={1}>Thin</option>
                <option value={1.5}>Normal</option>
                <option value={2.5}>Thick</option>
                <option value={4}>Heavy</option>
              </select>
              {/* Actions */}
              <button className="draw-action-btn" onClick={undoLast} title="Undo last" disabled={drawings.length === 0}>
                <RotateCcw size={13} /> Undo
              </button>
              <button className="draw-action-btn draw-clear" onClick={clearAll} title="Clear all" disabled={drawings.length === 0}>
                <Trash2 size={13} /> Clear
              </button>
            </div>
          </div>

          {/* Tool hint */}
          {tool !== "none" && (
            <div className="drawing-hint">
              {tool === "hline" && "Click anywhere on the canvas to place a horizontal level line"}
              {tool === "trendline" && "Click and drag to draw a trendline with direction arrow"}
              {tool === "rectangle" && "Click and drag to highlight a price/time zone"}
              {tool === "text" && "Click to place a text annotation"}
              {tool === "fib" && "Click and drag from high to low (or low to high) to draw Fibonacci levels"}
            </div>
          )}

          {/* Canvas overlay */}
          <div className="drawing-canvas-wrap" style={{ height: 400 }}>
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
              style={{ cursor }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => { setMousePos(null); if (drawing) { setDrawing(null); } }}
            />
            {/* Crosshair coords */}
            {mousePos && tool !== "none" && (
              <div className="draw-coords">
                x: {Math.round(mousePos.x)}  y: {Math.round(mousePos.y)}
              </div>
            )}
            {drawings.length === 0 && tool === "none" && (
              <div className="drawing-empty">
                Select a tool above to start drawing on this canvas.<br />
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  Tip: Use H-Line for support/resistance, Trendline for price channels,
                  Fibonacci for retracement targets.
                </span>
              </div>
            )}
          </div>

          {/* Drawing list */}
          {drawings.length > 0 && (
            <div className="draw-list">
              <span className="metric-label">{drawings.length} annotation{drawings.length > 1 ? "s" : ""}</span>
              <div className="draw-list-items">
                {drawings.map((d, i) => (
                  <div key={d.id} className="draw-list-item">
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      {i + 1}. {d.tool}{d.text ? ` "${d.text}"` : ""}
                    </span>
                    <button className="draw-del-btn"
                      onClick={() => {
                        const nd = drawings.filter((x) => x.id !== d.id);
                        setDrawings(nd);
                        const ctx = canvasRef.current?.getContext("2d");
                        if (ctx) redrawAll(ctx, nd, canvasRef.current!);
                      }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
