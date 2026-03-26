#!/usr/bin/env Rscript
# Holt-Winters Exponential Smoothing with decomposition + multiple model comparison
suppressPackageStartupMessages({
  library(jsonlite)
})

input <- fromJSON(readLines(con = "stdin", warn = FALSE))
prices <- as.numeric(input$prices)
horizon <- as.integer(if (is.null(input$horizon)) 14 else input$horizon)

tryCatch({
  n <- length(prices)
  if (n < 40) stop("Need at least 40 data points")

  log_prices <- log(prices)

  # --- Simple Exponential Smoothing (level only) ---
  ses_fit <- HoltWinters(ts(log_prices, frequency=5), beta=FALSE, gamma=FALSE)
  ses_fc  <- predict(ses_fit, n.ahead=horizon)

  # --- Double Exponential (Holt: level + trend) ---
  holt_fit <- HoltWinters(ts(log_prices, frequency=5), gamma=FALSE)
  holt_fc  <- predict(holt_fit, n.ahead=horizon)

  # --- Triple (Holt-Winters: level + trend + seasonal) ---
  hw_fit <- tryCatch({
    HoltWinters(ts(log_prices, frequency=5))
  }, error=function(e) NULL)

  hw_fc <- NULL
  if (!is.null(hw_fit)) {
    hw_fc <- predict(hw_fit, n.ahead=horizon)
  }

  # Residual-based confidence intervals
  calc_ci <- function(fit, fc_vals, horizon) {
    resid_sd <- sd(fit$x - fit$fitted[,1], na.rm=TRUE)
    lo80 <- fc_vals - 1.28 * resid_sd * sqrt(1:horizon)
    hi80 <- fc_vals + 1.28 * resid_sd * sqrt(1:horizon)
    lo95 <- fc_vals - 1.96 * resid_sd * sqrt(1:horizon)
    hi95 <- fc_vals + 1.96 * resid_sd * sqrt(1:horizon)
    data.frame(
      day = 1:horizon,
      point = exp(as.numeric(fc_vals)),
      lo80  = exp(as.numeric(lo80)),
      hi80  = exp(as.numeric(hi80)),
      lo95  = exp(as.numeric(lo95)),
      hi95  = exp(as.numeric(hi95))
    )
  }

  ses_result  <- calc_ci(ses_fit, ses_fc, horizon)
  holt_result <- calc_ci(holt_fit, holt_fc, horizon)
  hw_result   <- if (!is.null(hw_fit)) calc_ci(hw_fit, hw_fc, horizon) else NULL

  # Model accuracy on in-sample fitted (last 20% holdout approach)
  holdout <- max(20, round(n * 0.2))
  train   <- log_prices[1:(n - holdout)]
  test    <- log_prices[(n - holdout + 1):n]

  eval_model <- function(train_data, test_data, beta_flag, gamma_flag) {
    tryCatch({
      fit <- HoltWinters(ts(train_data, frequency=5), beta=beta_flag, gamma=gamma_flag)
      fc  <- predict(fit, n.ahead=length(test_data))
      fc_vals <- as.numeric(fc)
      rmse <- sqrt(mean((fc_vals - test_data)^2))
      mae  <- mean(abs(fc_vals - test_data))
      # Directional accuracy
      actual_dir <- diff(test_data) > 0
      fc_dir     <- diff(fc_vals) > 0
      min_len    <- min(length(actual_dir), length(fc_dir))
      dir_acc    <- mean(actual_dir[1:min_len] == fc_dir[1:min_len])
      list(rmse=round(rmse, 6), mae=round(mae, 6), dir_accuracy=round(dir_acc * 100, 1))
    }, error=function(e) list(rmse=NA, mae=NA, dir_accuracy=NA))
  }

  ses_eval  <- eval_model(train, test, FALSE, FALSE)
  holt_eval <- eval_model(train, test, TRUE, FALSE)
  hw_eval   <- eval_model(train, test, TRUE, TRUE)

  # Smoothing parameters
  extract_params <- function(fit) {
    list(alpha=round(fit$alpha, 4), beta=round(if(is.null(fit$beta)) 0 else fit$beta, 4), gamma=round(if(is.null(fit$gamma)) 0 else fit$gamma, 4))
  }

  # Decompose for display
  fitted_ses  <- exp(as.numeric(ses_fit$fitted[,1]))
  fitted_holt <- exp(as.numeric(holt_fit$fitted[,1]))
  start_idx   <- n - length(fitted_ses) + 1

  result <- list(
    success = TRUE,
    lastPrice = prices[n],
    models = list(
      list(
        name = "Simple ES (Level)",
        params = extract_params(ses_fit),
        forecast = ses_result,
        accuracy = ses_eval,
        description = "Flat forecast - suitable for stationary series with no trend"
      ),
      list(
        name = "Holt (Level+Trend)",
        params = extract_params(holt_fit),
        forecast = holt_result,
        accuracy = holt_eval,
        description = "Linear trend projection - suitable for trending series"
      )
    )
  )

  if (!is.null(hw_fit) && !is.null(hw_result)) {
    result$models[[3]] <- list(
      name = "Holt-Winters (Full)",
      params = extract_params(hw_fit),
      forecast = hw_result,
      accuracy = hw_eval,
      description = "Level + Trend + Seasonal - captures weekly patterns"
    )
  }

  # Best model selection by RMSE
  rmses <- sapply(result$models, function(m) m$accuracy$rmse)
  rmses[is.na(rmses)] <- Inf
  best_idx <- which.min(rmses)
  result$best_model <- result$models[[best_idx]]$name
  result$best_forecast <- result$models[[best_idx]]$forecast

  # Trend analysis
  last5 <- prices[(n-4):n]
  trend_slope <- coef(lm(last5 ~ seq_along(last5)))[2]
  result$trend <- list(
    slope = round(trend_slope, 4),
    direction = if (trend_slope > 0) "Uptrend" else "Downtrend",
    strength = round(abs(trend_slope) / mean(last5) * 100, 3)
  )

  cat(toJSON(result, auto_unbox=TRUE))
}, error=function(e) {
  cat(toJSON(list(success=FALSE, error=e$message), auto_unbox=TRUE))
})
