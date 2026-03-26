# Monte Carlo VaR simulation
# Input: JSON { "returns": { sym1: [num], ... }, "weights": [num], "simulations": num, "days": num }

library(jsonlite)
library(MASS)
library(Matrix)

input <- fromJSON(readLines("stdin", warn = FALSE))
weights <- as.numeric(input$weights)
n_sim <- as.integer(ifelse(is.null(input$simulations), 10000, input$simulations))
n_days <- as.integer(ifelse(is.null(input$days), 21, input$days))

result <- tryCatch({
  # Build returns matrix from named columns
  syms <- names(input$returns)
  returns_matrix <- do.call(cbind, lapply(syms, function(s) as.numeric(input$returns[[s]])))

  n_assets <- ncol(returns_matrix)
  weights <- weights / sum(weights)

  mu <- colMeans(returns_matrix, na.rm = TRUE)
  sigma <- cov(returns_matrix, use = "pairwise.complete.obs")
  sigma_pd <- tryCatch(as.matrix(nearPD(sigma)$mat), error = function(e) sigma + diag(1e-8, n_assets))

  set.seed(42)
  sim_returns <- mvrnorm(n = n_sim * n_days, mu = mu, Sigma = sigma_pd)
  if(is.null(dim(sim_returns))) sim_returns <- matrix(sim_returns, ncol = n_assets)

  port_daily <- sim_returns %*% weights
  port_matrix <- matrix(port_daily, nrow = n_sim, ncol = n_days)
  cum_returns <- t(apply(port_matrix, 1, function(r) cumprod(1 + r) - 1))
  final_returns <- cum_returns[, n_days]

  var_95 <- round(quantile(final_returns, 0.05), 4)
  var_99 <- round(quantile(final_returns, 0.01), 4)
  cvar_95 <- round(mean(final_returns[final_returns <= quantile(final_returns, 0.05)]), 4)

  pcts <- c(0.05, 0.25, 0.50, 0.75, 0.95)
  fan <- sapply(1:n_days, function(d) round(quantile(cum_returns[, d], pcts), 4))

  list(
    success = TRUE,
    simulations = n_sim,
    days = n_days,
    var_95 = var_95, var_99 = var_99, cvar_95 = cvar_95,
    expected_return = round(mean(final_returns), 4),
    median_return = round(median(final_returns), 4),
    worst_case = round(min(final_returns), 4),
    best_case = round(max(final_returns), 4),
    prob_loss = round(mean(final_returns < 0), 4),
    fan_chart = list(
      percentiles = pcts * 100,
      paths = as.data.frame(t(fan))
    ),
    disclaimer = "Monte Carlo uses historical patterns. Past performance does not predict future."
  )
}, error = function(e) {
  list(success = FALSE, error = e$message)
})

cat(toJSON(result, auto_unbox = TRUE))
