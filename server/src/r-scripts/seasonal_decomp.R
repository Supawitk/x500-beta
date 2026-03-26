# Seasonal Decomposition & Cycle Analysis
# STL decomposition, monthly/weekly return patterns, cycle detection
# Input: { prices, dates }
# Output: trend, seasonal, residual components + pattern statistics

library(jsonlite)

input  <- fromJSON(readLines("stdin", warn = FALSE))
prices <- as.numeric(input$prices)
dates  <- as.character(input$dates)

result <- tryCatch({
  n <- length(prices)
  if (n < 60) stop("Need >= 60 prices")

  returns <- diff(log(prices)) * 100

  # ── STL Decomposition ───────────────────────────────────────────────────
  # Create ts object with weekly frequency (5 trading days)
  freq <- 5  # weekly cycle
  if (n > 252) freq <- 21  # monthly cycle for longer series

  ts_prices <- ts(prices, frequency = freq)
  stl_fit   <- tryCatch(
    stl(ts_prices, s.window = "periodic"),
    error = function(e) NULL
  )

  if (!is.null(stl_fit)) {
    trend     <- as.numeric(stl_fit$time.series[, "trend"])
    seasonal  <- as.numeric(stl_fit$time.series[, "seasonal"])
    remainder <- as.numeric(stl_fit$time.series[, "remainder"])

    # Strength of seasonality: 1 - var(remainder) / var(seasonal + remainder)
    season_strength <- round(1 - var(remainder) / var(seasonal + remainder), 3)
    trend_strength  <- round(1 - var(remainder) / var(trend + remainder), 3)
  } else {
    # Fallback: simple moving average decomposition
    ma_window <- min(21, floor(n / 3))
    trend <- stats::filter(prices, rep(1/ma_window, ma_window), sides = 2)
    trend <- as.numeric(trend)
    trend[is.na(trend)] <- prices[is.na(trend)]
    seasonal  <- prices - trend
    remainder <- rep(0, n)
    season_strength <- 0
    trend_strength  <- 0.5
  }

  # Decomposition chart data (subsample for performance)
  step <- max(1, floor(n / 200))
  decomp_data <- lapply(seq(1, n, by = step), function(i) {
    list(
      date      = dates[i],
      price     = round(prices[i], 2),
      trend     = round(trend[i], 2),
      seasonal  = round(seasonal[i], 2),
      residual  = round(remainder[i], 2)
    )
  })

  # ── Monthly return patterns ──────────────────────────────────────────────
  parsed_dates <- as.Date(dates)
  months       <- as.integer(format(parsed_dates, "%m"))
  weekdays     <- as.integer(format(parsed_dates, "%u"))  # 1=Mon, 5=Fri

  # Monthly stats (using returns, not prices)
  ret_dates <- parsed_dates[-1]
  ret_months <- as.integer(format(ret_dates, "%m"))
  ret_wdays  <- as.integer(format(ret_dates, "%u"))

  month_names <- c("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
  monthly_stats <- lapply(1:12, function(m) {
    r <- returns[ret_months == m]
    if (length(r) < 2) return(list(month = month_names[m], avg = 0, median = 0, pct_positive = 50, count = 0))
    list(
      month        = month_names[m],
      avg          = round(mean(r), 3),
      median       = round(median(r), 3),
      std          = round(sd(r), 3),
      pct_positive = round(mean(r > 0) * 100, 1),
      count        = length(r),
      best         = round(max(r), 2),
      worst        = round(min(r), 2)
    )
  })

  # ── Day-of-week patterns ─────────────────────────────────────────────────
  day_names <- c("Mon", "Tue", "Wed", "Thu", "Fri")
  weekday_stats <- lapply(1:5, function(d) {
    r <- returns[ret_wdays == d]
    if (length(r) < 2) return(list(day = day_names[d], avg = 0, pct_positive = 50, count = 0))
    list(
      day          = day_names[d],
      avg          = round(mean(r), 4),
      pct_positive = round(mean(r > 0) * 100, 1),
      count        = length(r)
    )
  })

  # ── Cycle detection via autocorrelation ──────────────────────────────────
  max_lag <- min(120, floor(n / 3))
  acf_vals <- acf(returns, lag.max = max_lag, plot = FALSE)$acf
  acf_data <- lapply(1:min(60, max_lag), function(i) {
    list(lag = i, acf = round(acf_vals[i + 1], 4))
  })

  # Find dominant cycle (first significant peak after lag 5)
  conf_bound <- 1.96 / sqrt(length(returns))
  dominant_cycle <- NA
  for (lag in 5:max_lag) {
    if (abs(acf_vals[lag + 1]) > conf_bound &&
        acf_vals[lag + 1] > acf_vals[lag] &&
        acf_vals[lag + 1] > acf_vals[lag + 2]) {
      dominant_cycle <- lag
      break
    }
  }

  # ── Mean reversion test (Hurst exponent approximation) ──────────────────
  # R/S analysis simplified
  calc_hurst <- function(x) {
    n_h <- length(x)
    if (n_h < 20) return(0.5)
    y <- cumsum(x - mean(x))
    r_s <- (max(y) - min(y)) / sd(x)
    log(r_s) / log(n_h)
  }
  hurst <- round(calc_hurst(returns), 3)
  hurst_interp <- if (hurst > 0.6) "Trending (persistent series, momentum works)"
    else if (hurst < 0.4) "Mean-reverting (anti-persistent, contrarian works)"
    else "Random walk (no clear persistence)"

  # ── Current seasonal signal ──────────────────────────────────────────────
  current_month <- as.integer(format(parsed_dates[n], "%m"))
  current_day   <- as.integer(format(parsed_dates[n], "%u"))
  month_data    <- monthly_stats[[current_month]]
  current_signal <- list(
    month_bias     = month_data$avg,
    month_positive = month_data$pct_positive,
    seasonal_component = round(seasonal[n], 2),
    trend_direction = if (n > 10) ifelse(trend[n] > trend[n-10], "Up", "Down") else "Flat"
  )

  list(
    success           = TRUE,
    decomposition     = decomp_data,
    season_strength   = season_strength,
    trend_strength    = trend_strength,
    monthly_patterns  = monthly_stats,
    weekday_patterns  = weekday_stats,
    autocorrelation   = acf_data,
    dominant_cycle    = ifelse(is.na(dominant_cycle), 0, dominant_cycle),
    hurst_exponent    = hurst,
    hurst_interp      = hurst_interp,
    current_signal    = current_signal,
    conf_bound        = round(conf_bound, 4),
    frequency_used    = freq
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
