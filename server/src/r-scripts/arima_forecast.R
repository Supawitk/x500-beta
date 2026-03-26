# ARIMA forecast with confidence intervals
# Input: JSON from stdin { "prices": [number], "horizon": number }
# Output: JSON forecast with confidence bands

library(jsonlite)
library(forecast)

input <- fromJSON(readLines("stdin", warn = FALSE))
prices <- as.numeric(input$prices)
horizon <- as.integer(ifelse(is.null(input$horizon), 10, input$horizon))

result <- tryCatch({
  ts_data <- ts(prices, frequency = 1)

  # Auto ARIMA with conservative settings
  fit <- auto.arima(ts_data,
    max.p = 3, max.q = 3, max.d = 2,
    stepwise = TRUE, approximation = TRUE)

  fc <- forecast(fit, h = horizon, level = c(80, 95))

  list(
    success = TRUE,
    model = paste0("ARIMA(", paste(arimaorder(fit), collapse=","), ")"),
    aic = round(fit$aic, 2),
    forecast = data.frame(
      point = round(as.numeric(fc$mean), 2),
      lo80 = round(as.numeric(fc$lower[,1]), 2),
      hi80 = round(as.numeric(fc$upper[,1]), 2),
      lo95 = round(as.numeric(fc$lower[,2]), 2),
      hi95 = round(as.numeric(fc$upper[,2]), 2)
    ),
    residual_sd = round(sd(fit$residuals, na.rm = TRUE), 4),
    warning = if(horizon > 20) "Forecasts beyond 20 days have very wide uncertainty" else ""
  )
}, error = function(e) {
  list(success = FALSE, error = e$message)
})

cat(toJSON(result, auto_unbox = TRUE))
