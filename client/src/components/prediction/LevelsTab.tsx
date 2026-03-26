import { useState, useEffect, useContext } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer,
} from "recharts";
import { SafeBarShape } from "../../utils/SafeBarShape";
import { Loading } from "../common/Loading";
import { fetchSRLevels, type SRResult } from "../../api/prediction";
import { SettingsCtx, Stat } from "./PredictionShared";

export function LevelsTab({ symbol }: { symbol: string }) {
  const { period } = useContext(SettingsCtx);
  const [data, setData] = useState<SRResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSRLevels(symbol, period)
      .then(d => setData(d.success ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  if (loading) return <Loading message="Detecting support & resistance..." />;
  if (!data) return <p className="text-muted">S/R detection unavailable.</p>;

  const pa = data.position_analysis;
  const maxVol = Math.max(...data.volume_profile.map(v => v.volume));

  return (
    <div className="pd-levels">
      {/* Position analysis */}
      <div className="pd-summary-row">
        <div className="pd-model-card">
          <h5>Current Position</h5>
          <Stat label="Price" val={`$${data.lastPrice.toFixed(2)}`} />
          <p className="text-sm" style={{ color: pa.zone.includes("Support") ? "#059669" : pa.zone.includes("Resistance") ? "#dc2626" : "#d97706", marginTop: 4 }}>{pa.zone}</p>
        </div>
        <div className="pd-model-card">
          <h5>Nearest Support</h5>
          <Stat label="Level" val={`$${pa.nearest_support.toFixed(2)}`} color="#059669" />
          <Stat label="Distance" val={`${pa.dist_to_support.toFixed(2)}%`} sm />
          <Stat label="Tests / Breaks" val={`${pa.sup_tests} / ${pa.sup_breaks}`} sm />
        </div>
        <div className="pd-model-card">
          <h5>Nearest Resistance</h5>
          <Stat label="Level" val={`$${pa.nearest_resistance.toFixed(2)}`} color="#dc2626" />
          <Stat label="Distance" val={`${pa.dist_to_resistance.toFixed(2)}%`} sm />
          <Stat label="Tests / Breaks" val={`${pa.res_tests} / ${pa.res_breaks}`} sm />
        </div>
        <div className="pd-model-card">
          <h5>Risk/Reward</h5>
          <Stat label="R:R Ratio" val={pa.risk_reward != null ? `${pa.risk_reward.toFixed(2)}:1` : "N/A"} color={pa.risk_reward != null && pa.risk_reward >= 2 ? "#059669" : "#d97706"} />
          <Stat label="POC (Vol)" val={`$${data.poc.toFixed(2)}`} sm />
        </div>
      </div>

      {/* Levels table */}
      <div className="pd-levels-table">
        <h4 className="pd-section-title">Detected Levels (sorted by price)</h4>
        <table className="pd-table">
          <thead><tr><th>Price</th><th>Type</th><th>Strength</th><th>Distance</th><th>Bar</th></tr></thead>
          <tbody>
            {data.levels.map((l, i) => (
              <tr key={i} className={Math.abs(l.dist_pct) < 1 ? "pd-level-near" : ""}>
                <td className="pd-mono">${l.price.toFixed(2)}</td>
                <td><span className={`pd-level-type ${l.type === "Support" ? "pd-sup" : l.type === "Resistance" ? "pd-res" : "pd-piv"}`}>{l.type}</span></td>
                <td className="pd-mono">{l.strength}/100</td>
                <td className="pd-mono" style={{ color: l.dist_pct > 0 ? "#059669" : "#dc2626" }}>{l.dist_pct > 0 ? "+" : ""}{l.dist_pct.toFixed(2)}%</td>
                <td><div className="pd-str-bar"><div style={{ width: `${l.strength}%`, background: l.type === "Support" ? "#059669" : l.type === "Resistance" ? "#dc2626" : "#d97706" }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fibonacci levels */}
      <div className="pd-fib-section">
        <h4 className="pd-section-title">Fibonacci Retracement (Recent Swing)</h4>
        <div className="pd-fib-grid">
          {Object.entries(data.fibonacci).map(([key, val]) => {
            const label = key === "f0" ? "0% (High)" : key === "f1" ? "100% (Low)" : key.replace("f", "") + "%";
            const dist = ((val - data.lastPrice) / data.lastPrice * 100);
            return (
              <div key={key} className="pd-fib-item">
                <span className="pd-fib-label">{label.replace("236", "23.6").replace("382", "38.2").replace("500", "50.0").replace("618", "61.8").replace("786", "78.6")}</span>
                <span className="pd-mono">${val.toFixed(2)}</span>
                <span className="pd-mono text-sm" style={{ color: dist > 0 ? "#059669" : "#dc2626" }}>{dist > 0 ? "+" : ""}{dist.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume Profile */}
      <div className="pd-chart-section">
        <h4 className="pd-section-title">Volume Profile</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.volume_profile.filter((_, i) => i % 2 === 0)} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="price" tick={{ fontSize: 9 }} width={55} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={((v: any) => [Number(v).toLocaleString(), "Volume"]) as any} />
            <Bar shape={SafeBarShape} dataKey="volume" radius={[0, 3, 3, 0]}>
              {data.volume_profile.filter((_, i) => i % 2 === 0).map((v, i) => (
                <Cell key={i} fill={v.price <= data.lastPrice ? "#059669" : "#dc2626"} opacity={Math.max(0.3, v.volume / maxVol)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="pd-note">Green = below current price (support zone). Red = above (resistance zone). Taller bars = more volume traded at that price = stronger level.</p>
      </div>
    </div>
  );
}
