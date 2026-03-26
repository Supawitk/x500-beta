#!/usr/bin/env Rscript
# Bayesian linear regression for price prediction with credible intervals
suppressPackageStartupMessages({
  library(jsonlite)
})

input <- fromJSON(readLines(con = "stdin", warn = FALSE))
prices  <- as.numeric(input$prices)
highs   <- as.numeric(input$highs)
lows    <- as.numeric(input$lows)
volumes <- as.numeric(input$volumes)
horizon <- as.integer(if (is.null(input$horizon)) 14 else input$horizon)

tryCatch({
  n <- length(prices)
  if (n < 60) stop("Need >= 60 data points")

  log_ret <- diff(log(prices))

  # Build features
  build_features <- function(i) {
    if (i < 21) return(NULL)
    r1  <- log_ret[i-1]
    r2  <- log_ret[i-2]
    r5  <- mean(log_ret[max(1,i-5):(i-1)])
    r10 <- mean(log_ret[max(1,i-10):(i-1)])
    vol5  <- sd(log_ret[max(1,i-5):(i-1)])
    vol20 <- sd(log_ret[max(1,i-20):(i-1)])
    vol_ratio <- vol5 / max(vol20, 1e-8)
    ema5  <- mean(prices[(i-4):i])
    ema20 <- mean(prices[(i-19):i])
    ema_spread <- (ema5 / ema20) - 1
    rsi_gains <- sum(pmax(diff(prices[(i-13):i]), 0))
    rsi_losses <- sum(pmax(-diff(prices[(i-13):i]), 0))
    rsi <- if (rsi_losses == 0) 100 else 100 - 100 / (1 + rsi_gains / rsi_losses)
    atr_range <- mean(highs[(i-13):i] - lows[(i-13):i])
    atr_norm  <- atr_range / prices[i]
    vol_chg   <- if (volumes[i-1] > 0) (volumes[i] / volumes[i-1]) - 1 else 0
    c(r1=r1, r2=r2, r5=r5, r10=r10, vol5=vol5, vol20=vol20, vol_ratio=vol_ratio,
      ema_spread=ema_spread, rsi=rsi, atr_norm=atr_norm, vol_chg=vol_chg)
  }

  # Build data matrix
  feat_list <- list()
  y_vals <- c()
  for (i in 21:(n-1)) {
    f <- build_features(i)
    if (!is.null(f)) {
      feat_list[[length(feat_list)+1]] <- f
      y_vals <- c(y_vals, log_ret[i])
    }
  }
  X <- do.call(rbind, feat_list)
  y <- y_vals

  # --- Bayesian Linear Regression (conjugate normal-inverse-gamma) ---
  # Prior: weakly informative
  p <- ncol(X)
  X_aug <- cbind(1, X)  # add intercept
  p_aug <- ncol(X_aug)

  # OLS as starting point
  ols <- lm(y ~ X)
  beta_hat <- coef(ols)
  sigma2_hat <- sum(residuals(ols)^2) / (length(y) - p_aug)

  # Conjugate posterior parameters
  # Prior: beta ~ N(0, tau^2 * I), sigma^2 ~ IG(a0, b0)
  tau2 <- 10  # weak prior on beta
  a0 <- 3; b0 <- sigma2_hat  # prior on variance

  V0_inv <- diag(1/tau2, p_aug)
  XtX <- t(X_aug) %*% X_aug
  Xty <- t(X_aug) %*% y
  Vn_inv <- V0_inv + XtX
  Vn <- solve(Vn_inv)
  beta_n <- Vn %*% (Xty)  # posterior mean of beta

  an <- a0 + length(y) / 2
  SSR <- sum((y - X_aug %*% beta_n)^2)
  bn <- b0 + 0.5 * SSR

  sigma2_post <- as.numeric(bn / an)
  beta_post_mean <- as.numeric(beta_n)
  beta_post_sd <- sqrt(diag(Vn) * sigma2_post)

  # Feature importance (absolute posterior mean / posterior sd = signal-to-noise)
  feat_names <- c("intercept", colnames(X))
  snr <- abs(beta_post_mean) / pmax(beta_post_sd, 1e-10)
  importance <- data.frame(
    feature = feat_names,
    coefficient = round(beta_post_mean, 6),
    std_error = round(beta_post_sd, 6),
    signal_noise = round(snr, 3),
    significant = snr > 2
  )
  importance <- importance[order(-importance$signal_noise),]

  # --- Walk-forward validation ---
  wf_start <- round(length(y) * 0.7)
  correct <- 0
  total <- 0
  pred_rets <- c()
  actual_rets <- c()
  for (t_idx in wf_start:length(y)) {
    X_train <- X_aug[1:(t_idx-1),, drop=FALSE]
    y_train <- y[1:(t_idx-1)]
    fit_t <- tryCatch({
      V_t <- solve(V0_inv + t(X_train) %*% X_train)
      b_t <- V_t %*% (t(X_train) %*% y_train)
      as.numeric(b_t)
    }, error=function(e) beta_post_mean)

    pred <- sum(X_aug[t_idx,] * fit_t)
    pred_rets <- c(pred_rets, pred)
    actual_rets <- c(actual_rets, y[t_idx])
    if ((pred > 0) == (y[t_idx] > 0)) correct <- correct + 1
    total <- total + 1
  }

  dir_accuracy <- correct / total * 100
  naive_acc <- max(sum(actual_rets > 0), sum(actual_rets <= 0)) / length(actual_rets) * 100
  skill <- dir_accuracy - naive_acc

  rmse_wf <- sqrt(mean((pred_rets - actual_rets)^2))

  # --- Generate forecast ---
  last_feat <- build_features(n)
  if (is.null(last_feat)) stop("Cannot build features for last observation")
  x_new <- c(1, last_feat)

  # Monte Carlo posterior predictive
  n_sims <- 3000
  forecasts <- matrix(0, n_sims, horizon)
  current_price <- prices[n]

  for (s in 1:n_sims) {
    # Sample sigma^2 from IG(an, bn)
    sig2_s <- 1 / rgamma(1, an, bn)
    # Sample beta from N(beta_n, sig2_s * Vn)
    beta_s <- beta_post_mean + rnorm(p_aug) * sqrt(diag(Vn) * sig2_s)
    pred_ret <- sum(x_new * beta_s) + rnorm(1, 0, sqrt(sig2_s))
    forecasts[s, 1] <- current_price * exp(pred_ret)
    for (h in 2:horizon) {
      # Simple random walk from posterior
      next_ret <- sum(x_new * beta_s) * (1/sqrt(h)) + rnorm(1, 0, sqrt(sig2_s))
      forecasts[s, h] <- forecasts[s, h-1] * exp(next_ret)
    }
  }

  # Summarize forecast
  fc_summary <- data.frame(
    day = 1:horizon,
    mean = apply(forecasts, 2, mean),
    median = apply(forecasts, 2, median),
    lo80 = apply(forecasts, 2, quantile, 0.10),
    hi80 = apply(forecasts, 2, quantile, 0.90),
    lo95 = apply(forecasts, 2, quantile, 0.025),
    hi95 = apply(forecasts, 2, quantile, 0.975)
  )
  fc_summary[] <- lapply(fc_summary, round, 2)

  # Probability metrics
  final_prices <- forecasts[, horizon]
  prob_up <- mean(final_prices > current_price)
  expected_return <- (mean(final_prices) / current_price - 1) * 100
  var_95 <- (quantile(final_prices, 0.05) / current_price - 1) * 100

  # Distribution of final returns
  final_returns <- (final_prices / current_price - 1) * 100
  return_dist <- list(
    mean = round(mean(final_returns), 2),
    median = round(median(final_returns), 2),
    sd = round(sd(final_returns), 2),
    skew = round(mean(((final_returns - mean(final_returns))/sd(final_returns))^3), 3),
    p5 = round(quantile(final_returns, 0.05), 2),
    p25 = round(quantile(final_returns, 0.25), 2),
    p75 = round(quantile(final_returns, 0.75), 2),
    p95 = round(quantile(final_returns, 0.95), 2)
  )

  # Histogram data for client
  breaks <- seq(floor(min(final_returns)), ceiling(max(final_returns)), length.out=30)
  hist_data <- hist(final_returns, breaks=breaks, plot=FALSE)
  hist_df <- data.frame(
    bin = round((hist_data$breaks[-length(hist_data$breaks)] + hist_data$breaks[-1])/2, 2),
    count = hist_data$counts,
    density = round(hist_data$density, 6)
  )

  result <- list(
    success = TRUE,
    lastPrice = current_price,
    model = "Bayesian Linear Regression",
    posterior = list(
      sigma2 = round(sigma2_post, 8),
      n_params = p_aug,
      n_obs = length(y)
    ),
    importance = importance,
    forecast = fc_summary,
    probability = list(
      prob_up = round(prob_up, 3),
      expected_return_pct = round(expected_return, 2),
      var_95_pct = round(as.numeric(var_95), 2),
      direction = if (prob_up > 0.55) "Bullish" else if (prob_up < 0.45) "Bearish" else "Neutral"
    ),
    return_distribution = return_dist,
    histogram = hist_df,
    walk_forward = list(
      dir_accuracy = round(dir_accuracy, 1),
      naive_accuracy = round(naive_acc, 1),
      skill_score = round(skill, 1),
      rmse = round(rmse_wf, 6),
      n_steps = total,
      interpretation = if (skill > 5) "Model adds value over naive" else if (skill > 0) "Marginal improvement" else "No skill detected"
    )
  )

  cat(toJSON(result, auto_unbox=TRUE))
}, error=function(e) {
  cat(toJSON(list(success=FALSE, error=e$message), auto_unbox=TRUE))
})
