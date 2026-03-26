# ML-based Portfolio Weight Optimizer
# Uses cosine similarity pattern matching, rolling backtests, and mean-variance optimization
# Requires: jsonlite, quadprog, Matrix, proxy, zoo, xts
#
# Input JSON: {
#   returns: { SYM: [daily_returns] },  -- 10y of daily returns per symbol
#   symbols: [str],
#   risk_tolerance: "Conservative"|"Moderate"|"Aggressive",
#   risk_free: number (annual, e.g. 0.05)
# }

library(jsonlite)
library(quadprog)
library(Matrix)
library(proxy)
library(zoo)

input <- fromJSON(readLines("stdin", warn = FALSE))
symbols <- as.character(input$symbols)
risk_tolerance <- ifelse(is.null(input$risk_tolerance), "Moderate", input$risk_tolerance)
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

  # ────────────────────────────────────────────────────
  # 1. COSINE SIMILARITY PATTERN MATCHING
  # ────────────────────────────────────────────────────
  # Split data into yearly windows, compute return patterns
  # Compare each year's pattern to find similar regimes
  window_size <- 252  # ~1 trading year
  step <- 63          # ~1 quarter step
  n_windows <- max(1, floor((n_days - window_size) / step) + 1)

  # Build feature vectors for each window: [mean_ret, vol, skew, correlations]
  window_features <- list()
  window_returns <- list()

  for (w in 1:n_windows) {
    start_idx <- (w - 1) * step + 1
    end_idx <- min(start_idx + window_size - 1, n_days)
    if (end_idx - start_idx < 125) next  # skip windows < 6 months

    chunk <- ret_mat[start_idx:end_idx, , drop = FALSE]
    mu <- colMeans(chunk, na.rm = TRUE)
    vol <- apply(chunk, 2, sd, na.rm = TRUE)
    # Skewness
    skew <- apply(chunk, 2, function(x) {
      m <- mean(x, na.rm = TRUE); s <- sd(x, na.rm = TRUE)
      if (s == 0) return(0)
      mean(((x - m) / s)^3, na.rm = TRUE)
    })
    # Pairwise correlations (upper triangle)
    cor_mat <- cor(chunk, use = "pairwise.complete.obs")
    cors <- cor_mat[upper.tri(cor_mat)]

    feature_vec <- c(mu * 252, vol * sqrt(252), skew, cors)  # annualize
    window_features[[length(window_features) + 1]] <- feature_vec
    window_returns[[length(window_returns) + 1]] <- chunk
  }

  # Current window = last window_size days
  current_chunk <- ret_mat[max(1, n_days - window_size + 1):n_days, , drop = FALSE]
  current_mu <- colMeans(current_chunk, na.rm = TRUE)
  current_vol <- apply(current_chunk, 2, sd, na.rm = TRUE)
  current_skew <- apply(current_chunk, 2, function(x) {
    m <- mean(x, na.rm = TRUE); s <- sd(x, na.rm = TRUE)
    if (s == 0) return(0)
    mean(((x - m) / s)^3, na.rm = TRUE)
  })
  current_cor <- cor(current_chunk, use = "pairwise.complete.obs")
  current_cors <- current_cor[upper.tri(current_cor)]
  current_feature <- c(current_mu * 252, current_vol * sqrt(252), current_skew, current_cors)

  # Compute cosine similarity between current and all historical windows
  if (length(window_features) > 1) {
    feat_matrix <- do.call(rbind, window_features)
    cosine_sims <- as.numeric(proxy::simil(
      rbind(current_feature, feat_matrix),
      method = "cosine"
    )[1, ])
    # Take top similar windows (similarity > 0.7)
    top_k <- min(10, length(cosine_sims))
    sorted_idx <- order(cosine_sims, decreasing = TRUE)[1:top_k]
    sim_weights <- cosine_sims[sorted_idx]
    sim_weights[sim_weights < 0] <- 0
    # Normalize to get importance weights
    if (sum(sim_weights) > 0) {
      sim_weights <- sim_weights / sum(sim_weights)
    } else {
      sim_weights <- rep(1 / top_k, top_k)
    }
    avg_cosine_sim <- mean(cosine_sims[sorted_idx])
  } else {
    sorted_idx <- 1
    sim_weights <- 1
    avg_cosine_sim <- 0.5
  }

  # ────────────────────────────────────────────────────
  # 2. SIMILARITY-WEIGHTED MEAN-VARIANCE OPTIMIZATION
  # ────────────────────────────────────────────────────
  # Weight returns from similar periods more heavily
  weighted_mu <- rep(0, n_assets)
  weighted_sigma <- matrix(0, n_assets, n_assets)

  for (k in seq_along(sorted_idx)) {
    idx <- sorted_idx[k]
    if (idx > length(window_returns)) next
    chunk <- window_returns[[idx]]
    mu_k <- colMeans(chunk, na.rm = TRUE)
    sigma_k <- cov(chunk, use = "pairwise.complete.obs")
    weighted_mu <- weighted_mu + sim_weights[k] * mu_k
    weighted_sigma <- weighted_sigma + sim_weights[k] * sigma_k
  }

  # Blend with full-history estimates (60% similar, 40% full)
  full_mu <- colMeans(ret_mat, na.rm = TRUE)
  full_sigma <- cov(ret_mat, use = "pairwise.complete.obs")

  blend_mu <- 0.6 * weighted_mu + 0.4 * full_mu
  blend_sigma <- 0.6 * weighted_sigma + 0.4 * full_sigma

  # Ensure positive definite
  blend_sigma_pd <- tryCatch(
    as.matrix(nearPD(blend_sigma)$mat),
    error = function(e) blend_sigma + diag(1e-8, n_assets)
  )

  # Risk tolerance → target return multiplier
  risk_mult <- switch(risk_tolerance,
    "Conservative" = 0.3,
    "Moderate" = 0.6,
    "Aggressive" = 0.9,
    0.6
  )

  # Quadratic programming: minimize w'Σw subject to constraints
  Dmat <- 2 * blend_sigma_pd
  dvec <- rep(0, n_assets)

  # Constraints: sum(w) = 1, w >= 0, optional return target
  Amat <- cbind(rep(1, n_assets), diag(n_assets))
  bvec <- c(1, rep(0, n_assets))

  # Min variance portfolio
  min_var <- solve.QP(Dmat, dvec, Amat, bvec, meq = 1)
  min_var_w <- pmax(min_var$solution, 0)
  min_var_w <- min_var_w / sum(min_var_w)

  # Max Sharpe portfolio
  target_rets <- seq(min(blend_mu), max(blend_mu), length.out = 20) * 252
  frontier <- lapply(target_rets, function(tr) {
    tryCatch({
      Aef <- cbind(rep(1, n_assets), blend_mu, diag(n_assets))
      bef <- c(1, tr / 252, rep(0, n_assets))
      sol <- solve.QP(Dmat, dvec, Aef, bef, meq = 2)
      w <- pmax(sol$solution, 0); w <- w / sum(w)
      r <- sum(w * blend_mu) * 252
      s <- sqrt(as.numeric(t(w) %*% blend_sigma_pd %*% w)) * sqrt(252)
      sharpe <- (r - rf_annual) / s
      list(weights = w, ret = r, risk = s, sharpe = sharpe)
    }, error = function(e) NULL)
  })
  frontier <- Filter(Negate(is.null), frontier)

  if (length(frontier) == 0) stop("Optimization failed")

  sharpes <- sapply(frontier, function(f) f$sharpe)
  max_sharpe_sol <- frontier[[which.max(sharpes)]]

  # Blend between min_var and max_sharpe based on risk tolerance
  optimal_w <- risk_mult * max_sharpe_sol$weights + (1 - risk_mult) * min_var_w
  optimal_w <- pmax(optimal_w, 0)
  optimal_w <- optimal_w / sum(optimal_w)

  # ────────────────────────────────────────────────────
  # 3. ROLLING YEARLY BACKTEST (each year independently)
  # ────────────────────────────────────────────────────
  yearly_days <- 252
  n_years <- floor(n_days / yearly_days)
  if (n_years < 1) n_years <- 1

  yearly_results <- list()
  yearly_optimal_rets <- c()
  yearly_equal_rets <- c()

  for (y in 1:n_years) {
    start_y <- max(1, n_days - y * yearly_days + 1)
    end_y <- n_days - (y - 1) * yearly_days
    if (start_y >= end_y) next

    year_chunk <- ret_mat[start_y:end_y, , drop = FALSE]
    eq_w <- rep(1 / n_assets, n_assets)

    # Portfolio daily returns
    opt_daily <- as.numeric(year_chunk %*% optimal_w)
    eq_daily <- as.numeric(year_chunk %*% eq_w)

    opt_cum <- prod(1 + opt_daily) - 1
    eq_cum <- prod(1 + eq_daily) - 1

    opt_vol <- sd(opt_daily) * sqrt(252)
    eq_vol <- sd(eq_daily) * sqrt(252)

    opt_sharpe <- ifelse(opt_vol > 0, (mean(opt_daily) * 252 - rf_annual) / opt_vol, 0)

    # Max drawdown
    opt_equity <- cumprod(1 + opt_daily)
    opt_peak <- cummax(opt_equity)
    opt_dd <- min((opt_equity - opt_peak) / opt_peak)

    yearly_results[[length(yearly_results) + 1]] <- list(
      year = y,
      period = paste0("Y-", y),
      optimal_return = round(opt_cum * 100, 2),
      equal_return = round(eq_cum * 100, 2),
      optimal_vol = round(opt_vol * 100, 2),
      optimal_sharpe = round(opt_sharpe, 3),
      max_drawdown = round(opt_dd * 100, 2),
      outperformed = opt_cum > eq_cum
    )

    yearly_optimal_rets <- c(yearly_optimal_rets, opt_cum)
    yearly_equal_rets <- c(yearly_equal_rets, eq_cum)
  }

  # ────────────────────────────────────────────────────
  # 4. FULL BACKTEST
  # ────────────────────────────────────────────────────
  opt_daily_full <- as.numeric(ret_mat %*% optimal_w)
  eq_daily_full <- as.numeric(ret_mat %*% rep(1/n_assets, n_assets))

  opt_equity_full <- cumprod(1 + opt_daily_full)
  eq_equity_full <- cumprod(1 + eq_daily_full)

  opt_total_ret <- tail(opt_equity_full, 1) - 1
  eq_total_ret <- tail(eq_equity_full, 1) - 1

  opt_ann_ret <- (1 + opt_total_ret)^(252 / n_days) - 1
  eq_ann_ret <- (1 + eq_total_ret)^(252 / n_days) - 1

  opt_ann_vol <- sd(opt_daily_full) * sqrt(252)
  eq_ann_vol <- sd(eq_daily_full) * sqrt(252)

  opt_sharpe_full <- ifelse(opt_ann_vol > 0, (opt_ann_ret - rf_annual) / opt_ann_vol, 0)
  eq_sharpe_full <- ifelse(eq_ann_vol > 0, (eq_ann_ret - rf_annual) / eq_ann_vol, 0)

  opt_peak_full <- cummax(opt_equity_full)
  opt_max_dd <- min((opt_equity_full - opt_peak_full) / opt_peak_full)

  # Win rate (days beating equal weight)
  win_days <- sum(opt_daily_full > eq_daily_full)
  win_rate <- win_days / length(opt_daily_full)

  # Outperformance years
  outperf_years <- sum(yearly_optimal_rets > yearly_equal_rets)

  # ────────────────────────────────────────────────────
  # 5. CONFIDENCE SCORE
  # ────────────────────────────────────────────────────
  # Confidence based on:
  # - Cosine similarity (how well current regime matches historical) [0-25]
  # - Sharpe improvement over equal weight [0-25]
  # - Yearly outperformance rate [0-30]
  # - Data sufficiency [0-20]

  score_cosine <- min(25, avg_cosine_sim * 30)

  sharpe_improvement <- opt_sharpe_full - eq_sharpe_full
  score_sharpe <- min(25, max(0, sharpe_improvement * 50))

  score_yearly <- (outperf_years / max(1, n_years)) * 30

  data_years <- n_days / 252
  score_data <- min(20, data_years * 2.5)

  confidence <- round(score_cosine + score_sharpe + score_yearly + score_data, 1)
  confidence <- max(0, min(100, confidence))

  # ────────────────────────────────────────────────────
  # 6. EQUITY CURVE (sampled for chart)
  # ────────────────────────────────────────────────────
  sample_interval <- max(1, floor(n_days / 500))
  sample_idx <- seq(1, n_days, by = sample_interval)

  equity_chart <- data.frame(
    day = sample_idx,
    optimal = round(opt_equity_full[sample_idx] * 100 - 100, 2),
    equal = round(eq_equity_full[sample_idx] * 100 - 100, 2)
  )

  # ────────────────────────────────────────────────────
  # OUTPUT
  # ────────────────────────────────────────────────────
  weights_named <- setNames(as.list(round(optimal_w * 100, 1)), symbols)

  asset_details <- lapply(seq_along(symbols), function(i) {
    s <- symbols[i]
    rets <- ret_mat[, i]
    list(
      symbol = s,
      weight = round(optimal_w[i] * 100, 1),
      ann_return = round(mean(rets, na.rm = TRUE) * 252 * 100, 2),
      ann_vol = round(sd(rets, na.rm = TRUE) * sqrt(252) * 100, 2),
      sharpe = round((mean(rets, na.rm = TRUE) * 252 - rf_annual) / (sd(rets, na.rm = TRUE) * sqrt(252)), 3)
    )
  })

  list(
    success = TRUE,
    confidence = confidence,
    confidence_breakdown = list(
      pattern_similarity = round(score_cosine, 1),
      risk_adjusted_edge = round(score_sharpe, 1),
      yearly_consistency = round(score_yearly, 1),
      data_depth = round(score_data, 1)
    ),
    weights = weights_named,
    assets = asset_details,
    method = "Cosine-similarity weighted mean-variance optimization",
    risk_tolerance = risk_tolerance,
    data_years = round(data_years, 1),
    n_windows_analyzed = length(window_features),
    avg_pattern_similarity = round(avg_cosine_sim, 4),
    backtest = list(
      total_return = round(opt_total_ret * 100, 2),
      ann_return = round(opt_ann_ret * 100, 2),
      ann_vol = round(opt_ann_vol * 100, 2),
      sharpe = round(opt_sharpe_full, 3),
      max_drawdown = round(opt_max_dd * 100, 2),
      daily_win_rate = round(win_rate * 100, 1)
    ),
    vs_equal_weight = list(
      eq_total_return = round(eq_total_ret * 100, 2),
      eq_ann_return = round(eq_ann_ret * 100, 2),
      eq_ann_vol = round(eq_ann_vol * 100, 2),
      eq_sharpe = round(eq_sharpe_full, 3),
      outperformance_ann = round((opt_ann_ret - eq_ann_ret) * 100, 2),
      outperformed_years = outperf_years,
      total_years = n_years
    ),
    yearly_backtest = yearly_results,
    equity_curve = equity_chart
  )

}, error = function(e) {
  list(success = FALSE, error = e$message, confidence = 0)
})

cat(toJSON(result, auto_unbox = TRUE))
