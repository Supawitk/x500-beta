import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Card } from "../common/Card";
import type { PortfolioResult, MonteCarloResult } from "../../api/prediction";

interface Props {
  data: PortfolioResult;
}

function pct(v: number): string { return `${(v * 100).toFixed(2)}%`; }

function MCBlock({ mc, label }: { mc: MonteCarloResult; label: string }) {
  return (
    <div className="mc-block">
      <h4 className="mc-title">{label}</h4>
      <div className="risk-grid">
        <div className="risk-metric"><span className="metric-label">VaR 95%</span><span className="text-red">{pct(mc.var_95)}</span></div>
        <div className="risk-metric"><span className="metric-label">CVaR 95%</span><span className="text-red">{pct(mc.cvar_95)}</span></div>
        <div className="risk-metric"><span className="metric-label">Expected</span><span>{pct(mc.expected_return)}</span></div>
        <div className="risk-metric"><span className="metric-label">Prob Loss</span><span>{pct(mc.prob_loss)}</span></div>
        <div className="risk-metric"><span className="metric-label">Worst</span><span className="text-red">{pct(mc.worst_case)}</span></div>
        <div className="risk-metric"><span className="metric-label">Best</span><span className="text-green">{pct(mc.best_case)}</span></div>
      </div>
    </div>
  );
}

export function PortfolioPanel({ data }: Props) {
  const { optimization: opt, monteCarlo: mc } = data;

  // Efficient frontier chart
  const frontier = opt.success ? opt.frontier.map((f) => ({
    risk: (f.risk * 100),
    ret: (f.ret * 100),
    sharpe: f.sharpe,
  })) : [];

  return (
    <div className="portfolio-section">
      {opt.success && (
        <>
          <Card title="Portfolio Optimization (Markowitz)">
            <div className="charts-grid">
              <div>
                <h4 className="mc-title">Max Sharpe Portfolio</h4>
                {Object.entries(opt.max_sharpe.weights).map(([s, w]) => (
                  <div key={s} className="weight-row">
                    <span className="font-bold">{s}</span>
                    <div className="weight-bar-track">
                      <div className="weight-bar-fill" style={{ width: `${Number(w) * 100}%` }} />
                    </div>
                    <span className="text-sm">{(Number(w) * 100).toFixed(1)}%</span>
                  </div>
                ))}
                <p className="text-sm text-muted" style={{ marginTop: 8 }}>
                  Return: {pct(opt.max_sharpe.return_ann)} | Risk: {pct(opt.max_sharpe.risk_ann)} | Sharpe: {opt.max_sharpe.sharpe.toFixed(2)}
                </p>
              </div>
              <div>
                <h4 className="mc-title">Min Variance Portfolio</h4>
                {Object.entries(opt.min_variance.weights).map(([s, w]) => (
                  <div key={s} className="weight-row">
                    <span className="font-bold">{s}</span>
                    <div className="weight-bar-track">
                      <div className="weight-bar-fill" style={{ width: `${Number(w) * 100}%` }} />
                    </div>
                    <span className="text-sm">{(Number(w) * 100).toFixed(1)}%</span>
                  </div>
                ))}
                <p className="text-sm text-muted" style={{ marginTop: 8 }}>
                  Return: {pct(opt.min_variance.return_ann)} | Risk: {pct(opt.min_variance.risk_ann)}
                </p>
              </div>
            </div>
          </Card>
          {frontier.length > 0 && (
            <Card title="Efficient Frontier">
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <XAxis dataKey="risk" name="Risk %" type="number" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis dataKey="ret" name="Return %" type="number" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                  <Legend />
                  <Scatter name="Frontier" data={frontier} fill="#4f46e5">
                    {frontier.map((_, i) => (
                      <Cell key={i} fill={i === frontier.length - 1 ? "#059669" : "#4f46e5"} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      <Card title="Monte Carlo Simulation (21 days, 5K paths)">
        <div className="charts-grid">
          {mc.equalWeight?.success && <MCBlock mc={mc.equalWeight} label="Equal Weight" />}
          {mc.optimized?.success && <MCBlock mc={mc.optimized} label="Optimized Weights" />}
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 8 }}>
          VaR 95% = you have a 5% chance of losing more than this in 21 trading days.
          CVaR = average loss in the worst 5% of scenarios.
        </p>
      </Card>
    </div>
  );
}
