const BASE = "/api/predict";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.message || "Prediction failed");
  return data as T;
}

export interface ForecastResult {
  success: boolean;
  symbol: string;
  model: string;
  aic: number;
  lastPrice: number;
  forecast: { point: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  residual_sd: number;
  warning?: string;
}

export interface RiskResult {
  success: boolean;
  symbol: string;
  ann_return: number;
  ann_volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  max_dd_period: string;
  calmar_ratio: number;
  skewness: number;
  kurtosis: number;
  win_rate: number;
  current_vol_percentile: number;
  vol_regime: string;
  total_return: number;
  trading_days: number;
}

export interface PortfolioResult {
  symbols: string[];
  optimization: {
    success: boolean;
    assets: any[];
    min_variance: { weights: Record<string, number>; return_ann: number; risk_ann: number };
    max_sharpe: { weights: Record<string, number>; return_ann: number; risk_ann: number; sharpe: number };
    frontier: { ret: number; risk: number; sharpe: number }[];
  };
  monteCarlo: {
    equalWeight: MonteCarloResult;
    optimized: MonteCarloResult | null;
  };
}

export interface MonteCarloResult {
  success: boolean;
  var_95: number;
  var_99: number;
  cvar_95: number;
  expected_return: number;
  prob_loss: number;
  worst_case: number;
  best_case: number;
  fan_chart: { percentiles: number[]; paths: Record<string, number>[] };
}

export function fetchForecast(symbol: string, horizon = 14): Promise<ForecastResult> {
  return fetchJson(`${BASE}/forecast/${symbol}?period=1y&horizon=${horizon}`);
}

export function fetchRisk(symbol: string): Promise<RiskResult> {
  return fetchJson(`${BASE}/risk/${symbol}?period=1y`);
}

export function fetchPortfolio(symbols: string[]): Promise<PortfolioResult> {
  return fetchJson(`${BASE}/portfolio?symbols=${symbols.join(",")}`);
}

export interface PatternMatch {
  start_date: string;
  end_date: string;
  correlation: number;
  r_squared: number;
  rmse: number;
  after_return: number;
  max_gain: number;
  max_loss: number;
  after_prices: number[];
}

export interface BacktestResult {
  success: boolean;
  symbol: string;
  window: number;
  lookahead: number;
  dataPoints: number;
  current_pattern: { dates: string[]; normalized: number[] };
  matches: PatternMatch[];
  summary: {
    total_matches: number;
    avg_return: number;
    median_return: number;
    std_return: number;
    pct_positive: number;
    avg_max_gain: number;
    avg_max_loss: number;
    best_match_return: number;
    worst_match_return: number;
    avg_r_squared: number;
    avg_rmse: number;
    confidence_score: number;
    directional_bias: string;
    avg_path: number[];
    p10_path: number[];
    p90_path: number[];
  };
  note: string;
}

export function fetchBacktest(
  symbol: string, window = 20, lookahead = 14
): Promise<BacktestResult> {
  return fetchJson(`${BASE}/backtest/${symbol}?window=${window}&lookahead=${lookahead}`);
}

// ── GARCH Volatility ──────────────────────────────────────────────────────
export interface GarchResult {
  success: boolean;
  symbol: string;
  model: { type: string; method: string; persistence: number; half_life: number; alpha?: number; beta?: number };
  current_vol: number;
  vol_forecast: number[];
  price_forecast: { day: number; mean: number; lo95: number; hi95: number; lo80: number; hi80: number }[];
  vol_cone: { window: number; current: number; min: number; median: number; max: number; p25: number; p75: number }[];
  var_metrics: { var_95_pct: number; var_99_pct: number; cvar_95_pct: number; dollar_var_95: number };
  regime: { current: string; percentile: number; recent_vol: number; shape: string };
  term_structure: { window: number; vol: number }[];
  lastPrice: number;
}

export function fetchGarch(symbol: string, period = "1y", horizon = 14): Promise<GarchResult> {
  return fetchJson(`${BASE}/garch/${symbol}?period=${period}&horizon=${horizon}`);
}

// ── Support & Resistance ──────────────────────────────────────────────────
export interface SRLevel {
  price: number; type: string; strength: number; dist_pct: number;
}
export interface SRResult {
  success: boolean;
  symbol: string;
  lastPrice: number;
  levels: SRLevel[];
  fibonacci: Record<string, number>;
  volume_profile: { price: number; volume: number }[];
  poc: number;
  hvn_levels: number[];
  position_analysis: {
    nearest_support: number; nearest_resistance: number;
    dist_to_support: number; dist_to_resistance: number;
    risk_reward: number; zone: string;
    res_tests: number; res_breaks: number;
    sup_tests: number; sup_breaks: number;
  };
}

export function fetchSRLevels(symbol: string, period = "1y"): Promise<SRResult> {
  return fetchJson(`${BASE}/levels/${symbol}?period=${period}`);
}

// ── Seasonal Decomposition ────────────────────────────────────────────────
export interface SeasonalResult {
  success: boolean;
  symbol: string;
  decomposition: { date: string; price: number; trend: number; seasonal: number; residual: number }[];
  season_strength: number;
  trend_strength: number;
  monthly_patterns: { month: string; avg: number; median: number; std?: number; pct_positive: number; count: number; best?: number; worst?: number }[];
  weekday_patterns: { day: string; avg: number; pct_positive: number; count: number }[];
  autocorrelation: { lag: number; acf: number }[];
  dominant_cycle: number;
  hurst_exponent: number;
  hurst_interp: string;
  current_signal: { month_bias: number; month_positive: number; seasonal_component: number; trend_direction: string };
  conf_bound: number;
}

export function fetchSeasonal(symbol: string, period = "2y"): Promise<SeasonalResult> {
  return fetchJson(`${BASE}/seasonal/${symbol}?period=${period}`);
}

// ── Bollinger Band Analysis ───────────────────────────────────────────────
export interface BollingerResult {
  success: boolean;
  symbol: string;
  current: {
    price: number; upper_band: number; middle_band: number; lower_band: number;
    pct_b: number; bandwidth: number; bw_percentile: number;
    in_squeeze: boolean; signal: string; pattern: string;
  };
  band_data: { date: string; price: number; upper: number; middle: number; lower: number; pct_b: number; bw: number; squeeze: boolean }[];
  squeeze_events: { start_date: string; end_date: string; duration: number; direction: string; after_return_10d: number }[];
  total_squeezes: number;
  reversion_accuracy: number | null;
  reversion_tests: number;
  note: string;
}

export function fetchBollinger(symbol: string, period = "1y"): Promise<BollingerResult> {
  return fetchJson(`${BASE}/bollinger/${symbol}?period=${period}`);
}

// ── Holt-Winters ES ──────────────────────────────────────────────────────
export interface HWESModel {
  name: string;
  params: { alpha: number; beta: number; gamma: number };
  forecast: { day: number; point: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  accuracy: { rmse: number; mae: number; dir_accuracy: number };
  description: string;
}
export interface HWESResult {
  success: boolean;
  symbol: string;
  lastPrice: number;
  models: HWESModel[];
  best_model: string;
  best_forecast: { day: number; point: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  trend: { slope: number; direction: string; strength: number };
}

export function fetchHWES(symbol: string, period = "1y", horizon = 14): Promise<HWESResult> {
  return fetchJson(`${BASE}/hwes/${symbol}?period=${period}&horizon=${horizon}`);
}

// ── Bayesian Regression ──────────────────────────────────────────────────
export interface BayesianResult {
  success: boolean;
  symbol: string;
  lastPrice: number;
  model: string;
  posterior: { sigma2: number; n_params: number; n_obs: number };
  importance: { feature: string; coefficient: number; std_error: number; signal_noise: number; significant: boolean }[];
  forecast: { day: number; mean: number; median: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  probability: { prob_up: number; expected_return_pct: number; var_95_pct: number; direction: string };
  return_distribution: { mean: number; median: number; sd: number; skew: number; p5: number; p25: number; p75: number; p95: number };
  histogram: { bin: number; count: number; density: number }[];
  walk_forward: { dir_accuracy: number; naive_accuracy: number; skill_score: number; rmse: number; n_steps: number; interpretation: string };
}

export function fetchBayesian(symbol: string, period = "1y", horizon = 14): Promise<BayesianResult> {
  return fetchJson(`${BASE}/bayesian/${symbol}?period=${period}&horizon=${horizon}`);
}

// ── Regime Detection ─────────────────────────────────────────────────────
export interface RegimeResult {
  success: boolean;
  symbol: string;
  lastPrice: number;
  model: string;
  current_regime: string;
  regime_streak: number;
  regime_stats: Record<string, { count: number; pct: number; avg_return: number; avg_vol: number; avg_winrate: number; avg_drawdown: number }>;
  transition_matrix: Record<string, Record<string, number>>;
  next_regime_prob: Record<string, number>;
  forecast: { day: number; mean: number; median: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  probability: { prob_up: number; expected_return_pct: number; direction: string };
  regime_timeline: { date: string; regime: string; ret: number; vol: number }[];
  note: string;
}

export function fetchRegime(symbol: string, period = "2y", horizon = 14): Promise<RegimeResult> {
  return fetchJson(`${BASE}/regime/${symbol}?period=${period}&horizon=${horizon}`);
}

// ── Master Forecast (all models combined) ────────────────────────────────
export interface MasterModel {
  name: string;
  success: boolean;
  error?: string;
  forecast?: { day: number; point: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  endPoint?: number;
  direction?: string;
  returnPct?: number;
  probUp?: number | null;
  walkForward?: { dir_accuracy: number; skill_score: number; rmse: number; n_steps: number; interpretation: string } | null;
  regime?: string | null;
  model_detail?: string;
  extra?: any;
}

export interface MasterForecastResult {
  symbol: string;
  period: string;
  horizon: number;
  lastPrice: number;
  models: MasterModel[];
  consensus: {
    direction: string;
    agreement_pct: number;
    weighted_bull_pct: number;
    n_bullish: number;
    n_bearish: number;
    n_models: number;
    total_models: number;
    label: string;
  };
  avgPath: { day: number; consensus: number; lo80: number; hi80: number }[];
  dataPoints: number;
}

export function fetchMasterForecast(symbol: string, period = "1y", horizon = 14): Promise<MasterForecastResult> {
  return fetchJson(`${BASE}/master/${symbol}?period=${period}&horizon=${horizon}`);
}
