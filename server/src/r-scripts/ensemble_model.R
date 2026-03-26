# Ensemble Model: combines ARIMA direction, ETS direction, Factor Model, RF
# Weighted voting by each model's walk-forward skill score
# Also includes regime-aware weighting: trending → weight ARIMA more, ranging → RF more
# Input: { prices, volumes, highs, lows, dates, lookahead, model_results }
# model_results: pre-computed results from individual models passed in

suppressPackageStartupMessages({
  library(jsonlite)
  if (requireNamespace("forecast", quietly=TRUE)) library(forecast)
})

raw_input <- readLines("stdin", warn = FALSE)
input     <- fromJSON(raw_input, simplifyVector = TRUE, simplifyDataFrame = TRUE)
closes    <- as.numeric(input$prices)
highs     <- if (!is.null(input$highs)) as.numeric(input$highs) else closes
lows      <- if (!is.null(input$lows))  as.numeric(input$lows)  else closes
volumes   <- if (!is.null(input$volumes)) as.numeric(input$volumes) else rep(1e6, length(closes))
dates     <- as.character(input$dates)
lookahead <- as.integer(ifelse(is.null(input$lookahead), 10, input$lookahead))
# Pre-computed model results passed in — may be data.frame, list, or NULL/empty
model_res <- input$model_results

# Ensure model_res is workable — if it came as an atomic vector, wrap it
if (is.atomic(model_res) && !is.null(model_res)) {
  # It's a simple vector (e.g., empty character or JSON string), treat as empty
  model_res <- NULL
}

safe_sd <- function(x) { s <- sd(x, na.rm=TRUE); ifelse(is.na(s)||s==0,1,s) }

lag_f <- function(x, k) c(rep(NA, k), head(x, -k))
ema_f <- function(x, k) {
  a <- 2/(k+1); e <- numeric(length(x)); e[1] <- x[1]
  for (i in 2:length(x)) e[i] <- a*x[i]+(1-a)*e[i-1]; e
}

result <- tryCatch({
  n <- length(closes)
  if (n < 60) stop("Need ≥ 60 prices")

  # ── Current regime detection ───────────────────────────────────────────────
  ret_recent <- diff(log(tail(closes, 30)))
  trend_str  <- abs(mean(ret_recent)) / safe_sd(ret_recent)
  is_trending<- trend_str > 0.12
  current_vol<- safe_sd(ret_recent) * sqrt(252)

  # Recent momentum
  mom5  <- (closes[n] / closes[max(1, n-5)] - 1) * 100
  mom20 <- (closes[n] / closes[max(1, n-20)] - 1) * 100

  # MACD for trend
  e12 <- ema_f(closes, 12); e26 <- ema_f(closes, 26)
  macd_val <- e12[n] - e26[n]

  # RSI quick
  ret1 <- c(NA, diff(closes))
  rsi_val <- tryCatch({
    r_slice <- ret1[(n-13):n]
    g <- pmax(r_slice, 0); l <- pmax(-r_slice, 0)
    100 - 100/(1 + mean(g, na.rm=TRUE)/(mean(l, na.rm=TRUE)+1e-9))
  }, error=function(e) 50)

  # ── Ensemble logic ─────────────────────────────────────────────────────────
  # jsonlite converts array-of-objects into a data.frame; handle both forms
  n_models <- 0
  if (is.data.frame(model_res) && nrow(model_res) > 0) {
    n_models <- nrow(model_res)
  } else if (is.list(model_res) && !is.null(model_res) && length(model_res) > 0 && !is.data.frame(model_res)) {
    # Check it's actually a list of model results, not an empty/atomic thing
    first <- model_res[[1]]
    if (is.list(first) && !is.null(first$name)) {
      n_models <- length(model_res)
    }
  }

  if (n_models > 0) {
    # Use pre-computed results
    weighted_up   <- 0; weighted_down <- 0; total_weight <- 0
    model_votes   <- list()

    for (i in seq_len(n_models)) {
      if (is.data.frame(model_res)) {
        m_name  <- as.character(model_res$name[i])
        m_dir   <- as.character(model_res$direction[i])
        m_prob  <- as.numeric(model_res$prob_up[i])
        m_skill <- as.numeric(model_res$skill_score[i])
      } else {
        m_name  <- as.character(model_res[[i]]$name)
        m_dir   <- as.character(model_res[[i]]$direction)
        m_prob  <- as.numeric(model_res[[i]]$prob_up)
        m_skill <- as.numeric(model_res[[i]]$skill_score)
      }

      if (is.na(m_skill) || is.null(m_skill)) m_skill <- 0
      w <- max(m_skill, 1)
      if (is_trending && grepl("ARIMA|ETS", m_name)) w <- w * 1.3
      if (!is_trending && grepl("Forest|Factor", m_name)) w <- w * 1.2

      if (is.na(m_prob)) m_prob <- 0.5
      weighted_up   <- weighted_up + m_prob * w
      weighted_down <- weighted_down + (1 - m_prob) * w
      total_weight  <- total_weight + w
      model_votes[[length(model_votes)+1]] <- list(
        name=m_name, direction=m_dir, prob_up=round(m_prob,4),
        skill=round(m_skill,1), weight=round(w,2)
      )
    }
    ensemble_prob_up <- weighted_up / total_weight

    all_dirs <- if (is.data.frame(model_res)) as.character(model_res$direction) else sapply(model_res, function(m) m$direction)
    n_up   <- sum(all_dirs == "Up", na.rm=TRUE)
    n_down <- sum(all_dirs == "Down", na.rm=TRUE)
    majority_dir <- ifelse(n_up >= n_down, "Up", "Down")
  } else {
    # Standalone: use technical signals only
    tech_up <- (macd_val > 0) + (mom5 > 0) + (mom20 > 0) + (rsi_val > 50) + (e12[n] > e26[n])
    ensemble_prob_up <- tech_up / 5
    majority_dir <- ifelse(tech_up >= 3, "Up", "Down")
    model_votes  <- list()
  }

  # ── Technical confirmation ─────────────────────────────────────────────────
  tech_signals <- list(
    macd         = list(signal=ifelse(macd_val>0,"Bullish","Bearish"), value=round(macd_val,4)),
    ema_trend    = list(signal=ifelse(e12[n]>e26[n],"Bullish","Bearish")),
    rsi          = list(signal=ifelse(rsi_val>70,"Overbought", ifelse(rsi_val<30,"Oversold","Neutral")),
                        value=round(rsi_val,1)),
    momentum_5d  = list(signal=ifelse(mom5>0,"Positive","Negative"), pct=round(mom5,2)),
    momentum_20d = list(signal=ifelse(mom20>0,"Positive","Negative"), pct=round(mom20,2)),
    regime       = list(type=ifelse(is_trending,"Trending","Ranging"),
                        volatility=round(current_vol*100,2))
  )

  # Ensemble conviction
  prob_up_pct  <- round(ensemble_prob_up * 100, 1)
  conviction   <- round(abs(ensemble_prob_up - 0.5) * 200, 1)
  direction    <- ifelse(ensemble_prob_up > 0.5, "Up", "Down")
  conf_label   <- if (conviction >= 40) "High" else if (conviction >= 20) "Moderate" else "Low"

  # ── Monte Carlo overlay ────────────────────────────────────────────────────
  ret_hist  <- diff(log(closes))
  mu        <- mean(ret_hist)
  sigma     <- safe_sd(ret_hist)
  set.seed(42)
  n_sims    <- 2000
  last_p    <- closes[n]

  sim_paths <- replicate(n_sims, {
    r <- rnorm(lookahead, mu, sigma)
    last_p * exp(cumsum(r))
  })
  final_prices <- sim_paths[lookahead,]
  pct_ret      <- (final_prices / last_p - 1) * 100

  mc_summary <- list(
    prob_up      = round(mean(final_prices > last_p)*100, 1),
    median_ret   = round(median(pct_ret), 2),
    p10          = round(quantile(pct_ret, 0.10), 2),
    p25          = round(quantile(pct_ret, 0.25), 2),
    p75          = round(quantile(pct_ret, 0.75), 2),
    p90          = round(quantile(pct_ret, 0.90), 2),
    fan_chart    = lapply(1:lookahead, function(d) list(
      day  = d,
      p10  = round(quantile(sim_paths[d,]/last_p-1, 0.10)*100, 2),
      p25  = round(quantile(sim_paths[d,]/last_p-1, 0.25)*100, 2),
      p50  = round(quantile(sim_paths[d,]/last_p-1, 0.50)*100, 2),
      p75  = round(quantile(sim_paths[d,]/last_p-1, 0.75)*100, 2),
      p90  = round(quantile(sim_paths[d,]/last_p-1, 0.90)*100, 2)
    ))
  )

  list(
    success           = TRUE,
    model_type        = "Ensemble (weighted voting)",
    direction         = direction,
    probability_up    = round(ensemble_prob_up, 4),
    prob_up_pct       = prob_up_pct,
    majority_direction= majority_dir,
    conviction        = conviction,
    conviction_label  = conf_label,
    model_votes       = model_votes,
    technical_signals = tech_signals,
    monte_carlo       = mc_summary,
    regime            = list(
      trending  = is_trending,
      type      = ifelse(is_trending, "Trending", "Ranging"),
      trend_strength = round(trend_str, 3),
      vol_ann   = round(current_vol*100, 2)
    ),
    note = paste0(
      "Ensemble combines model probability estimates weighted by walk-forward skill. ",
      "Regime-aware: trending markets weight time-series models more; ranging markets weight ML more. ",
      "Monte Carlo uses historical return distribution (", n_sims, " simulations). ",
      "Conviction < 20 means models are disagreeing significantly. NOT financial advice."
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
