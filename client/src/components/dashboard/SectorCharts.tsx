import { useState, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Card } from "../common/Card";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import type { SectorSummary, SectorPerformance } from "../../types/stock";

const COLORS = [
  "#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#db2777", "#0d9488", "#ca8a04", "#6366f1", "#84cc16",
];

interface Props {
  sectors: SectorSummary[];
  sectorPerformance: SectorPerformance[];
  onSelectStock: (symbol: string) => void;
}

function shortSector(name: string): string {
  const map: Record<string, string> = {
    "Information Technology": "Tech",
    "Communication Services": "Comms",
    "Consumer Discretionary": "Cons. Disc.",
    "Consumer Staples": "Cons. Stap.",
    "Health Care": "Healthcare",
    "Real Estate": "Real Est.",
    "Industrials": "Industrials",
    "Financials": "Financials",
    "Materials": "Materials",
    "Utilities": "Utilities",
    "Energy": "Energy",
  };
  return map[name] || name;
}

function fmtCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}B`;
  return `$${(cap / 1e6).toFixed(0)}M`;
}

/* ── 3D-style active shape — hover text shown OUTSIDE the ring ────── */
function ActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value, midAngle,
  } = props;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  // Position tooltip outside the pie
  const tx = cx + (outerRadius + 30) * cos;
  const ty = cy + (outerRadius + 30) * sin;
  const ex = tx + (cos >= 0 ? 20 : -20);
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* Shadow layer */}
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 12}
        startAngle={startAngle} endAngle={endAngle} fill="rgba(0,0,0,0.12)" />
      {/* Expanded slice */}
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: "brightness(1.1)", transition: "all 0.3s ease" }} />
      {/* Inner ring highlight */}
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={innerRadius + 4}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: "brightness(1.3)" }} />

      {/* Connector line from slice to label */}
      <path d={`M${cx + outerRadius * cos},${cy + outerRadius * sin}L${tx},${ty}L${ex},${ty}`}
        stroke={fill} strokeWidth={1.5} fill="none" />
      <circle cx={ex} cy={ty} r={3} fill={fill} />

      {/* External hover text */}
      <text x={ex + (cos >= 0 ? 8 : -8)} y={ty - 12} textAnchor={textAnchor}
        style={{ fontSize: 13, fontWeight: 700, fill: "var(--text)" }}>
        {payload.fullName}
      </text>
      <text x={ex + (cos >= 0 ? 8 : -8)} y={ty + 4} textAnchor={textAnchor}
        style={{ fontSize: 11, fill: "var(--text-muted)" }}>
        {value} stocks ({(percent * 100).toFixed(1)}%)
      </text>
      <text x={ex + (cos >= 0 ? 8 : -8)} y={ty + 18} textAnchor={textAnchor}
        style={{ fontSize: 10, fill: "var(--primary)", fontWeight: 600 }}>
        Click to explore
      </text>
    </g>
  );
}

/* ── Glassmorphic modal with sector detail ────────────────────────── */
function SectorModal({
  sector, color, sectorIndex, onClose, onSelectStock,
}: {
  sector: SectorPerformance;
  color: string;
  sectorIndex: number;
  onClose: () => void;
  onSelectStock: (s: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const sorted = [...sector.stocks].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter((s) => s.changePercent > 0);
  const losers = [...sorted].reverse().filter((s) => s.changePercent < 0);

  // Mini pie: market cap distribution by industry
  const industryMap = new Map<string, number>();
  for (const s of sector.stocks) {
    industryMap.set(s.industry, (industryMap.get(s.industry) || 0) + s.marketCap);
  }
  const industryPie = [...industryMap.entries()]
    .map(([name, cap]) => ({ name, value: cap }))
    .sort((a, b) => b.value - a.value);
  const totalCap = industryPie.reduce((a, b) => a + b.value, 0);

  return (
    <div className={`sector-modal-backdrop ${visible ? "sm-visible" : ""}`} onClick={handleClose}>
      <div className={`sector-modal ${visible ? "sm-card-visible" : ""}`}
        onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="sm-close" onClick={handleClose}><X size={18} /></button>

        {/* Header */}
        <div className="sm-header">
          <span className="sm-dot" style={{ background: color }} />
          <h2 className="sm-title">{sector.sector}</h2>
        </div>
        <div className="sm-meta">
          <span>{sector.count}/{sector.totalCount} stocks</span>
          <span className="sm-sep">|</span>
          <span>Avg {sector.avgChange >= 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%</span>
          <span className="sm-sep">|</span>
          <span>{fmtCap(sector.totalMarketCap)}</span>
          <span className="sm-sep">|</span>
          <span className="text-green"><TrendingUp size={12} /> {sector.advancers}</span>
          <span className="text-red"><TrendingDown size={12} /> {sector.decliners}</span>
        </div>

        {/* Body: mini pie + stock lists */}
        <div className="sm-body">
          {/* Mini pie: industry market cap distribution */}
          <div className="sm-pie-section">
            <h4 className="sm-section-title">Industry Market Cap Distribution</h4>
            <div className="sm-pie-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={industryPie} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={85} innerRadius={35}
                    animationDuration={500}>
                    {industryPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[(sectorIndex + i) % COLORS.length]}
                        stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={((v: any) => [`${fmtCap(Number(v))} (${((Number(v) / totalCap) * 100).toFixed(1)}%)`, "Market Cap"]) as any}
                    contentStyle={{
                      background: "rgba(30,30,40,0.9)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, fontSize: 11, color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="sm-pie-legend">
                {industryPie.slice(0, 8).map((ind, i) => (
                  <div key={ind.name} className="sm-legend-item">
                    <span className="sm-legend-dot" style={{ background: COLORS[(sectorIndex + i) % COLORS.length] }} />
                    <span className="sm-legend-name">{ind.name}</span>
                    <span className="sm-legend-pct">{((ind.value / totalCap) * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {industryPie.length > 8 && (
                  <div className="sm-legend-item text-muted">+{industryPie.length - 8} more</div>
                )}
              </div>
            </div>
          </div>

          {/* Stock lists */}
          <div className="sm-stocks">
            <div className="sm-stock-col">
              <h4 className="sm-col-title text-green"><TrendingUp size={14} /> Top Gainers</h4>
              <div className="sm-stock-list">
                {gainers.slice(0, 12).map((s) => (
                  <div key={s.symbol} className="sm-stock-row" onClick={() => onSelectStock(s.symbol)}>
                    <span className="sm-sym">{s.symbol}</span>
                    <span className="sm-sname">{s.name}</span>
                    <span className="sm-sprice">${s.price.toFixed(2)}</span>
                    <span className="text-green sm-schg">+{s.changePercent.toFixed(2)}%</span>
                    <span className="text-muted sm-scap">{fmtCap(s.marketCap)}</span>
                  </div>
                ))}
                {gainers.length === 0 && <div className="sm-empty text-muted">No gainers today</div>}
              </div>
            </div>
            <div className="sm-stock-col">
              <h4 className="sm-col-title text-red"><TrendingDown size={14} /> Top Losers</h4>
              <div className="sm-stock-list">
                {losers.slice(0, 12).map((s) => (
                  <div key={s.symbol} className="sm-stock-row" onClick={() => onSelectStock(s.symbol)}>
                    <span className="sm-sym">{s.symbol}</span>
                    <span className="sm-sname">{s.name}</span>
                    <span className="sm-sprice">${s.price.toFixed(2)}</span>
                    <span className="text-red sm-schg">{s.changePercent.toFixed(2)}%</span>
                    <span className="text-muted sm-scap">{fmtCap(s.marketCap)}</span>
                  </div>
                ))}
                {losers.length === 0 && <div className="sm-empty text-muted">No losers today</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectorCharts({ sectors, sectorPerformance, onSelectStock }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const peData = sectors
    .filter((s) => s.avgPE !== null)
    .sort((a, b) => (b.avgPE ?? 0) - (a.avgPE ?? 0))
    .map((s) => ({ name: shortSector(s.sector), value: +(s.avgPE ?? 0).toFixed(1) }));

  const pieData = sectors
    .sort((a, b) => b.totalCount - a.totalCount)
    .map((s) => ({
      name: shortSector(s.sector),
      fullName: s.sector,
      value: s.totalCount,
      loaded: s.count,
    }));

  const total = pieData.reduce((a, b) => a + b.value, 0);

  const onPieEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);
  const onPieLeave = useCallback(() => setActiveIndex(undefined), []);

  const onPieClick = useCallback((_: any, index: number) => {
    const sectorName = pieData[index]?.fullName;
    if (sectorName) setSelectedSector(sectorName);
  }, [pieData]);

  const peTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    return (
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "6px 10px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontSize: 12,
      }}>
        <strong>{payload[0].payload.name}</strong>: P/E {payload[0].value}
      </div>
    );
  };

  /* Labels — hide when a slice is active to avoid overlap with external hover text */
  const renderLabel = (props: any) => {
    if (activeIndex !== undefined) return null;
    const { cx, cy, midAngle, outerRadius, name, percent } = props;
    const RADIAN = Math.PI / 180;
    const pct = percent * 100;
    if (pct < 2.5) return null; // hide tiny slices
    const radius = outerRadius + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? "start" : "end";
    return (
      <text x={x} y={y} textAnchor={anchor} dominantBaseline="central"
        style={{ fontSize: 10, fill: "var(--text-muted)", fontWeight: 500 }}>
        {name}
      </text>
    );
  };

  const renderLabelLine = (props: any) => {
    if (activeIndex !== undefined) return <path d="" />;
    const { cx, cy, midAngle, outerRadius, percent } = props;
    if (percent * 100 < 2.5) return <path d="" />;
    const RADIAN = Math.PI / 180;
    const r1 = outerRadius + 3;
    const r2 = outerRadius + 12;
    const x1 = cx + r1 * Math.cos(-midAngle * RADIAN);
    const y1 = cy + r1 * Math.sin(-midAngle * RADIAN);
    const x2 = cx + r2 * Math.cos(-midAngle * RADIAN);
    const y2 = cy + r2 * Math.sin(-midAngle * RADIAN);
    return <path d={`M${x1},${y1}L${x2},${y2}`} stroke="var(--border)" strokeWidth={1} fill="none" />;
  };

  const sectorPerf = selectedSector
    ? sectorPerformance.find((s) => s.sector === selectedSector)
    : null;

  const selectedPieIdx = selectedSector
    ? pieData.findIndex((p) => p.fullName === selectedSector)
    : -1;

  const selectedColor = selectedPieIdx >= 0
    ? COLORS[selectedPieIdx % COLORS.length]
    : "#4f46e5";

  return (
    <>
      <div className="charts-grid charts-grid-equal">
        <Card title="Avg P/E by Sector">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={peData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <Tooltip content={peTooltip} />
              <Bar shape={SafeBarShape} dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} animationDuration={800}>
                {peData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title={`S&P 500 Sector Distribution (${total} stocks)`}>
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              {/* @ts-expect-error recharts Pie activeIndex typing */}
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={40}
                activeIndex={activeIndex}
                activeShape={ActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                onClick={onPieClick}
                label={renderLabel}
                labelLine={renderLabelLine}
                animationBegin={0}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {pieData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Glassmorphic sector modal */}
      {selectedSector && sectorPerf && (
        <SectorModal
          sector={sectorPerf}
          color={selectedColor}
          sectorIndex={selectedPieIdx}
          onClose={() => setSelectedSector(null)}
          onSelectStock={onSelectStock}
        />
      )}
    </>
  );
}
