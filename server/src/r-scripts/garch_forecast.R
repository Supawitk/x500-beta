# GARCH(1,1) Volatility Forecast
# Uses rugarch if available, falls back to EWMA volatility model
# Input: { prices, horizon }
# Output: vol forecast, VaR, vol cone, regime analysis

library(jsonlite)

input   <- fromJSON(readLines("stdin", warn = FALSE))
prices  <- as.numeric(input$prices)
horizon <- as.integer(ifelse(is.null(input$horizon), 10, input$horizon))

result <- tryCatch({
  n <- length(prices)
  if (n < 60) stop("Need >= 60 prices")

  returns <- diff(log(prices))
  n_r     <- length(returns)
  last_p  <- prices[n]

  use_garch <- requireNamespace("rugarch", quietly = TRUE)

  if (use_garch) {
    spec <- rugarch::ugarchspec(
      variance.model   = list(model = "sGARCH", garchOrder = c(1, 1)),
      mean.model       = list(armaOrder = c(1, 0)),
      distribution.model = "std"
    )
    fit <- tryCatch(
      rugarch::ugarchfit(spec, returns, solver = "hybrid"),
      error = function(e) NULL
    )

    if (!is.null(fit)) {
      fc <- rugarch::ugarchforecast(fit, n.ahead = horizon)
      vol_fc  <- as.numeric(rugarch::sigma(fc))
      mean_fc <- as.numeric(rugarch::fitted(fc))
      coef_v  <- rugarch::coef(fit)
      alpha   <- as.numeric(coef_v["alpha1"])
      beta_v  <- as.numeric(coef_v["beta1"])
      persist <- alpha + beta_v
      current_sigma <- tail(as.numeric(rugarch::sigma(fit)), 1)

      # Build price forecast fan from GARCH vol
      cum_mean <- cumsum(mean_fc)
      price_fc <- lapply(seq_len(horizon), function(d) {
        vol_d <- sqrt(sum(vol_fc[1:d]^2))
        list(
          day  = d,
          mean = round(last_p * exp(cum_mean[d]), 2),
          lo95 = round(last_p * exp(cum_mean[d] - 1.96 * vol_d), 2),
          hi95 = round(last_p * exp(cum_mean[d] + 1.96 * vol_d), 2),
          lo80 = round(last_p * exp(cum_mean[d] - 1.28 * vol_d), 2),
          hi80 = round(last_p * exp(cum_mean[d] + 1.28 * vol_d), 2)
        )
      })

      model_info <- list(
        type       = "GARCH(1,1) Student-t",
        method     = "rugarch",
        alpha      = round(alpha, 4),
        beta       = round(beta_v, 4),
        persistence = round(persist, 4),
        half_life  = round(log(0.5) / log(max(persist, 0.01)), 1)
      )
    } else {
      use_garch <- FALSE
    }
  }

  if (!use_garch) {
    # EWMA fallback
    lambda  <- 0.94
    ewma_v  <- numeric(n_r)
    ewma_v[1] <- var(returns[1:min(20, n_r)])
    for (i in 2:n_r) ewma_v[i] <- lambda * ewma_v[i-1] + (1-lambda) * returns[i]^2
    current_sigma <- sqrt(ewma_v[n_r])

    vol_fc <- numeric(horizon)
    vol_fc[1] <- current_sigma
    long_var <- var(returns)
    for (i in 2:horizon) vol_fc[i] <- sqrt(lambda * vol_fc[i-1]^2 + (1-lambda) * long_var)

    mu <- mean(returns)
    cum_mean <- (1:horizon) * mu
    price_fc <- lapply(seq_len(horizon), function(d) {
      vol_d <- sqrt(sum(vol_fc[1:d]^2))
      list(
        day  = d,
        mean = round(last_p * exp(cum_mean[d]), 2),
        lo95 = round(last_p * exp(cum_mean[d] - 1.96 * vol_d), 2),
        hi95 = round(last_p * exp(cum_mean[d] + 1.96 * vol_d), 2),
        lo80 = round(last_p * exp(cum_mean[d] - 1.28 * vol_d), 2),
        hi80 = round(last_p * exp(cum_mean[d] + 1.28 * vol_d), 2)
      )
    })

    model_info <- list(
      type        = "EWMA Volatility (lambda=0.94)",
      method      = "ewma",
      persistence = 0.94,
      half_life   = round(log(0.5) / log(0.94), 1)
    )
  }

  # ── Vol Cone (historical vol at different windows) ─────────────────────────
  vol_windows <- c(5, 10, 20, 40, 60, 120, 252)
  vol_cone <- lapply(vol_windows, function(w) {
    if (n_r < w) return(list(window = w, current = NA, min = NA, median = NA, max = NA))
    rolling <- sapply(w:n_r, function(i) sd(returns[(i-w+1):i]) * sqrt(252) * 100)
    list(
      window  = w,
      current = round(sd(tail(returns, w)) * sqrt(252) * 100, 2),
      min     = round(min(rolling), 2),
      median  = round(median(rolling), 2),
      max     = round(max(rolling), 2),
      p25     = round(quantile(rolling, 0.25), 2),
      p75     = round(quantile(rolling, 0.75), 2)
    )
  })

  # ── VaR & CVaR ────────────────────────────────────────────────────────────
  sorted_ret <- sort(returns)
  var95 <- round(quantile(returns, 0.05) * 100, 2)
  var99 <- round(quantile(returns, 0.01) * 100, 2)
  cvar95 <- round(mean(sorted_ret[sorted_ret <= quantile(returns, 0.05)]) * 100, 2)

  # Dollar VaR for current position
  dollar_var95 <- round(last_p * abs(quantile(returns, 0.05)), 2)

  # ── Vol regime ────────────────────────────────────────────────────────────
  recent_vol <- sd(tail(returns, 20)) * sqrt(252) * 100
  hist_vol_20 <- if (n_r >= 252) {
    sapply(20:min(n_r, 252), function(i) sd(returns[(i-19):i]) * sqrt(252) * 100)
  } else {
    sapply(20:n_r, function(i) sd(returns[(i-19):i]) * sqrt(252) * 100)
  }
  vol_percentile <- round(mean(hist_vol_20 <= recent_vol) * 100, 1)
  vol_regime <- if (vol_percentile > 80) "High Volatility"
    else if (vol_percentile > 60) "Elevated"
    else if (vol_percentile > 40) "Normal"
    else if (vol_percentile > 20) "Low"
    else "Very Low Volatility"

  # ── Vol term structure ────────────────────────────────────────────────────
  term_structure <- lapply(c(5, 10, 20, 60), function(w) {
    if (n_r < w) return(list(window = w, vol = NA))
    list(window = w, vol = round(sd(tail(returns, w)) * sqrt(252) * 100, 2))
  })
  # Contango/backwardation
  short_vol <- sd(tail(returns, 10)) * sqrt(252) * 100
  long_vol  <- sd(tail(returns, min(60, n_r))) * sqrt(252) * 100
  vol_shape <- if (short_vol > long_vol * 1.1) "Backwardation (short > long — stress)"
    else if (short_vol < long_vol * 0.9) "Contango (short < long — calm)"
    else "Flat"

  list(
    success         = TRUE,
    model           = model_info,
    current_vol     = round(current_sigma * sqrt(252) * 100, 2),
    vol_forecast    = round(vol_fc * sqrt(252) * 100, 2),
    price_forecast  = price_fc,
    vol_cone        = vol_cone,
    var_metrics     = list(
      var_95_pct  = var95,
      var_99_pct  = var99,
      cvar_95_pct = cvar95,
      dollar_var_95 = dollar_var95
    ),
    regime          = list(
      current    = vol_regime,
      percentile = vol_percentile,
      recent_vol = round(recent_vol, 2),
      shape      = vol_shape
    ),
    term_structure  = term_structure,
    lastPrice       = last_p
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
