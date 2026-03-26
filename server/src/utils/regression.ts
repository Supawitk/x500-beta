/**
 * Simple Linear Regression on closing prices
 * Returns slope, intercept, r-squared, and predicted values
 */
export function calcRegression(closes: number[]) {
  const n = closes.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, line: closes };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += closes[i];
    sumXY += i * closes[i];
    sumX2 += i * i;
    sumY2 += closes[i] * closes[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  const line: number[] = [];

  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    line.push(predicted);
    ssRes += (closes[i] - predicted) ** 2;
    ssTot += (closes[i] - yMean) ** 2;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 100) / 100,
    rSquared: Math.round(rSquared * 10000) / 10000,
    line,
  };
}

/**
 * Trend direction based on regression slope
 */
export function trendDirection(slope: number, price: number): string {
  const pctSlope = (slope / price) * 100;
  if (pctSlope > 0.1) return "Strong Uptrend";
  if (pctSlope > 0.02) return "Uptrend";
  if (pctSlope < -0.1) return "Strong Downtrend";
  if (pctSlope < -0.02) return "Downtrend";
  return "Sideways";
}
