import YahooFinance from "yahoo-finance2";

const _yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Suppress strict validation — Yahoo frequently changes their API response
// format which causes the library's schema validation to throw errors,
// even though the data is still perfectly usable.
_yf.setGlobalConfig({ validation: { logErrors: false } });

// Wrap commonly used methods to always pass validateResult: false
const noValidate = { validateResult: false } as const;

const yf = {
  quote: (query: any, opts?: any) =>
    _yf.quote(query, opts, noValidate),
  chart: (symbol: string, opts?: any) =>
    _yf.chart(symbol, opts, noValidate),
  quoteSummary: (symbol: string, opts?: any) =>
    _yf.quoteSummary(symbol, opts, noValidate),
  search: (query: string, opts?: any) =>
    _yf.search(query, opts, noValidate),
  insights: (symbol: string, opts?: any) =>
    _yf.insights(symbol, opts, noValidate),
  fundamentalsTimeSeries: (symbol: string, opts?: any) =>
    _yf.fundamentalsTimeSeries(symbol, opts, noValidate),
};

export default yf;
