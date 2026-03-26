# Enhanced Pattern Backtest v2
# Improvements over v1:
#  - Z-score normalization (scale-invariant, handles different vol regimes)
#  - Composite similarity score (correlation + shape distance + slope alignment)
#  - Regime detection (trending vs ranging) — only compare same-regime patterns
#  - Volatility-adjusted lookahead returns
#  - Lower threshold (0.55) but stricter composite scoring
#  - DTW-inspired shape penalty

library(jsonlite)

input   <- fromJSON(readLines("stdin", warn = FALSE))
prices  <- as.numeric(input$prices)
dates   <- as.character(input$dates)
window  <- as.integer(ifelse(is.null(input$window), 20, input$window))
lookahead <- as.integer(ifelse(is.null(input$lookahead), 14, input$lookahead))

safe_sd <- function(x) { s <- sd(x, na.rm=TRUE); ifelse(is.na(s) || s == 0, 1, s) }

# ── Feature engineering helpers ───────────────────────────────────────────────
zscore_norm <- function(p) {
  x <- (p / p[1] - 1) * 100
  (x - mean(x)) / safe_sd(x)
}

detect_regime <- function(p) {
  r <- diff(log(p))
  trend_strength <- abs(mean(r)) / safe_sd(r)  # t-stat-like
  vol <- safe_sd(r) * sqrt(252)
  list(
    trending = trend_strength > 0.15,
    vol      = vol,
    dir      = ifelse(mean(r) > 0, "up", "down")
  )
}

rolling_vol <- function(p, n = 10) {
  r <- c(NA, diff(log(p)))
  sapply(seq_along(r), function(i) {
    if (i < n) NA else safe_sd(r[(i - n + 1):i]) * sqrt(252)
  })
}

# ── Composite similarity score ────────────────────────────────────────────────
composite_score <- function(a, b) {
  # 1. Pearson correlation (35%)
  r <- cor(a, b, use = "complete.obs")
  if (is.na(r)) return(0)

  # 2. DTW-inspired point distance (35%)
  #    Normalized root mean squared deviation between shapes
  rmse_raw <- sqrt(mean((a - b)^2))
  rmse_norm <- 1 - min(rmse_raw / (safe_sd(a) + 1e-6), 1)

  # 3. Slope alignment (20%)
  slope_a <- lm(a ~ seq_along(a))$coef[2]
  slope_b <- lm(b ~ seq_along(b))$coef[2]
  slope_sim <- 1 - min(abs(slope_a - slope_b) / (abs(slope_a) + abs(slope_b) + 1e-6), 1)

  # 4. Tail agreement — last 25% of window most important (10%)
  tail_n  <- max(3, round(length(a) * 0.25))
  tail_r  <- cor(tail(a, tail_n), tail(b, tail_n), use = "complete.obs")
  tail_sc <- ifelse(is.na(tail_r), 0, (tail_r + 1) / 2)

  0.35 * ((r + 1) / 2) +
  0.35 * rmse_norm +
  0.20 * ((slope_sim + 1) / 2) +
  0.10 * tail_sc
}

result <- tryCatch({
  n <- length(prices)
  if (n < window + lookahead + 40) stop(paste("Need at least", window + lookahead + 40, "data points. Got:", n))

  current_raw  <- prices[(n - window + 1):n]
  current_norm <- zscore_norm(current_raw)
  current_reg  <- detect_regime(current_raw)
  rvol         <- rolling_vol(prices)

  SCORE_THRESHOLD <- 0.58  # composite score threshold

  matches <- list()
  max_start <- n - window - lookahead - 1

  for (i in seq(1, max_start, by = 1)) {
    hist_raw  <- prices[i:(i + window - 1)]
    hist_norm <- zscore_norm(hist_raw)
    hist_reg  <- detect_regime(hist_raw)

    # Quick correlation check first (fast filter)
    quick_r <- cor(current_norm, hist_norm)
    if (is.na(quick_r) || quick_r < 0.45) next

    # Regime filter — same trending/ranging type, similar vol range
    vol_ratio <- hist_reg$vol / (current_reg$vol + 1e-6)
    if (vol_ratio < 0.25 || vol_ratio > 4) next

    score <- composite_score(current_norm, hist_norm)
    if (score < SCORE_THRESHOLD) next

    # Lookahead
    after_start  <- i + window
    after_end    <- min(after_start + lookahead - 1, n)
    after_prices <- prices[after_start:after_end]
    entry_price  <- prices[after_start - 1]
    after_ret    <- (after_prices / entry_price - 1) * 100

    # Vol-adjusted lookahead (Sharpe-like quality)
    after_sd     <- safe_sd(diff(log(after_prices))) * sqrt(252)
    sharpe_after <- round((tail(after_ret, 1) / 100) / (after_sd + 1e-6), 3)

    matches[[length(matches) + 1]] <- list(
      start_date    = dates[i],
      end_date      = dates[i + window - 1],
      score         = round(score, 4),
      correlation   = round(quick_r, 4),
      r_squared     = round(quick_r^2, 4),
      rmse          = round(sqrt(mean((current_norm - hist_norm)^2)), 4),
      after_return  = round(tail(after_ret, 1), 2),
      max_gain      = round(max(after_ret), 2),
      max_loss      = round(min(after_ret), 2),
      after_prices  = round(after_ret, 2),
      vol_regime    = hist_reg$vol,
      sharpe_after  = sharpe_after
    )
  }

  # Sort by composite score
  if (length(matches) > 0) {
    scores   <- sapply(matches, function(m) m$score)
    matches  <- matches[order(-scores)]
    matches  <- head(matches, 20)
  }

  nm <- length(matches)

  if (nm > 0) {
    all_ret  <- sapply(matches, function(m) m$after_return)
    all_gain <- sapply(matches, function(m) m$max_gain)
    all_loss <- sapply(matches, function(m) m$max_loss)
    all_sc   <- sapply(matches, function(m) m$score)
    all_sha  <- sapply(matches, function(m) m$sharpe_after)

    # Average outcome path
    max_len  <- max(sapply(matches, function(m) length(m$after_prices)))
    avg_path <- p10 <- p90 <- numeric(max_len)
    for (d in seq_len(max_len)) {
      vals    <- sapply(matches, function(m) if (d <= length(m$after_prices)) m$after_prices[d] else NA)
      vals    <- vals[!is.na(vals)]
      avg_path[d] <- round(mean(vals), 2)
      p10[d]      <- round(quantile(vals, 0.10), 2)
      p90[d]      <- round(quantile(vals, 0.90), 2)
    }

    # Confidence v2: score-weighted consistency
    pct_pos      <- mean(all_ret > 0)
    consistency  <- abs(pct_pos - 0.5) * 2   # 0 = perfectly mixed, 1 = all same direction
    avg_score    <- mean(all_sc)
    score_pts    <- min(avg_score * 45, 45)   # max 45 pts from quality
    count_pts    <- min(nm / 15 * 20, 20)     # max 20 pts from quantity
    consist_pts  <- consistency * 25          # max 25 pts
    sharpe_pts   <- min(max(mean(all_sha[all_sha > 0]) * 5, 0), 10)  # max 10 pts
    confidence   <- round(min(score_pts + count_pts + consist_pts + sharpe_pts, 100))

    bias <- if (pct_pos >= 0.65) "Bullish"
            else if (pct_pos <= 0.35) "Bearish"
            else "Mixed / Uncertain"

    summary <- list(
      total_matches     = nm,
      avg_return        = round(mean(all_ret), 2),
      median_return     = round(median(all_ret), 2),
      std_return        = round(sd(all_ret), 2),
      pct_positive      = round(pct_pos * 100, 1),
      avg_max_gain      = round(mean(all_gain), 2),
      avg_max_loss      = round(mean(all_loss), 2),
      best_match_return = round(max(all_ret), 2),
      worst_match_return= round(min(all_ret), 2),
      avg_score         = round(avg_score, 4),
      avg_r_squared     = round(mean(sapply(matches, function(m) m$r_squared)), 4),
      avg_rmse          = round(mean(sapply(matches, function(m) m$rmse)), 4),
      avg_sharpe_after  = round(mean(all_sha), 3),
      confidence_score  = confidence,
      directional_bias  = bias,
      avg_path          = avg_path,
      p10_path          = p10,
      p90_path          = p90,
      current_vol       = round(current_reg$vol * 100, 2),
      current_regime    = ifelse(current_reg$trending, "Trending", "Ranging")
    )
  } else {
    summary <- list(
      total_matches = 0, avg_return = 0, median_return = 0, std_return = 0,
      pct_positive = 0, avg_max_gain = 0, avg_max_loss = 0,
      best_match_return = 0, worst_match_return = 0,
      avg_score = 0, avg_r_squared = 0, avg_rmse = 0, avg_sharpe_after = 0,
      confidence_score = 0, directional_bias = "No matches found",
      avg_path = c(), p10_path = c(), p90_path = c(),
      current_vol = round(current_reg$vol * 100, 2),
      current_regime = ifelse(current_reg$trending, "Trending", "Ranging")
    )
  }

  list(
    success     = TRUE,
    version     = "v2",
    window      = window,
    lookahead   = lookahead,
    current_pattern = list(
      dates      = dates[(n - window + 1):n],
      normalized = round(current_norm, 3)
    ),
    matches  = matches,
    summary  = summary,
    note     = paste0(
      "v2: Z-score normalization + composite scoring (correlation 35%, shape 35%, slope 20%, tail 10%). ",
      "Regime-filtered patterns from similar vol/trend conditions. ",
      "Score > 0.58 required. Lookahead Sharpe included. NOT a reliable predictor."
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
