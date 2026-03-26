/**
 * Exponential Moving Average
 * period: number of periods (e.g. 12, 26, 50, 200)
 */
export function calcEMA(closes: number[], period: number): (number | null)[] {
  if (closes.length < period) return closes.map(() => null);

  const k = 2 / (period + 1);
  const result: (number | null)[] = [];

  // SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
    result.push(null);
  }
  result[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    const prev = result[i - 1]!;
    result.push(closes[i] * k + prev * (1 - k));
  }

  return result;
}

/**
 * MACD: EMA(12) - EMA(26), Signal = EMA(9) of MACD
 */
export function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);

  const macdLine = ema12.map((v, i) =>
    v !== null && ema26[i] !== null ? v - ema26[i]! : null
  );

  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalRaw = calcEMA(validMacd, 9);

  // Align signal line back to original indices
  const signal: (number | null)[] = macdLine.map(() => null);
  let si = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      signal[i] = signalRaw[si] ?? null;
      si++;
    }
  }

  const histogram = macdLine.map((v, i) =>
    v !== null && signal[i] !== null ? v - signal[i]! : null
  );

  return { macdLine, signal, histogram };
}
