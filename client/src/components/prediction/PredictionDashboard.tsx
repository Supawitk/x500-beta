import { useState, useMemo } from "react";
import { Card } from "../common/Card";
import { ModelLab } from "./ModelLab";
import { SettingsCtx } from "./PredictionShared";
import { MasterForecastTab } from "./MasterForecastTab";
import { ForecastTab } from "./ForecastTab";
import { VolatilityTab } from "./VolatilityTab";
import { LevelsTab } from "./LevelsTab";
import { SeasonalTab } from "./SeasonalTab";
import { BollingerTab } from "./BollingerTab";
import { TrendingUp, Activity, Layers, BarChart3, Zap, ShieldAlert, Brain } from "lucide-react";

interface Props { symbol: string; }

type DashTab = "master" | "forecast" | "volatility" | "levels" | "seasonal" | "bollinger" | "models";

const TABS: { id: DashTab; label: string; icon: React.ReactNode }[] = [
  { id: "master", label: "Master Forecast", icon: <Brain size={14} /> },
  { id: "forecast", label: "ARIMA+GARCH", icon: <TrendingUp size={14} /> },
  { id: "volatility", label: "Volatility", icon: <Activity size={14} /> },
  { id: "levels", label: "S/R Levels", icon: <Layers size={14} /> },
  { id: "seasonal", label: "Seasonal", icon: <BarChart3 size={14} /> },
  { id: "bollinger", label: "Bollinger", icon: <Zap size={14} /> },
  { id: "models", label: "ML Models", icon: <ShieldAlert size={14} /> },
];

export function PredictionDashboard({ symbol }: Props) {
  const [tab, setTab] = useState<DashTab>("master");
  const [period, setPeriod] = useState("1y");
  const [horizon, setHorizon] = useState(14);

  const settings = useMemo(() => ({ period, horizon }), [period, horizon]);

  return (
    <SettingsCtx.Provider value={settings}>
      <Card title={`Price Forecast & Analysis — ${symbol}`}>
        {/* Global settings bar */}
        <div className="pd-settings">
          <label>Period:
            <select value={period} onChange={e => setPeriod(e.target.value)}>
              {["6mo", "1y", "2y", "3y"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>Horizon:
            <select value={horizon} onChange={e => setHorizon(+e.target.value)}>
              {[5, 10, 14, 20, 30].map(h => <option key={h} value={h}>{h} days</option>)}
            </select>
          </label>
          <span className="text-muted text-sm">Settings sync across all tabs</span>
        </div>

        {/* Tab bar */}
        <div className="pd-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`pd-tab ${tab === t.id ? "pd-tab-active" : ""}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="pd-content">
          {tab === "master" && <MasterForecastTab symbol={symbol} />}
          {tab === "forecast" && <ForecastTab symbol={symbol} />}
          {tab === "volatility" && <VolatilityTab symbol={symbol} />}
          {tab === "levels" && <LevelsTab symbol={symbol} />}
          {tab === "seasonal" && <SeasonalTab symbol={symbol} />}
          {tab === "bollinger" && <BollingerTab symbol={symbol} />}
          {tab === "models" && <ModelLab symbol={symbol} />}
        </div>
      </Card>
    </SettingsCtx.Provider>
  );
}
