/**
 * Calculate Graham Number: sqrt(22.5 * EPS * Book Value per Share)
 */
export function calcGrahamNumber(
  eps: number | null,
  priceToBook: number | null,
  price: number
): number | null {
  if (!eps || eps <= 0 || !priceToBook || priceToBook <= 0) return null;
  const bookValue = price / priceToBook;
  const value = 22.5 * eps * bookValue;
  if (value <= 0) return null;
  return Math.round(Math.sqrt(value) * 100) / 100;
}

/**
 * Simple intrinsic value estimate using Graham's formula:
 * V = EPS * (8.5 + 2g) where g = expected growth rate
 * We use a conservative 5% growth estimate
 */
export function calcIntrinsicValue(eps: number | null): number | null {
  if (!eps || eps <= 0) return null;
  const growthRate = 5;
  return Math.round(eps * (8.5 + 2 * growthRate) * 100) / 100;
}

/**
 * Margin of Safety = (Intrinsic Value - Price) / Intrinsic Value * 100
 */
export function calcMarginOfSafety(
  intrinsicValue: number | null,
  price: number
): number | null {
  if (!intrinsicValue || intrinsicValue <= 0) return null;
  return Math.round(((intrinsicValue - price) / intrinsicValue) * 10000) / 100;
}

/**
 * Health score 0-100 based on value investing fundamentals:
 * - Reasonable P/E (< 25): +25
 * - Has dividend: +20, higher yield: +bonus
 * - Positive margin of safety: +25
 * - Low debt-to-equity (< 1): +15
 * - Positive ROE: +15
 */
export function calcHealthScore(opts: {
  peRatio: number | null;
  dividendYield: number | null;
  marginOfSafety: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
}): number | null {
  const { peRatio, dividendYield, marginOfSafety, debtToEquity, returnOnEquity } = opts;
  let score = 0;
  let factors = 0;

  if (peRatio !== null) {
    factors++;
    if (peRatio > 0 && peRatio < 15) score += 25;
    else if (peRatio >= 15 && peRatio < 25) score += 15;
    else if (peRatio >= 25 && peRatio < 35) score += 5;
  }
  if (dividendYield !== null) {
    factors++;
    if (dividendYield > 0.04) score += 20;
    else if (dividendYield > 0.02) score += 15;
    else if (dividendYield > 0) score += 10;
  }
  if (marginOfSafety !== null) {
    factors++;
    if (marginOfSafety > 20) score += 25;
    else if (marginOfSafety > 0) score += 15;
    else if (marginOfSafety > -20) score += 5;
  }
  if (debtToEquity !== null) {
    factors++;
    if (debtToEquity >= 0 && debtToEquity < 50) score += 15;
    else if (debtToEquity >= 50 && debtToEquity < 100) score += 10;
    else if (debtToEquity >= 100 && debtToEquity < 200) score += 5;
  }
  if (returnOnEquity !== null) {
    factors++;
    if (returnOnEquity > 0.2) score += 15;
    else if (returnOnEquity > 0.1) score += 10;
    else if (returnOnEquity > 0) score += 5;
  }

  if (factors === 0) return null;
  return Math.round((score / factors) * (100 / 20));
}
