# Multi-Model Portfolio Optimizer
# Runs 5 optimization strategies in parallel and returns results for comparison
# Requires: jsonlite, quadprog, Matrix
#
# Input JSON: {
#   returns: { SYM: [daily_returns] },
#   symbols: [str],
#   risk_free: number (annual, e.g. 0.05)
# }

library(jsonlite)
library(quadprog)
library(Matrix)

input <- fromJSON(readLines("stdin", warn = FALSE))
symbols <- as.character(input$symbols)
rf_annual <- as.numeric(ifelse(is.null(input$risk_free), 0.05, input$risk_free))
rf_daily <- rf_annual / 252

result <- tryCatch({
  # Build returns matrix
  returns_list <- input$returns
  ret_mat <- do.call(cbind, lapply(symbols, function(s) as.numeric(returns_list[[s]])))
  colnames(ret_mat) <- symbols
  n_assets <- ncol(ret_mat)
  n_days <- nrow(ret_mat)

  # Remove NA rows
  valid <- complete.cases(ret_mat)
  ret_mat <- ret_mat[valid, , drop = FALSE]
  n_days <- nrow(ret_mat)

  if (n_days < 252) stop("Need at least 1 year of data")

  # ── Common statistics ─────────────────────────────────────────
  mu_daily <- colMeans(ret_mat)
  cov_mat <- cov(ret_mat)
  # Ensure covariance matrix is positive definite
  cov_pd <- as.matrix(nearPD(cov_mat, ensureSymmetry = TRUE)$mat)
  vols_daily <- sqrt(diag(cov_pd))
  cor_mat <- cov2cor(cov_pd)

  mu_annual <- mu_daily * 252
  vols_annual <- vols_daily * sqrt(252)

  # ── Helper: backtest a weight vector ──────────────────────────
  backtest_weights <- function(w) {
    port_ret <- ret_mat %*% w
    cum_ret <- cumprod(1 + port_ret)
    total_ret <- as.numeric(tail(cum_ret, 1)) - 1
    ann_ret <- (1 + total_ret)^(252 / n_days) - 1
    ann_vol <- sd(port_ret) * sqrt(252)
    sharpe <- (ann_ret - rf_annual) / max(ann_vol, 1e-8)

    # Max drawdown
    running_max <- cummax(cum_ret)
    drawdowns <- (cum_ret - running_max) / running_max
    max_dd <- min(drawdowns)

    # Yearly outperformance vs equal weight
    ew <- rep(1 / n_assets, n_assets)
    ew_ret <- ret_mat %*% ew
    years_data <- floor(n_days / 252)
    outperf_years <- 0
    total_years <- max(1, years_data)

    for (yr in 1:years_data) {
      s <- (yr - 1) * 252 + 1
      e <- min(yr * 252, n_days)
      if (e - s < 126) next
      yr_opt <- prod(1 + port_ret[s:e]) - 1
      yr_ew <- prod(1 + ew_ret[s:e]) - 1
      if (yr_opt > yr_ew) outperf_years <- outperf_years + 1
    }

    list(
      ann_return = round(ann_ret * 100, 2),
      ann_vol = round(ann_vol * 100, 2),
      sharpe = round(sharpe, 3),
      max_drawdown = round(max_dd * 100, 2),
      outperf_years = outperf_years,
      total_years = total_years
    )
  }

  # ── Helper: normalize weights to sum to 1, floor at 0 ────────
  normalize_weights <- function(w) {
    w <- pmax(w, 0)
    s <- sum(w)
    if (s < 1e-10) return(rep(1 / n_assets, n_assets))
    w / s
  }

  # ── Equal weight baseline ─────────────────────────────────────
  ew <- rep(1 / n_assets, n_assets)
  ew_bt <- backtest_weights(ew)

  # ══════════════════════════════════════════════════════════════
  # MODEL 1: Mean-Variance (Markowitz) - Maximize Sharpe ratio
  # ══════════════════════════════════════════════════════════════
  mv_weights <- tryCatch({
    # Solve: min 0.5 * w' Sigma w  subject to  w'mu = target, sum(w) = 1, w >= 0
    # To maximize Sharpe: use the tangency portfolio approach
    # Solve: min w' Sigma w - lambda * w' (mu - rf)
    # Using quadprog: min 0.5 * x' D x - d' x
    Dmat <- 2 * cov_pd
    dvec <- mu_daily - rf_daily
    # Constraints: sum(w) = 1, w_i >= 0
    Amat <- cbind(rep(1, n_assets), diag(n_assets))
    bvec <- c(1, rep(0, n_assets))
    sol <- solve.QP(Dmat, dvec, Amat, bvec, meq = 1)
    normalize_weights(sol$solution)
  }, error = function(e) {
    # Fallback: equal weight
    rep(1 / n_assets, n_assets)
  })
  mv_bt <- backtest_weights(mv_weights)

  # ══════════════════════════════════════════════════════════════
  # MODEL 2: Minimum Volatility
  # ══════════════════════════════════════════════════════════════
  minvol_weights <- tryCatch({
    # min 0.5 * w' Sigma w,  s.t. sum(w) = 1, w >= 0
    Dmat <- 2 * cov_pd
    dvec <- rep(0, n_assets)
    Amat <- cbind(rep(1, n_assets), diag(n_assets))
    bvec <- c(1, rep(0, n_assets))
    sol <- solve.QP(Dmat, dvec, Amat, bvec, meq = 1)
    normalize_weights(sol$solution)
  }, error = function(e) {
    rep(1 / n_assets, n_assets)
  })
  minvol_bt <- backtest_weights(minvol_weights)

  # ══════════════════════════════════════════════════════════════
  # MODEL 3: Risk Parity
  # ══════════════════════════════════════════════════════════════
  rp_weights <- tryCatch({
    # Iterative approach: adjust weights so marginal risk contributions are equal
    w <- rep(1 / n_assets, n_assets)
    for (iter in 1:500) {
      port_vol <- sqrt(as.numeric(t(w) %*% cov_pd %*% w))
      if (port_vol < 1e-12) break
      # Marginal risk contribution: w_i * (Sigma %*% w)_i / port_vol
      mrc <- as.numeric(cov_pd %*% w) * w / port_vol
      target_rc <- port_vol / n_assets
      # Adjust: increase weight where RC is below target, decrease where above
      adjustment <- target_rc / pmax(mrc, 1e-12)
      w_new <- w * adjustment
      w_new <- normalize_weights(w_new)
      if (max(abs(w_new - w)) < 1e-8) break
      w <- w_new
    }
    normalize_weights(w)
  }, error = function(e) {
    rep(1 / n_assets, n_assets)
  })
  rp_bt <- backtest_weights(rp_weights)

  # ══════════════════════════════════════════════════════════════
  # MODEL 4: Maximum Diversification
  # ══════════════════════════════════════════════════════════════
  maxdiv_weights <- tryCatch({
    # Maximize diversification ratio = (w' sigma) / sqrt(w' Sigma w)
    # Equivalent to: minimize w' Sigma w / (w' sigma)^2
    # Use iterative approach: solve min w' Sigma w s.t. w' sigma = 1, w >= 0
    Dmat <- 2 * cov_pd
    dvec <- rep(0, n_assets)
    Amat <- cbind(vols_daily, diag(n_assets))
    bvec <- c(1, rep(0, n_assets))
    sol <- solve.QP(Dmat, dvec, Amat, bvec, meq = 1)
    normalize_weights(sol$solution)
  }, error = function(e) {
    rep(1 / n_assets, n_assets)
  })
  maxdiv_bt <- backtest_weights(maxdiv_weights)

  # ══════════════════════════════════════════════════════════════
  # MODEL 5: Momentum-Weighted (trailing 6-month, risk-adjusted)
  # ══════════════════════════════════════════════════════════════
  mom_weights <- tryCatch({
    # Use trailing 126 days (6 months)
    lookback <- min(126, n_days)
    trailing <- ret_mat[(n_days - lookback + 1):n_days, , drop = FALSE]
    # Trailing cumulative returns
    trail_ret <- apply(trailing, 2, function(x) prod(1 + x) - 1)
    # Set negative returns to 0
    trail_ret <- pmax(trail_ret, 0)
    # Risk-adjust: divide by volatility
    trail_vol <- apply(trailing, 2, sd) * sqrt(252)
    risk_adj_mom <- trail_ret / pmax(trail_vol, 1e-8)
    # Normalize
    w <- normalize_weights(risk_adj_mom)
    # Cap max weight at 40%
    for (cap_iter in 1:20) {
      over <- w > 0.40
      if (!any(over)) break
      excess <- sum(w[over] - 0.40)
      w[over] <- 0.40
      under <- !over & w > 0
      if (sum(under) == 0) break
      w[under] <- w[under] + excess * w[under] / sum(w[under])
    }
    normalize_weights(w)
  }, error = function(e) {
    rep(1 / n_assets, n_assets)
  })
  mom_bt <- backtest_weights(mom_weights)

  # ── Build model results ───────────────────────────────────────
  build_model <- function(name, weights, bt) {
    w_pct <- round(weights * 100, 2)
    names(w_pct) <- symbols
    w_map <- as.list(w_pct)
    list(
      name = name,
      weights = w_map,
      ann_return = bt$ann_return,
      ann_vol = bt$ann_vol,
      sharpe = bt$sharpe,
      max_drawdown = bt$max_drawdown,
      outperf_years = bt$outperf_years,
      total_years = bt$total_years
    )
  }

  models <- list(
    build_model("Mean-Variance", mv_weights, mv_bt),
    build_model("Min Volatility", minvol_weights, minvol_bt),
    build_model("Risk Parity", rp_weights, rp_bt),
    build_model("Max Diversification", maxdiv_weights, maxdiv_bt),
    build_model("Momentum-Weighted", mom_weights, mom_bt)
  )

  # ── Find best model by Sharpe ─────────────────────────────────
  sharpes <- sapply(models, function(m) m$sharpe)
  best_idx <- which.max(sharpes)

  list(
    success = TRUE,
    models = models,
    equal_weight = list(
      ann_return = ew_bt$ann_return,
      ann_vol = ew_bt$ann_vol,
      sharpe = ew_bt$sharpe
    ),
    best_model = models[[best_idx]]$name
  )
}, error = function(e) {
  list(success = FALSE, error = e$message)
})

cat(toJSON(result, auto_unbox = TRUE, digits = 4))
