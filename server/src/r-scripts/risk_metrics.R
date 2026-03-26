# Compute risk metrics for a single stock
# Input: JSON { "prices": [number], "risk_free": number }
# Output: Sharpe, Sortino, MaxDrawdown, Volatility, Skewness, Kurtosis

library(jsonlite)

input <- fromJSON(readLines("stdin", warn = FALSE))
prices <- as.numeric(input$prices)
rf_annual <- as.numeric(ifelse(is.null(input$risk_free), 0.05, input$risk_free))

result <- tryCatch({
  n <- length(prices)
  returns <- diff(prices) / prices[-n]

  rf_daily <- rf_annual / 252
  excess <- returns - rf_daily

  # Annualized metrics
  ann_return <- mean(returns) * 252
  ann_vol <- sd(returns) * sqrt(252)

  # Sharpe ratio
  sharpe <- (ann_return - rf_annual) / ann_vol

  # Sortino (downside deviation)
  downside <- returns[returns < rf_daily] - rf_daily
  downside_dev <- sqrt(mean(downside^2)) * sqrt(252)
  sortino <- if(downside_dev > 0) (ann_return - rf_annual) / downside_dev else NA

  # Maximum drawdown
  cum_max <- cummax(prices)
  drawdowns <- (prices - cum_max) / cum_max
  max_dd <- min(drawdowns)
  max_dd_end <- which.min(drawdowns)
  max_dd_start <- which.max(prices[1:max_dd_end])

  # Distribution
  skewness <- mean(((returns - mean(returns)) / sd(returns))^3)
  kurtosis <- mean(((returns - mean(returns)) / sd(returns))^4)

  # Calmar ratio
  calmar <- if(max_dd < 0) ann_return / abs(max_dd) else NA

  # Win rate
  win_rate <- mean(returns > 0)

  # Volatility regime (rolling 20-day)
  if(n > 20) {
    rolling_vol <- sapply(21:n, function(i) sd(returns[(i-20):(i-1)]) * sqrt(252))
    current_vol_percentile <- mean(rolling_vol <= tail(rolling_vol, 1))
  } else {
    rolling_vol <- NULL
    current_vol_percentile <- NA
  }

  list(
    success = TRUE,
    ann_return = round(ann_return, 4),
    ann_volatility = round(ann_vol, 4),
    sharpe_ratio = round(sharpe, 4),
    sortino_ratio = round(sortino, 4),
    max_drawdown = round(max_dd, 4),
    max_dd_period = paste0("Day ", max_dd_start, " to ", max_dd_end),
    calmar_ratio = round(calmar, 4),
    skewness = round(skewness, 4),
    kurtosis = round(kurtosis, 4),
    win_rate = round(win_rate, 4),
    current_vol_percentile = round(current_vol_percentile, 4),
    vol_regime = if(!is.na(current_vol_percentile)) {
      if(current_vol_percentile > 0.8) "High volatility"
      else if(current_vol_percentile > 0.5) "Normal"
      else "Low volatility"
    } else "Insufficient data",
    total_return = round((tail(prices,1) / prices[1] - 1), 4),
    trading_days = n,
    note = "Risk-free rate assumed at 5% annual. Metrics based on historical data."
  )
}, error = function(e) {
  list(success = FALSE, error = e$message)
})

cat(toJSON(result, auto_unbox = TRUE))
