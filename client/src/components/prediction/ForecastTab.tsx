import { useState, useEffect, useMemo, useContext } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { Loading } from "../common/Loading";
import {
  fetchForecast, fetchRisk, fetchGarch,
  type ForecastResult, type RiskResult, type GarchResult,
} from "../../api/prediction";
import { SettingsCtx, Stat, fmtPct, pctCol } from "./PredictionShared";

export function ForecastTab({ symbol }: { symbol: string }) {
  const { period, horizon } = useContext(SettingsCtx);
  const [arima, setArima] = useState<ForecastResult | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [garch, setGarch] = useState<GarchResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchForecast(symbol, horizon).catch(() => null),
      fetchRisk(symbol).catch(() => null),
      fetchGarch(symbol, period, horizon).catch(() => null),
    ]).then(([a, r, g]) => {
      setArima(a?.success ? a : null);
      setRisk(r?.success ? r : null);
      setGarch(g?.success ? g : null);
    }).finally(() => setLoading(false));
  }, [symbol, period, horizon]);

  // Combine ARIMA and GARCH into one overlay chart — must be before any early return
  const chartData = useMemo(() => {
    if (!arima && !garch) return [];
    const rows: any[] = [];
    const lp = arima?.lastPrice ?? garch?.lastPrice ?? 0;
    rows.push({ day: "Now", arima: lp, garch: lp, arima_lo: lp, arima_hi: lp, garch_lo: lp, garch_hi: lp });
    const maxLen = Math.max(arima?.forecast.length ?? 0, garch?.price_forecast.length ?? 0);
    for (let i = 0; i < maxLen; i++) {
      const a = arima?.forecast[i];
      const g = garch?.price_forecast[i];
      rows.push({
        day: `D${i + 1}`,
        arima: a?.point ?? null,
        arima_lo: a?.lo80 ?? null,
        arima_hi: a?.hi80 ?? null,
        garch: g?.mean ?? null,
        garch_lo: g?.lo80 ?? null,
        garch_hi: g?.hi80 ?? null,
      });
    }
    return rows;
  }, [arima, garch]);

  const lastP = arima?.lastPrice ?? garch?.lastPrice ?? 0;
  const arimaEnd = arima?.forecast[arima.forecast.length - 1]?.point;
  const garchEnd = garch?.price_forecast[garch.price_forecast.length - 1]?.mean;
  const arimaDir = arimaEnd != null ? (arimaEnd > lastP ? "Bullish" : "Bearish") : null;
  const garchDir = garchEnd != null ? (garchEnd > lastP ? "Bullish" : "Bearish") : null;
  const agree = arimaDir && garchDir && arimaDir === garchDir;

  if (loading) return <Loading message="Running ARIMA + GARCH forecasts..." />;

  return (
    <div className="pd-forecast">
      {/* Summary cards */}
      <div className="pd-summary-row">
        {arima && (
          <div className="pd-model-card">
            <h5>ARIMA ({arima.model})</h5>
            <Stat label={`${horizon}d Target`} val={`$${arimaEnd?.toFixed(2) ?? "?"}`} color={arimaDir === "Bullish" ? "#059669" : "#dc2626"} />
            <Stat label="AIC" val={arima.aic.toFixed(0)} sm />
            <Stat label="Residual SD" val={`$${arima.residual_sd.toFixed(2)}`} sm />
          </div>
        )}
        {garch && (
          <div className="pd-model-card">
            <h5>{garch.model.type}</h5>
            <Stat label={`${horizon}d Target`} val={`$${garchEnd?.toFixed(2) ?? "?"}`} color={garchDir === "Bullish" ? "#059669" : "#dc2626"} />
            <Stat label="Current Vol" val={`${garch.current_vol.toFixed(1)}%`} sm />
            <Stat label="Persistence" val={garch.model.persistence.toFixed(3)} sm />
          </div>
        )}
        {risk && (
          <div className="pd-model-card">
            <h5>Risk Profile</h5>
            <Stat label="Sharpe" val={risk.sharpe_ratio.toFixed(2)} color={risk.sharpe_ratio > 1 ? "#059669" : risk.sharpe_ratio > 0 ? "#d97706" : "#dc2626"} />
            <Stat label="Max DD" val={`${(risk.max_drawdown * 100).toFixed(1)}%`} color="#dc2626" sm />
            <Stat label="Win Rate" val={`${(risk.win_rate * 100).toFixed(0)}%`} sm />
          </div>
        )}
        <div className="pd-model-card pd-consensus-card">
          <h5>Forecast Agreement</h5>
          {arimaDir && garchDir ? (
            <>
              <span className={`pd-agree-badge ${agree ? "pd-agree-yes" : "pd-agree-no"}`}>
                {agree ? "Models Agree" : "Models Disagree"}
              </span>
              <span className="text-sm text-muted">
                ARIMA: {arimaDir} | GARCH: {garchDir}
              </span>
            </>
          ) : <span className="text-muted">Insufficient data</span>}
        </div>
      </div>

      {/* Multi-model overlay chart */}
      {chartData.length > 1 && (
        <div className="pd-chart-section">
          <h4 className="pd-section-title">Multi-Model Price Forecast Overlay</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
              <ReferenceLine y={lastP} stroke="#6b7280" strokeDasharray="3 3" />
              <Area dataKey="arima_hi" stroke="none" fill="#c7d2fe" fillOpacity={0.3} name="ARIMA 80% Hi" />
              <Area dataKey="arima_lo" stroke="none" fill="#ffffff" fillOpacity={1} name="ARIMA 80% Lo" />
              <Area dataKey="garch_hi" stroke="none" fill="#bbf7d0" fillOpacity={0.3} name="GARCH 80% Hi" />
              <Area dataKey="garch_lo" stroke="none" fill="#ffffff" fillOpacity={1} name="GARCH 80% Lo" />
              <Line dataKey="arima" stroke="#4f46e5" strokeWidth={2.5} dot={false} name="ARIMA" />
              <Line dataKey="garch" stroke="#059669" strokeWidth={2.5} dot={false} name="GARCH" strokeDasharray="5 3" />
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Risk metrics grid */}
      {risk && (
        <div className="pd-risk-grid">
          <Stat label="Ann. Return" val={fmtPct(risk.ann_return * 100)} color={pctCol(risk.ann_return)} />
          <Stat label="Ann. Volatility" val={fmtPct(risk.ann_volatility * 100)} />
          <Stat label="Sharpe" val={risk.sharpe_ratio.toFixed(2)} color={risk.sharpe_ratio > 1 ? "#059669" : "#d97706"} />
          <Stat label="Sortino" val={risk.sortino_ratio.toFixed(2)} />
          <Stat label="Calmar" val={risk.calmar_ratio.toFixed(2)} />
          <Stat label="Max DD" val={fmtPct(risk.max_drawdown * 100)} color="#dc2626" />
          <Stat label="DD Period" val={risk.max_dd_period} />
          <Stat label="Win Rate" val={fmtPct(risk.win_rate * 100)} />
          <Stat label="Skewness" val={risk.skewness.toFixed(3)} />
          <Stat label="Kurtosis" val={risk.kurtosis.toFixed(3)} />
          <Stat label="Vol Regime" val={risk.vol_regime} />
          <Stat label="Vol Percentile" val={fmtPct(risk.current_vol_percentile * 100)} />
        </div>
      )}
    </div>
  );
}
