/**
 * Pearson correlation coefficient between two series
 * Returns R value (-1 to 1)
 */
export function calcCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return den === 0 ? 0 : Math.round((num / den) * 10000) / 10000;
}

/**
 * Convert prices to daily returns (percentage changes)
 */
export function toReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

/**
 * Beta = Cov(stock, market) / Var(market)
 */
export function calcBeta(stockReturns: number[], marketReturns: number[]): number {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 2) return 1;

  const meanS = stockReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanM = marketReturns.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let cov = 0, varM = 0;
  for (let i = 0; i < n; i++) {
    const ds = stockReturns[i] - meanS;
    const dm = marketReturns[i] - meanM;
    cov += ds * dm;
    varM += dm * dm;
  }

  return varM === 0 ? 1 : Math.round((cov / varM) * 10000) / 10000;
}

/**
 * Normalize prices to percentage returns from start (for overlaying charts)
 */
export function normalizePrices(prices: number[]): number[] {
  if (prices.length === 0) return [];
  const base = prices[0];
  return prices.map((p) => Math.round(((p / base - 1) * 100) * 100) / 100);
}
