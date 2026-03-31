#!/usr/bin/env Rscript
# Portfolio strategy simulation: backtest + forward projection
# Supports: long, short, value, dividend, growth, custom weighted
suppressPackageStartupMessages({ library(jsonlite) })

input <- fromJSON(readLines("stdin", warn = FALSE))
returns_list <- input$returns  # named list of return vectors
symbols <- as.character(input$symbols)
weights <- as.numeric(input$weights)
strategy <- as.character(if (is.null(input$strategy)) "long" else input$strategy)
strategy2 <- as.character(if (is.null(input$strategy2)) "" else input$strategy2)
goal_return <- as.numeric(if (is.null(input$goal_return)) 10 else input$goal_return)  # annual %
goal_years <- as.numeric(if (is.null(input$goal_years)) 5 else input$goal_years)
initial_investment <- as.numeric(if (is.null(input$initial)) 10000 else input$initial)
monthly_contrib <- as.numeric(if (is.null(input$monthly)) 0 else input$monthly)
risk_tolerance <- as.character(if (is.null(input$risk_tolerance)) "Moderate" else input$risk_tolerance)
rebalance_freq <- as.character(if (is.null(input$rebalance)) "Quarterly" else input$rebalance)
stop_loss_pct <- as.numeric(if (is.null(input$stop_loss)) 0 else input$stop_loss) / 100
take_profit_pct <- as.numeric(if (is.null(input$take_profit)) 0 else input$take_profit) / 100

tryCatch({
  n_assets <- length(symbols)
  if (n_assets < 1) stop("Need at least 1 symbol")

  # Build returns matrix
  ret_mat <- do.call(cbind, lapply(symbols, function(s) as.numeric(returns_list[[s]])))
  colnames(ret_mat) <- symbols
  n_days <- nrow(ret_mat)
  if (n_days < 20) stop("Insufficient data")

  # Normalize weights
  if (length(weights) != n_assets) weights <- rep(1/n_assets, n_assets)
  weights <- weights / sum(weights)

  # Risk tolerance volatility scaling
  risk_scale <- switch(risk_tolerance,
    "Conservative" = 0.6,
    "Moderate" = 1.0,
    "Aggressive" = 1.4,
    1.0
  )

  # Rebalance frequency in trading days
  rebal_days <- switch(rebalance_freq,
    "Monthly" = 21,
    "Quarterly" = 63,
    "Annually" = 252,
    "Never" = n_days + 1,
    63
  )

  # Strategy adjustments — blend primary + secondary if provided
  apply_strategy <- function(rmat, strat) {
    if (strat == "short") return(-rmat)
    rmat  # long, value, dividend, growth, custom all use base returns
  }
  ret_mat <- apply_strategy(ret_mat, strategy)
  if (nchar(strategy2) > 0 && strategy2 != "") {
    ret_mat2 <- apply_strategy(do.call(cbind, lapply(symbols, function(s) as.numeric(returns_list[[s]]))), strategy2)
    ret_mat <- 0.7 * ret_mat + 0.3 * ret_mat2  # 70/30 primary/secondary blend
  }

  # Portfolio daily returns with rebalancing, stop-loss, and take-profit
  port_ret <- numeric(n_days)
  running_weights <- weights
  peak_value <- 1.0
  cum_value <- 1.0
  stopped_out <- FALSE
  taken_profit <- FALSE

  for (d in 1:n_days) {
    # Daily return using current weights
    port_ret[d] <- sum(ret_mat[d, ] * running_weights)

    # Update cumulative value
    cum_value <- cum_value * (1 + port_ret[d])

    # Track peak for stop-loss
    if (cum_value > peak_value) peak_value <- cum_value

    # Stop-loss check
    if (stop_loss_pct > 0 && !stopped_out) {
      drawdown <- (peak_value - cum_value) / peak_value
      if (drawdown >= stop_loss_pct) {
        stopped_out <- TRUE
        port_ret[d:n_days] <- 0  # Exit position
        break
      }
    }

    # Take-profit check
    if (take_profit_pct > 0 && !taken_profit) {
      gain <- cum_value / 1.0 - 1
      if (gain >= take_profit_pct) {
        taken_profit <- TRUE
        port_ret[d:n_days] <- 0  # Lock in gains
        break
      }
    }

    # Rebalance weights periodically
    if (d %% rebal_days == 0 && d < n_days) {
      # Drift weights based on returns, then rebalance back to target
      asset_growth <- 1 + ret_mat[d, ]
      running_weights <- running_weights * asset_growth
      running_weights <- weights  # Snap back to target weights
    }
  }

  # ── Historical performance (backtest) ──
  cum_ret <- cumprod(1 + port_ret)
  final_cum <- cum_ret[length(cum_ret)]
  total_return <- (final_cum - 1) * 100
  ann_return <- ((final_cum)^(252/n_days) - 1) * 100
  ann_vol <- sd(port_ret) * sqrt(252) * 100
  sharpe <- (ann_return / 100 - 0.05) / (ann_vol / 100)
  sortino_downside <- sd(port_ret[port_ret < 0]) * sqrt(252)
  sortino <- if (sortino_downside > 0) (ann_return / 100 - 0.05) / sortino_downside else 0

  # Max drawdown
  cum_max <- cummax(cum_ret)
  drawdowns <- (cum_ret - cum_max) / cum_max
  max_dd <- min(drawdowns) * 100
  dd_end <- which.min(drawdowns)
  dd_start <- which.max(cum_ret[1:dd_end])
  win_rate <- mean(port_ret > 0) * 100

  # Calmar
  calmar <- if (max_dd < 0) ann_return / 100 / abs(max_dd / 100) else 0

  # Per-asset stats
  asset_stats <- lapply(1:n_assets, function(i) {
    r <- ret_mat[, i]
    ar <- ((prod(1 + r))^(252/length(r)) - 1) * 100
    av <- sd(r) * sqrt(252) * 100
    list(
      symbol = symbols[i],
      weight = round(weights[i] * 100, 1),
      ann_return = round(ar, 2),
      ann_vol = round(av, 2),
      sharpe = round((ar/100 - 0.05) / (av/100), 2),
      total_return = round((prod(1 + r) - 1) * 100, 2)
    )
  })

  # Correlation matrix
  if (n_assets >= 2) {
    cor_mat <- round(cor(ret_mat), 3)
  } else {
    cor_mat <- matrix(1, 1, 1)
  }

  # Monthly returns for equity curve
  monthly_rets <- c()
  month_labels <- c()
  chunk_size <- 21  # ~1 month
  for (i in seq(1, n_days, chunk_size)) {
    end_i <- min(i + chunk_size - 1, n_days)
    mr <- prod(1 + port_ret[i:end_i]) - 1
    monthly_rets <- c(monthly_rets, mr * 100)
    month_labels <- c(month_labels, paste0("M", ceiling(i / chunk_size)))
  }

  # ── Forward projection (Monte Carlo) ──
  n_sims <- 3000
  trading_days <- round(goal_years * 252)
  active_rets <- port_ret[port_ret != 0]  # Exclude zeroed-out days from stop/TP
  mu <- mean(active_rets) * risk_scale
  sigma <- sd(active_rets) * risk_scale

  # Simulate paths with stop-loss and take-profit applied
  sim_values <- matrix(0, n_sims, trading_days)
  for (s in 1:n_sims) {
    val <- initial_investment
    sim_peak <- val
    sim_stopped <- FALSE
    for (d in 1:trading_days) {
      if (sim_stopped) {
        sim_values[s, d] <- val
        next
      }
      daily_ret <- rnorm(1, mu, sigma)
      val <- val * (1 + daily_ret)
      if (val > sim_peak) sim_peak <- val

      # Monthly contribution every 21 days
      if (d %% 21 == 0 && monthly_contrib > 0) val <- val + monthly_contrib

      # Sim stop-loss
      if (stop_loss_pct > 0 && (sim_peak - val) / sim_peak >= stop_loss_pct) {
        sim_stopped <- TRUE
      }
      # Sim take-profit
      total_contrib_so_far <- initial_investment + monthly_contrib * floor(d / 21)
      if (take_profit_pct > 0 && val / total_contrib_so_far - 1 >= take_profit_pct) {
        sim_stopped <- TRUE
      }

      sim_values[s, d] <- val
    }
  }

  # Percentile paths (sample every ~month)
  sample_days <- seq(1, trading_days, by = 21)
  if (sample_days[length(sample_days)] != trading_days) sample_days <- c(sample_days, trading_days)

  fan_chart <- lapply(sample_days, function(d) {
    vals <- sim_values[, d]
    list(
      month = round(d / 21),
      p5 = round(quantile(vals, 0.05), 0),
      p25 = round(quantile(vals, 0.25), 0),
      p50 = round(quantile(vals, 0.50), 0),
      p75 = round(quantile(vals, 0.75), 0),
      p95 = round(quantile(vals, 0.95), 0)
    )
  })

  # Goal analysis
  total_contrib <- initial_investment + monthly_contrib * 12 * goal_years
  goal_value <- initial_investment * (1 + goal_return/100)^goal_years +
    if (monthly_contrib > 0) monthly_contrib * 12 * ((1 + goal_return/100)^goal_years - 1) / (goal_return/100) else 0

  final_values <- sim_values[, trading_days]
  prob_goal <- mean(final_values >= goal_value) * 100
  prob_profit <- mean(final_values > total_contrib) * 100
  expected_value <- round(mean(final_values), 0)
  median_value <- round(median(final_values), 0)
  worst_case <- round(quantile(final_values, 0.05), 0)
  best_case <- round(quantile(final_values, 0.95), 0)

  expected_cagr <- ((expected_value / initial_investment)^(1/goal_years) - 1) * 100

  # Distribution of final returns
  final_rets <- (final_values / total_contrib - 1) * 100
  hist_breaks <- seq(floor(min(final_rets)/5)*5, ceiling(max(final_rets)/5)*5, by = 5)
  if (length(hist_breaks) < 3) hist_breaks <- seq(floor(min(final_rets)), ceiling(max(final_rets)), length.out = 20)
  h <- hist(final_rets, breaks = hist_breaks, plot = FALSE)
  hist_data <- data.frame(
    bin = round((h$breaks[-length(h$breaks)] + h$breaks[-1]) / 2, 1),
    count = h$counts
  )

  # Risk-adjusted metrics
  var_95 <- round(quantile(final_values, 0.05), 0)
  cvar_95 <- round(mean(final_values[final_values <= var_95]), 0)

  result <- list(
    success = TRUE,
    strategy = strategy,
    strategy2 = if (nchar(strategy2) > 0) strategy2 else NULL,
    risk_tolerance = risk_tolerance,
    rebalance = rebalance_freq,
    stop_loss = stop_loss_pct * 100,
    take_profit = take_profit_pct * 100,
    stopped_out = stopped_out,
    taken_profit = taken_profit,
    n_assets = n_assets,
    n_days = n_days,
    initial = initial_investment,
    monthly = monthly_contrib,
    goal_years = goal_years,
    goal_return = goal_return,

    backtest = list(
      total_return = round(total_return, 2),
      ann_return = round(ann_return, 2),
      ann_vol = round(ann_vol, 2),
      sharpe = round(sharpe, 2),
      sortino = round(sortino, 2),
      calmar = round(calmar, 2),
      max_drawdown = round(max_dd, 2),
      win_rate = round(win_rate, 1),
      equity_curve = round(as.numeric(cum_ret) * initial_investment, 0),
      monthly_returns = round(monthly_rets, 2),
      month_labels = month_labels
    ),

    assets = asset_stats,
    correlation = cor_mat,

    projection = list(
      goal_value = round(goal_value, 0),
      total_contributed = round(total_contrib, 0),
      expected_value = expected_value,
      median_value = median_value,
      worst_case_5pct = as.numeric(worst_case),
      best_case_95pct = as.numeric(best_case),
      prob_goal = round(prob_goal, 1),
      prob_profit = round(prob_profit, 1),
      expected_cagr = round(expected_cagr, 2),
      var_95 = as.numeric(var_95),
      cvar_95 = as.numeric(cvar_95),
      fan_chart = fan_chart,
      return_histogram = hist_data
    )
  )

  cat(toJSON(result, auto_unbox = TRUE))
}, error = function(e) {
  cat(toJSON(list(success = FALSE, error = e$message), auto_unbox = TRUE))
})
