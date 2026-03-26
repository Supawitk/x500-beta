# Pattern backtesting with statistical evaluation
# Input: { "prices": [num], "dates": [str], "window": int, "lookahead": int }

library(jsonlite)

input <- fromJSON(readLines("stdin", warn = FALSE))
prices <- as.numeric(input$prices)
dates <- as.character(input$dates)
window <- as.integer(ifelse(is.null(input$window), 20, input$window))
lookahead <- as.integer(ifelse(is.null(input$lookahead), 14, input$lookahead))

result <- tryCatch({
  n <- length(prices)
  if (n < window + lookahead + 60) stop("Insufficient data for pattern matching")

  normalize_window <- function(p) (p / p[1] - 1) * 100
  current <- normalize_window(prices[(n - window + 1):n])

  matches <- list()
  max_start <- n - window - lookahead

  for (i in seq(1, max_start - window, by = 1)) {
    hist_window <- normalize_window(prices[i:(i + window - 1)])
    r <- cor(current, hist_window)
    if (is.na(r) || r <= 0.7) next

    # RMSE between normalized patterns
    rmse <- sqrt(mean((current - hist_window)^2))

    # R-squared
    ss_res <- sum((current - hist_window)^2)
    ss_tot <- sum((current - mean(current))^2)
    r_squared <- ifelse(ss_tot == 0, 0, 1 - ss_res / ss_tot)

    # Outcome after this pattern
    after_start <- i + window
    after_end <- min(after_start + lookahead - 1, n)
    after_prices <- prices[after_start:after_end]
    entry_price <- prices[after_start - 1]
    after_returns <- (after_prices / entry_price - 1) * 100

    matches[[length(matches) + 1]] <- list(
      start_date = dates[i],
      end_date = dates[i + window - 1],
      correlation = round(r, 4),
      r_squared = round(r_squared, 4),
      rmse = round(rmse, 4),
      after_return = round(tail(after_returns, 1), 2),
      max_gain = round(max(after_returns), 2),
      max_loss = round(min(after_returns), 2),
      after_prices = round(after_returns, 2)
    )
  }

  # Sort by correlation
  if (length(matches) > 0) {
    corrs <- sapply(matches, function(m) m$correlation)
    matches <- matches[order(-corrs)]
    matches <- head(matches, 15)
  }

  # Aggregate statistics
  nm <- length(matches)
  if (nm > 0) {
    all_returns <- sapply(matches, function(m) m$after_return)
    all_gains <- sapply(matches, function(m) m$max_gain)
    all_losses <- sapply(matches, function(m) m$max_loss)
    all_r2 <- sapply(matches, function(m) m$r_squared)
    all_rmse <- sapply(matches, function(m) m$rmse)

    # Average path
    max_path_len <- max(sapply(matches, function(m) length(m$after_prices)))
    avg_path <- rep(0, max_path_len)
    p5_path <- rep(0, max_path_len)
    p95_path <- rep(0, max_path_len)
    for (d in 1:max_path_len) {
      day_vals <- sapply(matches, function(m) if(d <= length(m$after_prices)) m$after_prices[d] else NA)
      day_vals <- day_vals[!is.na(day_vals)]
      avg_path[d] <- round(mean(day_vals), 2)
      p5_path[d] <- round(quantile(day_vals, 0.1), 2)
      p95_path[d] <- round(quantile(day_vals, 0.9), 2)
    }

    # Confidence scoring (0-100)
    # Factors: avg R², number of matches, consistency of direction
    r2_score <- min(mean(all_r2) * 100, 40)  # max 40 pts
    match_score <- min(nm / 10 * 20, 20)     # max 20 pts for 10+ matches
    direction <- mean(all_returns > 0)
    consistency_score <- abs(direction - 0.5) * 2 * 30  # max 30 if all same direction
    rmse_score <- max(0, 10 - mean(all_rmse))           # max 10 for low RMSE
    confidence <- round(min(r2_score + match_score + consistency_score + rmse_score, 100))

    # Directional bias
    if (direction >= 0.7) bias <- "Bullish"
    else if (direction <= 0.3) bias <- "Bearish"
    else bias <- "Mixed / Uncertain"

    summary <- list(
      total_matches = nm,
      avg_return = round(mean(all_returns), 2),
      median_return = round(median(all_returns), 2),
      std_return = round(sd(all_returns), 2),
      pct_positive = round(mean(all_returns > 0) * 100, 1),
      avg_max_gain = round(mean(all_gains), 2),
      avg_max_loss = round(mean(all_losses), 2),
      best_match_return = round(max(all_returns), 2),
      worst_match_return = round(min(all_returns), 2),
      avg_r_squared = round(mean(all_r2), 4),
      avg_rmse = round(mean(all_rmse), 4),
      confidence_score = confidence,
      directional_bias = bias,
      avg_path = avg_path,
      p10_path = p5_path,
      p90_path = p95_path
    )
  } else {
    summary <- list(
      total_matches = 0, avg_return = 0, median_return = 0, std_return = 0,
      pct_positive = 0, avg_max_gain = 0, avg_max_loss = 0,
      best_match_return = 0, worst_match_return = 0,
      avg_r_squared = 0, avg_rmse = 0, confidence_score = 0,
      directional_bias = "No data", avg_path = c(), p10_path = c(), p90_path = c()
    )
  }

  current_pattern <- list(
    dates = dates[(n - window + 1):n],
    normalized = round(current, 2)
  )

  list(
    success = TRUE,
    window = window,
    lookahead = lookahead,
    current_pattern = current_pattern,
    matches = matches,
    summary = summary,
    note = "Pattern matching finds similar historical shapes. It is NOT a reliable predictor."
  )
}, error = function(e) {
  list(success = FALSE, error = e$message)
})

cat(toJSON(result, auto_unbox = TRUE))
