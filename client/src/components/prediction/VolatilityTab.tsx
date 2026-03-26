import { useState, useEffect, useContext } from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { Loading } from "../common/Loading";
import { fetchGarch, type GarchResult } from "../../api/prediction";
import { SettingsCtx, Stat } from "./PredictionShared";

export function VolatilityTab({ symbol }: { symbol: string }) {
  const { period, horizon } = useContext(SettingsCtx);
  const [data, setData] = useState<GarchResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchGarch(symbol, period, horizon)
      .then(d => setData(d.success ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol, period, horizon]);

  if (loading) return <Loading message="Running GARCH volatility model..." />;
  if (!data) return <p className="text-muted">GARCH model unavailable. Ensure R is installed with rugarch package.</p>;

  const volFcData = data.vol_forecast.map((v, i) => ({ day: `D${i + 1}`, vol: v }));
  const coneData = data.vol_cone.filter(c => c.current != null);

  return (
    <div className="pd-vol">
      <div className="pd-summary-row">
        <div className="pd-model-card">
          <h5>{data.model.type}</h5>
          <Stat label="Current Vol (ann.)" val={`${data.current_vol.toFixed(1)}%`} color={data.current_vol > 30 ? "#dc2626" : data.current_vol > 20 ? "#d97706" : "#059669"} />
          <Stat label="Persistence" val={data.model.persistence.toFixed(4)} sm />
          <Stat label="Half-Life" val={`${data.model.half_life} days`} sm />
        </div>
        <div className="pd-model-card">
          <h5>VaR (Value at Risk)</h5>
          <Stat label="Daily VaR 95%" val={`${data.var_metrics.var_95_pct}%`} color="#dc2626" />
          <Stat label="Daily VaR 99%" val={`${data.var_metrics.var_99_pct}%`} color="#dc2626" sm />
          <Stat label="CVaR 95%" val={`${data.var_metrics.cvar_95_pct}%`} color="#dc2626" sm />
          <Stat label="$ VaR 95" val={`$${data.var_metrics.dollar_var_95}`} sm />
        </div>
        <div className="pd-model-card">
          <h5>Regime</h5>
          <Stat label="State" val={data.regime.current} color={data.regime.percentile > 70 ? "#dc2626" : data.regime.percentile > 40 ? "#d97706" : "#059669"} />
          <Stat label="Percentile" val={`${data.regime.percentile}%`} sm />
          <Stat label="Term Shape" val={data.regime.shape} sm />
        </div>
      </div>

      {/* Vol forecast chart */}
      <div className="pd-chart-section">
        <h4 className="pd-section-title">Volatility Forecast ({horizon} days, annualized %)</h4>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={volFcData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="vol" fill="#6366f1" radius={[3, 3, 0, 0]} name="Forecast Vol" />
            <ReferenceLine y={data.current_vol} stroke="#dc2626" strokeDasharray="3 3" label={{ value: "Current", fontSize: 10 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Vol cone */}
      {coneData.length > 0 && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">Volatility Cone (historical range by window)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={coneData.map(c => ({ window: `${c.window}d`, current: c.current, min: c.min, max: c.max, p25: c.p25, median: c.median, p75: c.p75 }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="window" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
              <Area dataKey="max" stroke="none" fill="#fee2e2" fillOpacity={0.5} name="Max" />
              <Area dataKey="min" stroke="none" fill="#ffffff" fillOpacity={1} name="Min" />
              <Area dataKey="p75" stroke="none" fill="#fef3c7" fillOpacity={0.5} name="P75" />
              <Area dataKey="p25" stroke="none" fill="#ffffff" fillOpacity={1} name="P25" />
              <Line dataKey="median" stroke="#6b7280" strokeWidth={1} dot name="Median" />
              <Line dataKey="current" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4 }} name="Current" />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="pd-note">Red line shows current realized vol at each window. When above the cone, vol is unusually high.</p>
        </div>
      )}

      {/* GARCH price forecast with bands */}
      {data.price_forecast.length > 0 && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">GARCH Price Forecast (vol-adjusted confidence bands)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={[{ day: "Now", mean: data.lastPrice, lo95: data.lastPrice, hi95: data.lastPrice, lo80: data.lastPrice, hi80: data.lastPrice },
              ...data.price_forecast.map(p => ({ day: `D${p.day}`, mean: p.mean, lo95: p.lo95, hi95: p.hi95, lo80: p.lo80, hi80: p.hi80 }))]}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
              <ReferenceLine y={data.lastPrice} stroke="#6b7280" strokeDasharray="3 3" />
              <Area dataKey="hi95" stroke="none" fill="#dbeafe" fillOpacity={0.3} name="95% Hi" />
              <Area dataKey="lo95" stroke="none" fill="#ffffff" fillOpacity={1} name="95% Lo" />
              <Area dataKey="hi80" stroke="none" fill="#bfdbfe" fillOpacity={0.5} name="80% Hi" />
              <Area dataKey="lo80" stroke="none" fill="#ffffff" fillOpacity={1} name="80% Lo" />
              <Line dataKey="mean" stroke="#059669" strokeWidth={2.5} dot={false} name="GARCH Mean" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="pd-theory-box">
        <h5>About GARCH Volatility</h5>
        <p>GARCH (Generalized Autoregressive Conditional Heteroskedasticity) models volatility clustering — the tendency for high-volatility periods to persist. Persistence &gt; 0.95 means vol shocks decay slowly. Half-life shows how many days for a vol shock to decay by 50%. VaR (Value at Risk) estimates the worst daily loss at a given confidence level.</p>
      </div>
    </div>
  );
}
