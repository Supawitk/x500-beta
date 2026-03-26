import { useRef, useEffect, useState, useCallback } from "react";
import type { AnalysisDataPoint } from "../../api/analysis";

interface Props {
  data: AnalysisDataPoint[];
}

type AxisKey = "rsi" | "macdHist" | "stochK" | "volume" | "momentum" | "volatility" | "emaSpread" | "close";

const AXIS_OPTIONS: { key: AxisKey; label: string }[] = [
  { key: "rsi", label: "RSI" },
  { key: "macdHist", label: "MACD Hist" },
  { key: "stochK", label: "Stochastic %K" },
  { key: "volume", label: "Volume Chg" },
  { key: "momentum", label: "Momentum" },
  { key: "volatility", label: "Volatility" },
  { key: "emaSpread", label: "EMA Spread" },
  { key: "close", label: "Price" },
];

interface Point3D { x: number; y: number; z: number; color: string; size: number; date: string; ret: number; raw: number[] }

function extractValue(d: AnalysisDataPoint, key: AxisKey, i: number, data: AnalysisDataPoint[]): number | null {
  switch (key) {
    case "rsi": return d.rsi;
    case "macdHist": return d.macdHist;
    case "stochK": return d.stochK;
    case "volume": return i > 0 && data[i - 1].volume > 0 ? (d.volume / data[i - 1].volume - 1) * 100 : null;
    case "momentum": return i >= 5 ? ((d.close / data[i - 5].close) - 1) * 100 : null;
    case "volatility": {
      if (i < 10) return null;
      const rets = [];
      for (let j = i - 9; j <= i; j++) rets.push(Math.log(data[j].close / data[j - 1].close));
      const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
      return Math.sqrt(rets.reduce((a, b) => a + (b - mu) ** 2, 0) / rets.length) * Math.sqrt(252) * 100;
    }
    case "emaSpread": return d.ema12 && d.ema26 ? ((d.ema12 / d.ema26) - 1) * 100 : null;
    case "close": return d.close;
  }
}

function normalize(vals: (number | null)[]): number[] {
  const valid = vals.filter((v): v is number => v !== null);
  if (valid.length === 0) return vals.map(() => 0);
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 1;
  return vals.map(v => v === null ? 0 : (v - min) / range);
}

function retColor(ret: number): string {
  if (ret > 2) return "#059669";
  if (ret > 0.5) return "#34d399";
  if (ret > -0.5) return "#d97706";
  if (ret > -2) return "#f87171";
  return "#dc2626";
}

export function ThreeDChart({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [axisX, setAxisX] = useState<AxisKey>("rsi");
  const [axisY, setAxisY] = useState<AxisKey>("macdHist");
  const [axisZ, setAxisZ] = useState<AxisKey>("momentum");
  const [rotX, setRotX] = useState(-0.5);
  const [rotY, setRotY] = useState(0.6);
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const projRef = useRef<{ px: number; py: number; idx: number }[]>([]);

  const buildPoints = useCallback((): Point3D[] => {
    if (data.length < 12) return [];
    const xVals = data.map((d, i) => extractValue(d, axisX, i, data));
    const yVals = data.map((d, i) => extractValue(d, axisY, i, data));
    const zVals = data.map((d, i) => extractValue(d, axisZ, i, data));
    const xNorm = normalize(xVals);
    const yNorm = normalize(yVals);
    const zNorm = normalize(zVals);

    const pts: Point3D[] = [];
    for (let i = 0; i < data.length - 1; i++) {
      if (xVals[i] === null || yVals[i] === null || zVals[i] === null) continue;
      const ret = ((data[Math.min(i + 1, data.length - 1)].close / data[i].close) - 1) * 100;
      pts.push({
        x: xNorm[i] * 2 - 1, y: yNorm[i] * 2 - 1, z: zNorm[i] * 2 - 1,
        color: retColor(ret), size: 3 + Math.min(Math.abs(ret) * 1.5, 5),
        date: data[i].date, ret: Math.round(ret * 100) / 100,
        raw: [xVals[i]!, yVals[i]!, zVals[i]!],
      });
    }
    return pts;
  }, [data, axisX, axisY, axisZ]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 0.32;
    const focalLen = 4;

    ctx.clearRect(0, 0, W, H);

    // Rotation matrices
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

    const project = (x: number, y: number, z: number): [number, number, number] => {
      // Rotate Y
      let x1 = x * cosY + z * sinY, z1 = -x * sinY + z * cosY;
      // Rotate X
      let y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
      const perspective = focalLen / (focalLen + z2);
      return [cx + x1 * scale * perspective, cy - y1 * scale * perspective, z2];
    };

    // Grid lines on the back planes
    ctx.strokeStyle = "rgba(100,100,120,0.12)";
    ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i += 0.5) {
      // XY plane at z=-1
      ctx.beginPath();
      let [px1, py1] = project(i, -1, -1), [px2, py2] = project(i, 1, -1);
      ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      ctx.beginPath();
      [px1, py1] = project(-1, i, -1); [px2, py2] = project(1, i, -1);
      ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      // XZ plane at y=-1
      ctx.beginPath();
      [px1, py1] = project(i, -1, -1); [px2, py2] = project(i, -1, 1);
      ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      ctx.beginPath();
      [px1, py1] = project(-1, -1, i); [px2, py2] = project(1, -1, i);
      ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      // YZ plane at x=-1
      ctx.beginPath();
      [px1, py1] = project(-1, i, -1); [px2, py2] = project(-1, i, 1);
      ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      ctx.beginPath();
      [px1, py1] = project(-1, -1, i); [px2, py2] = project(-1, 1, i);
      ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
    }

    // Axes
    const axes = [
      { from: [-1, -1, -1], to: [1.15, -1, -1], label: AXIS_OPTIONS.find(a => a.key === axisX)!.label, color: "#4f46e5" },
      { from: [-1, -1, -1], to: [-1, 1.15, -1], label: AXIS_OPTIONS.find(a => a.key === axisY)!.label, color: "#059669" },
      { from: [-1, -1, -1], to: [-1, -1, 1.15], label: AXIS_OPTIONS.find(a => a.key === axisZ)!.label, color: "#dc2626" },
    ];
    for (const ax of axes) {
      const [x1, y1] = project(ax.from[0], ax.from[1], ax.from[2]);
      const [x2, y2] = project(ax.to[0], ax.to[1], ax.to[2]);
      ctx.strokeStyle = ax.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      // Arrow
      const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len, uy = dy / len;
      ctx.fillStyle = ax.color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - ux * 8 + uy * 4, y2 - uy * 8 - ux * 4);
      ctx.lineTo(x2 - ux * 8 - uy * 4, y2 - uy * 8 + ux * 4);
      ctx.closePath(); ctx.fill();
      // Label
      ctx.font = "bold 11px Inter, system-ui";
      ctx.fillStyle = ax.color;
      ctx.textAlign = "center";
      ctx.fillText(ax.label, x2 + ux * 16, y2 + uy * 16);
    }

    // Points — sort by z (back to front)
    const points = pointsRef.current;
    const projected: { px: number; py: number; z: number; idx: number }[] = points.map((p, idx) => {
      const [px, py, z] = project(p.x, p.y, p.z);
      return { px, py, z, idx };
    });
    projected.sort((a, b) => b.z - a.z); // back first
    projRef.current = projected;

    for (const pr of projected) {
      const p = points[pr.idx];
      const perspective = focalLen / (focalLen + pr.z);
      const r = p.size * perspective;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pr.px, pr.py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Legend
    const legendY = H - 50;
    ctx.font = "10px Inter, system-ui";
    ctx.textAlign = "left";
    const legendItems = [
      { color: "#059669", label: ">+2%" }, { color: "#34d399", label: "+0.5~2%" },
      { color: "#d97706", label: "~0%" }, { color: "#f87171", label: "-0.5~-2%" },
      { color: "#dc2626", label: "<-2%" },
    ];
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(8, legendY - 4, 240, 40);
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Next-day return:", 12, legendY + 8);
    let lx = 12;
    for (const li of legendItems) {
      ctx.fillStyle = li.color;
      ctx.fillRect(lx, legendY + 14, 10, 10);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(li.label, lx + 13, legendY + 23);
      lx += 45;
    }

    // Info
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px Inter";
    ctx.textAlign = "right";
    ctx.fillText(`${points.length} data points | drag to rotate`, W - 8, H - 8);
  }, [rotX, rotY, axisX, axisY, axisZ]);

  useEffect(() => {
    pointsRef.current = buildPoints();
    render();
  }, [buildPoints, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 420;
      render();
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [render]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (d.dragging) {
      setRotY(prev => prev + (e.clientX - d.lastX) * 0.008);
      setRotX(prev => Math.max(-1.2, Math.min(1.2, prev + (e.clientY - d.lastY) * 0.008)));
      d.lastX = e.clientX; d.lastY = e.clientY;
    } else {
      // Hover tooltip
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let closest: { dist: number; idx: number } | null = null;
      for (const pr of projRef.current) {
        const dist = Math.sqrt((pr.px - mx) ** 2 + (pr.py - my) ** 2);
        if (dist < 10 && (!closest || dist < closest.dist)) closest = { dist, idx: pr.idx };
      }
      if (closest) {
        const p = pointsRef.current[closest.idx];
        const xLabel = AXIS_OPTIONS.find(a => a.key === axisX)!.label;
        const yLabel = AXIS_OPTIONS.find(a => a.key === axisY)!.label;
        const zLabel = AXIS_OPTIONS.find(a => a.key === axisZ)!.label;
        setTooltip({
          x: e.clientX - rect.left, y: e.clientY - rect.top,
          text: `${p.date}\n${xLabel}: ${p.raw[0].toFixed(2)} | ${yLabel}: ${p.raw[1].toFixed(2)} | ${zLabel}: ${p.raw[2].toFixed(2)}\nNext-day: ${p.ret > 0 ? "+" : ""}${p.ret}%`,
        });
      } else {
        setTooltip(null);
      }
    }
  };
  const onMouseUp = () => { dragRef.current.dragging = false; };

  return (
    <div className="threed-chart-wrap">
      <div className="threed-axis-selectors">
        {[
          { label: "X", color: "#4f46e5", val: axisX, set: setAxisX },
          { label: "Y", color: "#059669", val: axisY, set: setAxisY },
          { label: "Z", color: "#dc2626", val: axisZ, set: setAxisZ },
        ].map(a => (
          <label key={a.label} className="threed-axis-sel">
            <span style={{ color: a.color, fontWeight: 700 }}>{a.label}</span>
            <select value={a.val} onChange={e => a.set(e.target.value as AxisKey)}>
              {AXIS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="threed-canvas-container" style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={600} height={420}
          style={{ cursor: dragRef.current.dragging ? "grabbing" : "grab", width: "100%", height: 420 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { dragRef.current.dragging = false; setTooltip(null); }}
        />
        {tooltip && (
          <div className="threed-tooltip" style={{
            left: tooltip.x + 12, top: tooltip.y - 10,
            position: "absolute", pointerEvents: "none",
          }}>
            {tooltip.text.split("\n").map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
      <p className="threed-note">
        Each point = 1 trading day. Position determined by 3 indicator axes. Color = next-day return direction and magnitude.
        Clusters of green points indicate indicator combinations that preceded positive returns.
      </p>
    </div>
  );
}
