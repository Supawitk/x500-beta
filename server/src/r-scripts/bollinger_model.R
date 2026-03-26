# Bollinger Band Analysis & Mean Reversion Model
# Squeeze detection, %B oscillator, bandwidth analysis, reversion signals
# Input: { prices, highs, lows, volumes, dates, period (BB window), num_sd }
# Output: bands, squeeze events, signals, historical accuracy

library(jsonlite)

input   <- fromJSON(readLines("stdin", warn = FALSE))
prices  <- as.numeric(input$prices)
highs   <- if (!is.null(input$highs)) as.numeric(input$highs) else prices
lows    <- if (!is.null(input$lows))  as.numeric(input$lows)  else prices
volumes <- if (!is.null(input$volumes)) as.numeric(input$volumes) else rep(1e6, length(prices))
dates   <- as.character(input$dates)
bb_period <- as.integer(ifelse(is.null(input$period), 20, input$period))
num_sd    <- as.numeric(ifelse(is.null(input$num_sd), 2, input$num_sd))

result <- tryCatch({
  n <- length(prices)
  if (n < bb_period + 20) stop("Need more data for Bollinger analysis")

  # ── Bollinger Bands ──────────────────────────────────────────────────────
  sma       <- stats::filter(prices, rep(1/bb_period, bb_period), sides = 1)
  sma       <- as.numeric(sma)
  roll_sd   <- sapply(1:n, function(i) {
    if (i < bb_period) return(NA)
    sd(prices[(i-bb_period+1):i])
  })

  upper <- sma + num_sd * roll_sd
  lower <- sma - num_sd * roll_sd

  # %B oscillator: (price - lower) / (upper - lower)
  pct_b <- (prices - lower) / (upper - lower)

  # Bandwidth: (upper - lower) / sma
  bandwidth <- (upper - lower) / sma

  # ── Keltner Channels (for squeeze detection) ─────────────────────────────
  # ATR-based
  atr <- numeric(n)
  for (i in 2:n) {
    tr <- max(highs[i] - lows[i], abs(highs[i] - prices[i-1]), abs(lows[i] - prices[i-1]))
    atr[i] <- tr
  }
  # Smooth ATR
  atr_smooth <- stats::filter(atr, rep(1/bb_period, bb_period), sides = 1)
  atr_smooth <- as.numeric(atr_smooth)

  keltner_upper <- sma + 1.5 * atr_smooth
  keltner_lower <- sma - 1.5 * atr_smooth

  # Squeeze: BB inside Keltner
  squeeze <- rep(FALSE, n)
  for (i in bb_period:n) {
    if (!is.na(keltner_upper[i]) && !is.na(upper[i])) {
      squeeze[i] <- upper[i] < keltner_upper[i] && lower[i] > keltner_lower[i]
    }
  }

  # Squeeze events with duration
  squeeze_events <- list()
  in_squeeze <- FALSE
  sq_start <- 0
  for (i in bb_period:n) {
    if (squeeze[i] && !in_squeeze) {
      in_squeeze <- TRUE
      sq_start <- i
    }
    if (!squeeze[i] && in_squeeze) {
      in_squeeze <- FALSE
      duration <- i - sq_start
      # What happened after squeeze release?
      fwd <- min(n, i + 10)
      after_ret <- (prices[fwd] / prices[i] - 1) * 100
      direction <- ifelse(prices[i] > sma[i], "Bullish breakout", "Bearish breakdown")
      squeeze_events[[length(squeeze_events)+1]] <- list(
        start_date = dates[sq_start],
        end_date   = dates[i],
        duration   = duration,
        direction  = direction,
        after_return_10d = round(after_ret, 2)
      )
    }
  }

  # ── Current signals ──────────────────────────────────────────────────────
  curr_pct_b <- pct_b[n]
  curr_bw    <- bandwidth[n]
  curr_sq    <- squeeze[n]

  # Signal interpretation
  signal <- if (is.na(curr_pct_b)) "Insufficient data"
    else if (curr_sq) "Squeeze active — expecting breakout"
    else if (curr_pct_b > 1.0) "Above upper band — overbought / momentum"
    else if (curr_pct_b > 0.8) "Upper zone — bullish but extended"
    else if (curr_pct_b > 0.5) "Above midline — bullish"
    else if (curr_pct_b > 0.2) "Below midline — bearish"
    else if (curr_pct_b > 0.0) "Lower zone — bearish but oversold bounce possible"
    else "Below lower band — oversold / capitulation"

  # W-Bottom / M-Top detection (simplified)
  pattern <- "None"
  if (n > 30) {
    last30_pctb <- pct_b[(n-29):n]
    last30_pctb <- last30_pctb[!is.na(last30_pctb)]
    if (length(last30_pctb) >= 20) {
      # W-bottom: two lows near 0 with higher low
      low_zones <- which(last30_pctb < 0.1)
      if (length(low_zones) >= 2) {
        first_low <- low_zones[1]
        last_low  <- low_zones[length(low_zones)]
        if (last_low - first_low > 5 && any(last30_pctb[first_low:last_low] > 0.5)) {
          pattern <- "W-Bottom forming (bullish reversal)"
        }
      }
      # M-top: two highs near 1 with lower high
      high_zones <- which(last30_pctb > 0.9)
      if (length(high_zones) >= 2) {
        first_high <- high_zones[1]
        last_high  <- high_zones[length(high_zones)]
        if (last_high - first_high > 5 && any(last30_pctb[first_high:last_high] < 0.5)) {
          pattern <- "M-Top forming (bearish reversal)"
        }
      }
    }
  }

  # ── Historical accuracy: how often does BB signal predict correctly? ────
  n_tests <- 0; correct <- 0
  for (i in (bb_period+1):(n-5)) {
    if (is.na(pct_b[i])) next
    if (pct_b[i] < 0.05) {
      # Oversold: expect bounce
      n_tests <- n_tests + 1
      if (prices[min(n, i+5)] > prices[i]) correct <- correct + 1
    } else if (pct_b[i] > 0.95) {
      # Overbought: expect pullback
      n_tests <- n_tests + 1
      if (prices[min(n, i+5)] < prices[i]) correct <- correct + 1
    }
  }
  reversion_accuracy <- if (n_tests > 0) round(correct / n_tests * 100, 1) else NA

  # ── Bandwidth percentile (squeeze proximity) ────────────────────────────
  valid_bw <- bandwidth[!is.na(bandwidth)]
  bw_percentile <- if (length(valid_bw) > 10 && !is.na(curr_bw)) {
    round(mean(valid_bw <= curr_bw) * 100, 1)
  } else NA

  # ── Band chart data (subsample) ─────────────────────────────────────────
  step <- max(1, floor(n / 150))
  band_data <- lapply(seq(bb_period, n, by = step), function(i) {
    list(
      date   = dates[i],
      price  = round(prices[i], 2),
      upper  = round(upper[i], 2),
      middle = round(sma[i], 2),
      lower  = round(lower[i], 2),
      pct_b  = round(pct_b[i], 4),
      bw     = round(bandwidth[i], 4),
      squeeze = squeeze[i]
    )
  })

  list(
    success           = TRUE,
    current           = list(
      price            = round(prices[n], 2),
      upper_band       = round(upper[n], 2),
      middle_band      = round(sma[n], 2),
      lower_band       = round(lower[n], 2),
      pct_b            = round(curr_pct_b, 4),
      bandwidth        = round(curr_bw, 4),
      bw_percentile    = bw_percentile,
      in_squeeze       = curr_sq,
      signal           = signal,
      pattern          = pattern
    ),
    band_data         = band_data,
    squeeze_events    = squeeze_events,
    total_squeezes    = length(squeeze_events),
    reversion_accuracy = reversion_accuracy,
    reversion_tests   = n_tests,
    note = paste0(
      "Bollinger Bands (", bb_period, ", ", num_sd, " SD). ",
      "Squeeze = bands inside Keltner Channels (low vol preceding breakout). ",
      "%B > 1 = above upper band, < 0 = below lower band. ",
      "Mean reversion accuracy is historical and does not guarantee future results."
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
