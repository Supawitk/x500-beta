#!/usr/bin/env Rscript
# Market regime detection + regime-conditional forecasting
# Uses Hidden Markov-like approach with k-means clustering on return/volatility features
suppressPackageStartupMessages({
  library(jsonlite)
})

input <- fromJSON(readLines(con = "stdin", warn = FALSE))
prices  <- as.numeric(input$prices)
dates   <- as.character(input$dates)
horizon <- as.integer(if (is.null(input$horizon)) 14 else input$horizon)

tryCatch({
  n <- length(prices)
  if (n < 100) stop("Need >= 100 data points for regime detection")

  log_ret <- diff(log(prices))

  # Build rolling features for regime classification
  window <- 20
  feat_mat <- matrix(NA, n - window, 6)
  feat_dates <- dates[(window+1):n]
  for (i in (window+1):n) {
    idx <- i - window
    rets <- log_ret[(i-window):(i-1)]
    feat_mat[idx, 1] <- mean(rets) * 252                     # annualized return
    feat_mat[idx, 2] <- sd(rets) * sqrt(252)                  # annualized vol
    feat_mat[idx, 3] <- mean(rets) / max(sd(rets), 1e-8)     # sharpe-like
    feat_mat[idx, 4] <- sum(rets > 0) / length(rets)          # win rate
    feat_mat[idx, 5] <- max(cummax(cumsum(rets)) - cumsum(rets)) # max drawdown
    feat_mat[idx, 6] <- rets[length(rets)] / max(sd(rets), 1e-8) # recent z-score
  }

  # Remove NAs
  valid <- complete.cases(feat_mat)
  feat_clean <- feat_mat[valid,]
  dates_clean <- feat_dates[valid]
  n_clean <- nrow(feat_clean)

  # Standardize features
  feat_scaled <- scale(feat_clean)

  # K-means with 3 regimes: Bull, Bear, Sideways
  set.seed(42)
  km <- kmeans(feat_scaled, centers=3, nstart=25, iter.max=100)

  # Label regimes by mean return
  cluster_returns <- tapply(feat_clean[,1], km$cluster, mean)
  regime_order <- order(cluster_returns)  # lowest return first
  regime_labels <- rep("", 3)
  regime_labels[regime_order[1]] <- "Bear"
  regime_labels[regime_order[2]] <- "Sideways"
  regime_labels[regime_order[3]] <- "Bull"

  regimes <- regime_labels[km$cluster]
  current_regime <- regimes[n_clean]

  # Regime statistics
  regime_stats <- list()
  for (r in c("Bull", "Bear", "Sideways")) {
    mask <- regimes == r
    if (sum(mask) == 0) next
    r_rets <- feat_clean[mask, 1]
    r_vols <- feat_clean[mask, 2]
    regime_stats[[r]] <- list(
      count = sum(mask),
      pct = round(sum(mask) / n_clean * 100, 1),
      avg_return = round(mean(r_rets), 2),
      avg_vol = round(mean(r_vols), 2),
      avg_winrate = round(mean(feat_clean[mask, 4]) * 100, 1),
      avg_drawdown = round(mean(feat_clean[mask, 5]) * 100, 3)
    )
  }

  # Transition matrix
  trans_mat <- matrix(0, 3, 3)
  regime_ids <- match(regimes, c("Bull", "Bear", "Sideways"))
  for (i in 1:(n_clean - 1)) {
    from <- regime_ids[i]
    to   <- regime_ids[i + 1]
    trans_mat[from, to] <- trans_mat[from, to] + 1
  }
  # Normalize rows
  row_sums <- rowSums(trans_mat)
  row_sums[row_sums == 0] <- 1
  trans_prob <- trans_mat / row_sums
  colnames(trans_prob) <- c("Bull", "Bear", "Sideways")
  rownames(trans_prob) <- c("Bull", "Bear", "Sideways")

  # Next regime probabilities
  current_id <- match(current_regime, c("Bull", "Bear", "Sideways"))
  next_probs <- as.numeric(trans_prob[current_id,])
  names(next_probs) <- c("Bull", "Bear", "Sideways")

  # Regime-conditional forecast
  # Use returns in current regime to simulate forward
  current_mask <- regimes == current_regime
  regime_rets <- log_ret[which(valid)[current_mask]]
  if (length(regime_rets) < 10) regime_rets <- log_ret  # fallback

  n_sims <- 2000
  sims <- matrix(0, n_sims, horizon)
  for (s in 1:n_sims) {
    for (h in 1:horizon) {
      sims[s, h] <- sample(regime_rets, 1)
    }
  }
  cum_sims <- t(apply(sims, 1, cumsum))
  price_sims <- prices[n] * exp(cum_sims)

  fc_summary <- data.frame(
    day = 1:horizon,
    mean = round(apply(price_sims, 2, mean), 2),
    median = round(apply(price_sims, 2, median), 2),
    lo80 = round(apply(price_sims, 2, quantile, 0.10), 2),
    hi80 = round(apply(price_sims, 2, quantile, 0.90), 2),
    lo95 = round(apply(price_sims, 2, quantile, 0.025), 2),
    hi95 = round(apply(price_sims, 2, quantile, 0.975), 2)
  )

  # Regime timeline for chart
  regime_timeline <- data.frame(
    date = dates_clean,
    regime = regimes,
    ret = round(feat_clean[,1], 2),
    vol = round(feat_clean[,2], 2),
    stringsAsFactors = FALSE
  )
  # Sample to max 200 points for chart
  if (nrow(regime_timeline) > 200) {
    idx_sample <- round(seq(1, nrow(regime_timeline), length.out=200))
    regime_timeline <- regime_timeline[idx_sample,]
  }

  # Duration of current regime streak
  streak <- 1
  for (i in (n_clean - 1):1) {
    if (regimes[i] == current_regime) streak <- streak + 1 else break
  }

  # Probability analysis
  final_prices <- price_sims[, horizon]
  prob_up <- mean(final_prices > prices[n])

  result <- list(
    success = TRUE,
    lastPrice = prices[n],
    model = "Regime Detection (K-Means HMM-like)",
    current_regime = current_regime,
    regime_streak = streak,
    regime_stats = regime_stats,
    transition_matrix = round(trans_prob, 3),
    next_regime_prob = round(next_probs, 3),
    forecast = fc_summary,
    probability = list(
      prob_up = round(prob_up, 3),
      expected_return_pct = round((mean(final_prices) / prices[n] - 1) * 100, 2),
      direction = if (prob_up > 0.55) "Bullish" else if (prob_up < 0.45) "Bearish" else "Neutral"
    ),
    regime_timeline = regime_timeline,
    note = paste("Detected", length(unique(regimes)), "regimes using 20-day rolling features. Current regime:", current_regime, "for", streak, "periods.")
  )

  cat(toJSON(result, auto_unbox=TRUE))
}, error=function(e) {
  cat(toJSON(list(success=FALSE, error=e$message), auto_unbox=TRUE))
})
