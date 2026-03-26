interface OHLC {
  high: number;
  low: number;
  close: number;
}

/**
 * Modified Stochastic Oscillator (%K and %D)
 * Uses smoothed %K (3-period SMA of raw %K) for less noise
 * kPeriod: lookback (default 14)
 * dPeriod: signal smoothing (default 3)
 * smooth: %K smoothing (default 3)
 */
export function calcStochastic(
  data: OHLC[],
  kPeriod = 14,
  dPeriod = 3,
  smooth = 3
) {
  const rawK: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) { rawK.push(null); continue; }
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > highest) highest = data[j].high;
      if (data[j].low < lowest) lowest = data[j].low;
    }
    const range = highest - lowest;
    rawK.push(range === 0 ? 50 : ((data[i].close - lowest) / range) * 100);
  }

  // Smooth %K with SMA
  const percentK = sma(rawK, smooth);

  // %D = SMA of %K
  const percentD = sma(percentK, dPeriod);

  return { percentK, percentD };
}

function sma(values: (number | null)[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (values[j] !== null) { sum += values[j]!; count++; }
    }
    return count === period ? sum / count : null;
  });
}
