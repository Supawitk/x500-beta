# ETS (Error-Trend-Seasonal) State Space Model with Walk-Forward Validation
# Compares ARIMA vs ETS, selects best by AIC on training data
# Walk-forward: expanding window, step 5 days
# Input: { prices, dates, horizon, train_pct }

library(jsonlite)
library(forecast)

input     <- fromJSON(readLines("stdin", warn = FALSE))
prices    <- as.numeric(input$prices)
dates     <- as.character(input$dates)
horizon   <- as.integer(ifelse(is.null(input$horizon), 10, input$horizon))
train_pct <- ifelse(is.null(input$train_pct), 0.80, as.numeric(input$train_pct))

safe_sd <- function(x) { s <- sd(x, na.rm=TRUE); ifelse(is.na(s)||s==0, 1, s) }

# ── Walk-forward validation ───────────────────────────────────────────────────
walk_forward <- function(prices, step=5, min_train=60) {
  n       <- length(prices)
  results <- list()
  i       <- min_train

  while (i + 1 <= n) {
    train   <- prices[1:i]
    actual  <- prices[i + 1]

    pred <- tryCatch({
      ts_data  <- ts(train, frequency=1)
      ets_fit  <- ets(ts_data, opt.crit="lik", ic="aic")
      fc       <- forecast(ets_fit, h=1)
      as.numeric(fc$mean)
    }, error=function(e) NA)

    if (!is.na(pred)) {
      results[[length(results)+1]] <- list(
        idx    = i + 1,
        date   = if (i + 1 <= length(dates)) dates[i+1] else NA,
        pred   = pred,
        actual = actual,
        dir_ok = sign(pred - prices[i]) == sign(actual - prices[i])
      )
    }
    i <- i + step
  }
  results
}

result <- tryCatch({
  n <- length(prices)
  if (n < 60) stop(paste("Need ≥ 60 prices, got:", n))

  # Split
  train_n  <- max(60, round(n * train_pct))
  train    <- prices[1:train_n]
  test     <- prices[(train_n + 1):n]
  test_dates <- dates[(train_n + 1):n]

  # Fit ETS on training data
  ts_train <- ts(train, frequency=1)
  ets_fit  <- ets(ts_train, opt.crit="lik", ic="aic")

  # Fit ARIMA on same training data
  arima_fit <- tryCatch(auto.arima(ts_train, max.p=3, max.q=3, stepwise=TRUE, approximation=TRUE),
                         error=function(e) NULL)

  # Select model by AIC
  ets_aic   <- ets_fit$aic
  arima_aic <- if (!is.null(arima_fit)) arima_fit$aic else Inf
  use_arima <- (!is.null(arima_fit) && arima_aic < ets_aic)
  best_fit  <- if (use_arima) arima_fit else ets_fit
  model_name<- if (use_arima) paste0("ARIMA(", paste(arimaorder(arima_fit), collapse=","), ")") else ets_fit$method

  # Forecast from end of training
  fc_all   <- forecast(best_fit, h=horizon, level=c(80, 95))

  # Out-of-sample performance on test set
  oos_preds <- numeric(length(test))
  for (j in seq_along(test)) {
    hist_slice <- prices[1:(train_n + j - 1)]
    f <- tryCatch({
      ts_h  <- ts(hist_slice, frequency=1)
      if (use_arima) {
        refit <- tryCatch(
          Arima(ts_h, model=arima_fit),
          error=function(e) auto.arima(ts_h, max.p=2, max.q=2, stepwise=TRUE)
        )
      } else {
        refit <- ets(ts_h, model=ets_fit)
      }
      as.numeric(forecast(refit, h=1)$mean)
    }, error=function(e) NA)
    oos_preds[j] <- f
  }

  valid    <- !is.na(oos_preds) & !is.na(test)
  oos_rmse <- if (sum(valid) > 0) round(sqrt(mean((oos_preds[valid] - test[valid])^2)), 2) else NA
  dir_ok   <- sign(diff(c(train[length(train)], test))) == sign(diff(c(train[length(train)], oos_preds)))
  dir_acc  <- round(mean(dir_ok, na.rm=TRUE) * 100, 1)
  naive_ret<- diff(c(train[length(train)], test))
  naive_acc<- round(mean(sign(naive_ret) == sign(mean(naive_ret))) * 100, 1)
  skill    <- round(dir_acc - naive_acc, 1)

  # Walk-forward (full dataset, step 5)
  wf <- walk_forward(prices, step=5)
  wf_dir_acc <- if (length(wf) > 5) round(mean(sapply(wf, function(r) r$dir_ok)) * 100, 1) else NA

  # Forecast table
  last_price <- tail(prices, 1)
  fc_df <- data.frame(
    day     = seq_len(horizon),
    point   = round(as.numeric(fc_all$mean), 2),
    lo80    = round(as.numeric(fc_all$lower[,1]), 2),
    hi80    = round(as.numeric(fc_all$upper[,1]), 2),
    lo95    = round(as.numeric(fc_all$lower[,2]), 2),
    hi95    = round(as.numeric(fc_all$upper[,2]), 2)
  )

  list(
    success         = TRUE,
    model_type      = model_name,
    selected_by     = "AIC comparison (ETS vs ARIMA)",
    ets_aic         = round(ets_aic, 2),
    arima_aic       = if (!is.null(arima_fit)) round(arima_aic, 2) else NULL,
    train_n         = train_n,
    test_n          = length(test),
    last_price      = round(last_price, 2),
    forecast        = fc_df,
    performance = list(
      oos_rmse     = oos_rmse,
      dir_accuracy = dir_acc,
      naive_accuracy = naive_acc,
      skill_score  = skill,
      wf_dir_accuracy = wf_dir_acc,
      interpretation = paste0(
        model_name, " achieved ", dir_acc, "% directional accuracy on out-of-sample data ",
        "vs naive ", naive_acc, "%. ",
        if (!is.na(skill) && skill > 5) "Meaningful forecast skill detected."
        else if (!is.na(skill) && skill > 0) "Marginal improvement over naive."
        else "No skill above naive — treat forecasts with caution."
      )
    ),
    note = paste0(
      "Best model selected by AIC. Walk-forward over full history. ",
      "Confidence bands widen rapidly — useful only for 1-5 day horizon. NOT financial advice."
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
