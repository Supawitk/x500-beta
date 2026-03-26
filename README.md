# X500 Beta — S&P 500 Real-Time Dashboard

A comprehensive, real-time stock market dashboard covering all S&P 500 companies. Track prices, analyze trends, compare stocks, build portfolios, and get AI-powered predictions — all in one place.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![R](https://img.shields.io/badge/R-276DC3?style=for-the-badge&logo=r&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

---

## What Is This?

X500 Beta is a full-featured stock market dashboard that gives you professional-grade analysis tools without needing a Bloomberg terminal. It pulls live data from the market, runs statistical models, and presents everything through clean, interactive charts and panels.

Whether you want to check how Apple is doing today, compare Tesla vs. Ford, or see what a Monte Carlo simulation says about your portfolio — this app does it all in your browser.

---

## Features

### Market Dashboard
- **Live prices** for all 500 S&P companies, updating in real time
- **Sector heatmap** showing which industries are up or down
- **Market breadth** — see how many stocks are rising vs. falling
- **Top movers** — biggest gainers, losers, and most active stocks
- **Health scores** — quick snapshot of each stock's financial health

### Stock Analysis
- **Candlestick charts** with infinite scroll — keep scrolling back in time and it loads more data automatically
- **Technical indicators** — RSI, MACD, Stochastic, Ichimoku Cloud, Bollinger Bands, and more
- **Support & resistance levels** — automatically detected price floors and ceilings
- **Risk metrics** — Sharpe ratio, maximum drawdown, volatility, and other risk measures
- **Monthly returns heatmap** — see which months historically perform best
- **Relative performance** — how a stock compares to the overall market

### News & Research
- **Multi-source news** aggregated from Yahoo Finance, Google News, and Bing
- **SEC filings** — 10-K, 10-Q, 8-K, and other regulatory documents pulled directly from EDGAR
- **News impact analysis** — measures how similar past news events affected stock prices over 3, 5, and 10 days
- **News timeline markers** — see exactly where news events fall on the price chart
- **Analyst ratings** — consensus recommendations, price targets, and earnings estimates

### Stock Comparison
- **Side-by-side comparison** of any stocks — price performance, risk, fundamentals
- **Correlation analysis** — find out how closely two stocks move together
- **Radar charts** — visual comparison across multiple dimensions
- **AI verdict** — automated scoring that weighs all factors and gives a recommendation

### Predictions & Forecasting (20 Statistical Models)
- **ARIMA** — classic time series forecasting with confidence intervals
- **GARCH** — predicts future volatility (how wild the price swings might get)
- **Random Forest** — machine learning model trained on historical patterns
- **Bayesian forecasting** — probability-based predictions
- **Regime detection** — identifies whether the market is trending, ranging, or volatile
- **Seasonal analysis** — uncovers recurring patterns (e.g., "this stock tends to rise in December")
- **Ensemble voting** — combines multiple models for a more reliable prediction
- **Monte Carlo simulation** — runs thousands of random scenarios to estimate risk
- **Backtesting** — tests how predictions would have performed on historical data

### Portfolio Builder
- **Build custom portfolios** from any combination of stocks
- **Markowitz optimization** — mathematically finds the best balance of risk and return
- **Strategy backtesting** — see how your portfolio would have done in the past
- **Risk analysis** — Value at Risk (VaR), stress testing, and drawdown analysis

### Stock Screener
- **Filter stocks** by sector, health score, dividend yield, P/E ratio, and more
- **Sortable tables** with real-time data
- **Quick discovery** of stocks matching your criteria

### Watchlist
- **Track your favorite stocks** in a personal watchlist
- **Set target prices** and add notes
- **At-a-glance summary** of your watched stocks

---

## Tech Stack

Here's what powers the app, explained simply:

### The Website (What You See)

| Technology | What It Does |
|---|---|
| ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black) **React** | Builds the interactive user interface — all the buttons, charts, and panels you click on |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) **TypeScript** | The programming language used — like JavaScript but with extra safety checks to prevent bugs |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) **Vite** | Packages all the code and delivers it to your browser super fast |
| **Recharts** | Draws the bar charts, line charts, pie charts, and other data visualizations |
| **Lightweight Charts** | Powers the professional candlestick/trading charts (same library TradingView uses) |
| **Lucide Icons** | Provides all the clean icons throughout the interface |

### The Server (Behind the Scenes)

| Technology | What It Does |
|---|---|
| ![Bun](https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white) **Bun** | Runs the server — like Node.js but significantly faster |
| **ElysiaJS** | Handles all the web requests — when you search for a stock, this routes your request to the right place |
| **Yahoo Finance** | Where the live stock prices, earnings data, and company info come from |
| **SEC EDGAR** | Government database for official company filings (annual reports, quarterly earnings, etc.) |
| **Google & Bing News** | Aggregates news articles from multiple sources for broader coverage |

### The Brain (Statistical Analysis)

| Technology | What It Does |
|---|---|
| ![R](https://img.shields.io/badge/R-276DC3?style=flat-square&logo=r&logoColor=white) **R Language** | Runs all 20 statistical and machine learning models — the math engine behind predictions |
| **forecast** | R package for time series forecasting (ARIMA, ETS, Holt-Winters) |
| **quadprog** | R package for portfolio optimization — solves the math to find ideal stock allocations |
| **MASS / Matrix** | R packages for advanced statistics and Monte Carlo simulations |

### Deployment (How It Gets to You)

| Technology | What It Does |
|---|---|
| ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) **Docker** | Packages the entire app (server + website + R) into one container that runs anywhere |
| ![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white) **Railway** | Cloud platform that hosts and runs the Docker container 24/7 |
| ![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white) **GitHub** | Stores the source code and triggers automatic deployments when code is updated |

---

## Project Structure

```
x500-beta/
├── client/                  # The website (React frontend)
│   ├── src/
│   │   ├── pages/           # Main views (Dashboard, Analysis, Compare, etc.)
│   │   ├── components/      # Reusable UI pieces (charts, panels, tables)
│   │   ├── api/             # Talks to the server
│   │   └── hooks/           # Shared logic
│   └── ...
├── server/                  # The backend server
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (data fetching, caching, analysis)
│   │   ├── r-scripts/       # 20 R statistical models
│   │   └── config/          # S&P 500 stock list and settings
│   └── ...
├── Dockerfile               # Container configuration
├── railway.json             # Deployment configuration
└── README.md
```

---

## Running Locally

### Prerequisites
- [Bun](https://bun.sh) (v1.0+)
- [R](https://www.r-project.org/) (v4.0+) with packages: `jsonlite`, `forecast`, `quadprog`, `Matrix`, `MASS`, `proxy`, `zoo`

### Setup

```bash
# Clone the repo
git clone https://github.com/Supawitk/x500-beta.git
cd x500-beta

# Install dependencies
cd client && bun install && cd ..
cd server && bun install && cd ..

# Start the server (port 3001)
cd server && bun run dev

# In another terminal, start the website (port 5173)
cd client && bun run dev
```

Open **http://localhost:5173** in your browser.

### Install R packages (one-time setup)

```r
install.packages(c("jsonlite", "forecast", "quadprog", "Matrix", "MASS", "proxy", "zoo"))
```

---

## Live Demo

**https://x500-beta-production.up.railway.app**

---

## License

This project is for educational and personal use.

---

*Built with data from Yahoo Finance and SEC EDGAR. Not financial advice.*
