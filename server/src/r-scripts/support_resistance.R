# Support & Resistance Level Detection
# Uses local extrema + kernel density clustering + volume-weighted levels
# Input: { prices, highs, lows, volumes, dates }
# Output: key levels, strength scores, current position analysis

library(jsonlite)

input   <- fromJSON(readLines("stdin", warn = FALSE))
prices  <- as.numeric(input$prices)
highs   <- if (!is.null(input$highs)) as.numeric(input$highs) else prices
lows    <- if (!is.null(input$lows))  as.numeric(input$lows)  else prices
volumes <- if (!is.null(input$volumes)) as.numeric(input$volumes) else rep(1e6, length(prices))
dates   <- as.character(input$dates)

result <- tryCatch({
  n <- length(prices)
  if (n < 40) stop("Need >= 40 prices")

  last_p <- prices[n]

  # ── Local extrema detection ───────────────────────────────────────────────
  # Use a 5-bar lookback/forward for pivot highs/lows
  pivots_h <- c()
  pivots_l <- c()
  k <- 5

  for (i in (k+1):(n-k)) {
    if (all(highs[i] >= highs[(i-k):(i-1)]) && all(highs[i] >= highs[(i+1):(i+k)])) {
      pivots_h <- c(pivots_h, highs[i])
    }
    if (all(lows[i] <= lows[(i-k):(i-1)]) && all(lows[i] <= lows[(i+1):(i+k)])) {
      pivots_l <- c(pivots_l, lows[i])
    }
  }

  all_pivots <- c(pivots_h, pivots_l)

  # ── Kernel density clustering ─────────────────────────────────────────────
  if (length(all_pivots) < 3) {
    # Fallback: use simple percentile levels
    levels <- as.numeric(quantile(prices, c(0.1, 0.25, 0.5, 0.75, 0.9)))
    level_types <- c("Support", "Support", "Pivot", "Resistance", "Resistance")
    strengths <- rep(50, 5)
  } else {
    bw <- diff(range(prices)) * 0.02  # 2% of price range as bandwidth
    if (bw < 0.01) bw <- 0.5
    dens <- density(all_pivots, bw = bw, n = 512)

    # Find peaks in density
    d_vals <- dens$y
    d_x    <- dens$x
    peaks  <- c()
    for (i in 2:(length(d_vals)-1)) {
      if (d_vals[i] > d_vals[i-1] && d_vals[i] > d_vals[i+1]) {
        peaks <- c(peaks, i)
      }
    }

    if (length(peaks) == 0) peaks <- which.max(d_vals)

    # Take top peaks by density value
    peak_order <- order(d_vals[peaks], decreasing = TRUE)
    top_peaks  <- peaks[peak_order[1:min(8, length(peak_order))]]

    levels    <- d_x[top_peaks]
    strengths <- round(d_vals[top_peaks] / max(d_vals[top_peaks]) * 100)

    # Classify as support/resistance relative to current price
    level_types <- ifelse(levels < last_p * 0.995, "Support",
                   ifelse(levels > last_p * 1.005, "Resistance", "Pivot"))
  }

  # ── Volume-weighted price levels (VWAP zones) ────────────────────────────
  # Volume profile: bin prices and weight by volume
  n_bins   <- 30
  p_range  <- range(prices)
  bin_edges <- seq(p_range[1], p_range[2], length.out = n_bins + 1)
  vol_profile <- numeric(n_bins)
  for (i in 1:n) {
    bin <- findInterval(prices[i], bin_edges, rightmost.closed = TRUE)
    bin <- max(1, min(n_bins, bin))
    vol_profile[bin] <- vol_profile[bin] + volumes[i]
  }
  bin_mids <- (bin_edges[-length(bin_edges)] + bin_edges[-1]) / 2

  # High Volume Nodes (HVN) — where most trading occurred
  vol_threshold <- quantile(vol_profile, 0.7)
  hvn_bins <- which(vol_profile >= vol_threshold)
  hvn_levels <- if (length(hvn_bins) > 0) round(bin_mids[hvn_bins], 2) else numeric(0)

  # Point of Control (POC) — single highest volume price
  poc <- round(bin_mids[which.max(vol_profile)], 2)

  # ── Fibonacci levels from recent swing ───────────────────────────────────
  recent <- tail(prices, min(60, n))
  swing_high <- max(recent)
  swing_low  <- min(recent)
  fib_range  <- swing_high - swing_low
  fib_levels <- list(
    f0    = round(swing_high, 2),
    f236  = round(swing_high - fib_range * 0.236, 2),
    f382  = round(swing_high - fib_range * 0.382, 2),
    f500  = round(swing_high - fib_range * 0.500, 2),
    f618  = round(swing_high - fib_range * 0.618, 2),
    f786  = round(swing_high - fib_range * 0.786, 2),
    f1    = round(swing_low, 2)
  )

  # ── Current position analysis ────────────────────────────────────────────
  # Find nearest support and resistance
  supports    <- sort(levels[levels < last_p * 0.998], decreasing = TRUE)
  resistances <- sort(levels[levels > last_p * 1.002])

  nearest_sup <- if (length(supports) > 0) supports[1] else swing_low
  nearest_res <- if (length(resistances) > 0) resistances[1] else swing_high

  dist_to_support    <- round((last_p - nearest_sup) / last_p * 100, 2)
  dist_to_resistance <- round((nearest_res - last_p) / last_p * 100, 2)
  risk_reward_pos    <- if (dist_to_support > 0) round(dist_to_resistance / dist_to_support, 2) else NA

  # Zone classification
  zone <- if (dist_to_support < 1) "Near Support — potential bounce zone"
    else if (dist_to_resistance < 1) "Near Resistance — potential reversal zone"
    else if (dist_to_support < dist_to_resistance) "Closer to support — slight bullish bias"
    else "Closer to resistance — slight bearish bias"

  # ── Breakout probability ─────────────────────────────────────────────────
  # Count how many times price tested and broke through nearest levels
  tests_res <- sum(highs > nearest_res * 0.99 & highs < nearest_res * 1.01)
  breaks_res <- sum(prices > nearest_res * 1.005)
  tests_sup <- sum(lows < nearest_sup * 1.01 & lows > nearest_sup * 0.99)
  breaks_sup <- sum(prices < nearest_sup * 0.995)

  # Build output levels list
  out_levels <- lapply(seq_along(levels), function(i) {
    list(
      price    = round(levels[i], 2),
      type     = level_types[i],
      strength = strengths[i],
      dist_pct = round((levels[i] - last_p) / last_p * 100, 2)
    )
  })
  # Sort by price descending
  out_levels <- out_levels[order(sapply(out_levels, function(x) x$price), decreasing = TRUE)]

  # Volume profile for chart
  vol_profile_out <- lapply(seq_along(bin_mids), function(i) {
    list(price = round(bin_mids[i], 2), volume = round(vol_profile[i]))
  })

  list(
    success           = TRUE,
    lastPrice         = last_p,
    levels            = out_levels,
    fibonacci         = fib_levels,
    volume_profile    = vol_profile_out,
    poc               = poc,
    hvn_levels        = hvn_levels,
    position_analysis = list(
      nearest_support    = round(nearest_sup, 2),
      nearest_resistance = round(nearest_res, 2),
      dist_to_support    = dist_to_support,
      dist_to_resistance = dist_to_resistance,
      risk_reward        = risk_reward_pos,
      zone               = zone,
      res_tests          = tests_res,
      res_breaks         = breaks_res,
      sup_tests          = tests_sup,
      sup_breaks         = breaks_sup
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
