# Multi-Factor Linear & Logistic Model with Walk-Forward Validation
# Features engineered from OHLCV + technical indicators
# Supports both regression (return magnitude) and classification (direction)
# Input: { prices, volumes, highs, lows, closes, dates, lookahead, mode, train_pct }

library(jsonlite)
library(forecast)

input     <- fromJSON(readLines("stdin", warn = FALSE))
closes    <- as.numeric(input$prices)
volumes   <- if (!is.null(input$volumes)) as.numeric(input$volumes) else rep(1, length(closes))
highs     <- if (!is.null(input$highs))   as.numeric(input$highs)   else closes
lows      <- if (!is.null(input$lows))    as.numeric(input$lows)    else closes
dates     <- as.character(input$dates)
lookahead <- as.integer(ifelse(is.null(input$lookahead), 10, input$lookahead))
mode      <- ifelse(is.null(input$mode), "classification", input$mode)  # classification | regression
train_pct <- ifelse(is.null(input$train_pct), 0.75, as.numeric(input$train_pct))
vix_prices <- if (!is.null(input$vix)) as.numeric(input$vix) else NULL
spx_prices <- if (!is.null(input$spx)) as.numeric(input$spx) else NULL

safe_sd  <- function(x) { s <- sd(x, na.rm=TRUE); ifelse(is.na(s) || s == 0, 1, s) }
safe_z   <- function(x) (x - mean(x, na.rm=TRUE)) / safe_sd(x)
winsorize<- function(x, p=0.01) {
  q <- quantile(x, c(p, 1-p), na.rm=TRUE)
  pmax(pmin(x, q[2]), q[1])
}

# ── Feature engineering ───────────────────────────────────────────────────────
build_features <- function(cl, hi, lo, vo, vix = NULL, spx = NULL) {
  n <- length(cl)
  ret1 <- c(NA, diff(log(cl)))

  # Lagged returns
  lag <- function(x, k) c(rep(NA, k), head(x, -k))
  r1 <- lag(ret1, 1); r2 <- lag(ret1, 2); r3 <- lag(ret1, 3)
  r5 <- lag(ret1, 5); r10 <- lag(ret1, 10)

  # EMA ratios
  ema_fast <- function(x, k) {
    a <- 2 / (k + 1)
    e <- numeric(n); e[1] <- x[1]
    for (i in 2:n) e[i] <- a * x[i] + (1 - a) * e[i - 1]
    e
  }
  ema12 <- ema_fast(cl, 12); ema26 <- ema_fast(cl, 26); ema50 <- ema_fast(cl, 50)
  ema_ratio_12_26 <- cl / ema12 - 1
  ema_ratio_cl_50 <- cl / ema50 - 1
  macd_hist       <- ema_fast(ema12 - ema26, 9) - (ema12 - ema26)

  # RSI
  calc_rsi <- function(p, n=14) {
    r <- c(NA, diff(p))
    rsi <- rep(NA, length(p))
    for (i in (n+1):length(p)) {
      g <- pmax(r[(i-n+1):i], 0); l <- pmax(-r[(i-n+1):i], 0)
      rs <- mean(g) / (mean(l) + 1e-9)
      rsi[i] <- 100 - 100 / (1 + rs)
    }
    rsi
  }
  rsi_raw <- calc_rsi(cl)
  rsi_z   <- (rsi_raw - 50) / 25  # scale to ~[-2, +2]

  # Stochastic %K
  stoch_k <- sapply(seq_along(cl), function(i) {
    if (i < 14) return(NA)
    rng <- hi[(i-13):i] - lo[(i-13):i]
    if (max(rng) == 0) return(50)
    (cl[i] - min(lo[(i-13):i])) / (max(hi[(i-13):i]) - min(lo[(i-13):i])) * 100
  })

  # Rolling volatility (10-day annualized)
  vol10 <- sapply(seq_along(ret1), function(i) {
    if (i < 10) NA else safe_sd(ret1[(i-9):i]) * sqrt(252)
  })

  # Volume change
  vol_chg <- c(NA, diff(log(vo + 1)))
  vol_z   <- safe_z(vol_chg)

  # Price momentum (3 and 10 day)
  mom3  <- cl / lag(cl, 3) - 1
  mom10 <- cl / lag(cl, 10) - 1

  # ATR (average true range proxy)
  atr <- sapply(seq_along(cl), function(i) {
    if (i < 2) return(NA)
    tr <- max(hi[i] - lo[i], abs(hi[i] - cl[i-1]), abs(lo[i] - cl[i-1]))
    tr / cl[i]
  })

  df <- data.frame(
    r1=r1, r2=r2, r3=r3, r5=r5, r10=r10,
    ema1226=ema_ratio_12_26, ema_cl50=ema_ratio_cl_50, macd=macd_hist,
    rsi=rsi_z, stoch=stoch_k / 100 - 0.5,
    vol10=vol10, vol_z=vol_z,
    mom3=mom3, mom10=mom10, atr=atr
  )

  # Macro features: VIX level and change, SPX relative strength
  if (!is.null(vix) && length(vix) == n && any(vix > 0)) {
    vix_level <- safe_z(vix)  # normalized VIX level
    vix_chg <- c(NA, diff(log(pmax(vix, 1))))  # VIX daily change
    vix_ma5 <- sapply(seq_along(vix), function(i) {
      if (i < 5) NA else mean(vix[(i-4):i])
    })
    vix_regime <- ifelse(vix > vix_ma5, 1, 0)  # high-vol regime flag
    df$vix_level <- vix_level
    df$vix_chg <- vix_chg
    df$vix_regime <- vix_regime
  }

  if (!is.null(spx) && length(spx) == n && any(spx > 0)) {
    spx_ret <- c(NA, diff(log(spx)))
    spx_mom5 <- sapply(seq_along(spx), function(i) {
      if (i < 5) NA else spx[i] / spx[i-4] - 1
    })
    # Relative strength vs market
    stock_ret <- c(NA, diff(log(cl)))
    rel_strength <- stock_ret - spx_ret
    df$spx_ret <- spx_ret
    df$spx_mom5 <- spx_mom5
    df$rel_strength <- rel_strength
  }

  df
}

# ── Walk-Forward Validation ───────────────────────────────────────────────────
walk_forward_eval <- function(X_all, y_all, mode, min_train=60, step=5) {
  n        <- nrow(X_all)
  results  <- list()
  i        <- min_train

  while (i + lookahead <= n) {
    X_tr <- X_all[1:i, , drop=FALSE]
    y_tr <- y_all[1:i]
    keep_tr <- complete.cases(X_tr) & !is.na(y_tr)

    if (sum(keep_tr) < 30) { i <- i + step; next }

    X_te <- X_all[i + 1, , drop=FALSE]
    y_te <- y_all[i + 1]
    if (!complete.cases(X_te) || is.na(y_te)) { i <- i + step; next }

    pred <- tryCatch({
      if (mode == "classification") {
        y_bin  <- factor(ifelse(y_tr[keep_tr] > 0, 1, 0))
        df_tr  <- data.frame(X_tr[keep_tr, , drop=FALSE], y=y_bin)
        mdl    <- glm(y ~ ., data=df_tr, family=binomial, maxit=50)
        p      <- predict(mdl, newdata=data.frame(X_te), type="response")
        list(pred=ifelse(p > 0.5, 1, 0), prob=p)
      } else {
        df_tr  <- data.frame(X_tr[keep_tr, , drop=FALSE], y=y_tr[keep_tr])
        mdl    <- lm(y ~ ., data=df_tr)
        p      <- predict(mdl, newdata=data.frame(X_te))
        list(pred=p, prob=NA)
      }
    }, error=function(e) NULL)

    if (!is.null(pred)) {
      results[[length(results)+1]] <- list(
        idx=i+1, pred=pred$pred, actual=y_te, prob=pred$prob
      )
    }
    i <- i + step
  }
  results
}

# ── Main execution ────────────────────────────────────────────────────────────
result <- tryCatch({
  n   <- length(closes)
  if (n < 80) stop(paste("Need at least 80 data points, got:", n))

  feats <- build_features(closes, highs, lows, volumes, vix_prices, spx_prices)

  # Target: forward return over lookahead period
  fwd_ret <- c(rep(NA, lookahead),
    sapply(1:(n - lookahead), function(i) (closes[i + lookahead] / closes[i] - 1) * 100))

  y_class <- ifelse(fwd_ret > 0, 1, 0)
  feat_names <- names(feats)
  X_all  <- as.matrix(feats)

  # ── Walk-forward ──────────────────────────────────────────────────────────
  wf_results <- walk_forward_eval(X_all, if (mode=="classification") y_class else fwd_ret,
                                  mode, min_train=60, step=3)

  # Accuracy metrics
  if (length(wf_results) >= 10) {
    preds   <- sapply(wf_results, function(r) r$pred)
    actuals <- sapply(wf_results, function(r) r$actual)

    if (mode == "classification") {
      actual_dir <- ifelse(actuals > 0, 1, 0)
      dir_acc    <- round(mean(preds == actual_dir, na.rm=TRUE) * 100, 1)
      # Naive: always predict up
      naive_acc  <- round(mean(actual_dir == 1) * 100, 1)
      skill      <- round(dir_acc - naive_acc, 1)
      rmse_val   <- round(sqrt(mean((preds - actual_dir)^2, na.rm=TRUE)), 4)
    } else {
      dir_acc  <- round(mean(sign(preds) == sign(actuals), na.rm=TRUE) * 100, 1)
      naive_acc<- round(mean(sign(mean(actuals)) == sign(actuals)) * 100, 1)
      skill    <- round(dir_acc - naive_acc, 1)
      rmse_val <- round(sqrt(mean((preds - actuals)^2, na.rm=TRUE)), 2)
    }
    n_steps  <- length(wf_results)
  } else {
    dir_acc <- naive_acc <- skill <- rmse_val <- n_steps <- NA
  }

  # ── Fit final model on all available data ────────────────────────────────
  keep <- complete.cases(X_all) & !is.na(if (mode=="classification") y_class else fwd_ret)
  X_final <- X_all[keep,]
  if (mode == "classification") {
    y_final   <- factor(y_class[keep])
    df_final  <- data.frame(X_final, y=y_final)
    final_mdl <- glm(y ~ ., data=df_final, family=binomial, maxit=100)
    last_X    <- X_all[nrow(X_all),,drop=FALSE]
    next_prob <- if (complete.cases(last_X))
      predict(final_mdl, newdata=data.frame(last_X), type="response") else NA
    next_pred <- ifelse(!is.na(next_prob) & next_prob > 0.5, "Up", "Down")
    coefs     <- coef(final_mdl)[-1]
  } else {
    y_final   <- fwd_ret[keep]
    df_final  <- data.frame(X_final, y=y_final)
    final_mdl <- lm(y ~ ., data=df_final)
    last_X    <- X_all[nrow(X_all),,drop=FALSE]
    next_prob <- if (complete.cases(last_X))
      predict(final_mdl, newdata=data.frame(last_X)) else NA
    next_pred <- ifelse(!is.na(next_prob) & next_prob > 0, "Up", "Down")
    coefs     <- coef(final_mdl)[-1]
  }

  # Feature importance (absolute coefficient values)
  fi <- sort(abs(coefs[!is.na(coefs)]), decreasing=TRUE)
  fi <- round(fi / sum(fi) * 100, 1)

  list(
    success         = TRUE,
    model_type      = paste0("MultiFactorModel_", mode),
    mode            = mode,
    lookahead       = lookahead,
    train_pct       = train_pct,
    features_used   = feat_names,
    n_observations  = sum(keep),
    walk_forward = list(
      n_steps       = n_steps,
      dir_accuracy  = dir_acc,
      naive_accuracy= naive_acc,
      skill_score   = skill,
      rmse          = rmse_val,
      interpretation= if (!is.na(dir_acc)) paste0(
        "Correctly predicted direction ", dir_acc, "% of the time vs naive ", naive_acc, "%. ",
        if (skill > 5) "Model shows meaningful skill above naive." else
        if (skill > 0) "Marginal skill above naive baseline." else
        "Model has no skill above naive baseline."
      ) else "Insufficient data for walk-forward evaluation."
    ),
    prediction = list(
      next_direction    = next_pred,
      probability_up    = if (!is.na(next_prob)) round(as.numeric(next_prob), 4) else NULL,
      confidence        = if (!is.na(next_prob)) round(abs(as.numeric(next_prob) - 0.5) * 200, 1) else NULL
    ),
    feature_importance = as.list(fi),
    note = paste0(
      "Multi-factor model using ", length(feat_names), " technical features. ",
      "Walk-forward validated with step=3 days. Directional accuracy is the key metric. ",
      "Skill > 5% above naive is considered meaningful. NOT financial advice."
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
