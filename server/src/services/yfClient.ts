import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Suppress strict validation errors — Yahoo frequently changes their API
// response format which causes the library's schema validation to fail,
// even though the data is still usable.
yf.setGlobalConfig({ validation: { logErrors: false } });

export default yf;
