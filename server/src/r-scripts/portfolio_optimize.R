# Markowitz mean-variance portfolio optimization
# Input: JSON { "returns": { sym1: [num], sym2: [num] }, "symbols": [str] }

library(jsonlite)
library(quadprog)
library(Matrix)  # for nearPD

input <- fromJSON(readLines("stdin", warn = FALSE))
returns_list <- input$returns
symbols <- as.character(input$symbols)
rf <- as.numeric(ifelse(is.null(input$risk_free), 0.05, input$risk_free)) / 252

result <- tryCatch({
  # Build matrix: each column = asset returns
  returns_matrix <- do.call(cbind, lapply(symbols, function(s) as.numeric(returns_list[[s]])))
  colnames(returns_matrix) <- symbols

  n <- ncol(returns_matrix)
  mu <- colMeans(returns_matrix, na.rm = TRUE)
  sigma <- cov(returns_matrix, use = "pairwise.complete.obs")

  # Ensure positive definite (add small ridge if needed)
  sigma_pd <- tryCatch(as.matrix(nearPD(sigma)$mat), error = function(e) sigma + diag(1e-8, n))

  ones <- rep(1, n)
  Dmat <- 2 * sigma_pd
  dvec <- rep(0, n)
  Amat <- cbind(ones, diag(n))
  bvec <- c(1, rep(0, n))

  min_var <- solve.QP(Dmat, dvec, Amat, bvec, meq = 1)
  min_var_w <- round(min_var$solution, 4)
  min_var_ret <- sum(min_var_w * mu) * 252
  min_var_risk <- sqrt(as.numeric(t(min_var_w) %*% sigma_pd %*% min_var_w)) * sqrt(252)

  # Efficient frontier
  target_returns <- seq(min(mu), max(mu), length.out = 10) * 252
  frontier <- lapply(target_returns, function(tr) {
    tryCatch({
      Aef <- cbind(ones, mu, diag(n))
      bef <- c(1, tr / 252, rep(0, n))
      sol <- solve.QP(Dmat, dvec, Aef, bef, meq = 2)
      w <- round(sol$solution, 4)
      r <- sum(w * mu) * 252
      s <- sqrt(as.numeric(t(w) %*% sigma_pd %*% w)) * sqrt(252)
      list(return_ann = round(r,4), risk_ann = round(s,4),
           sharpe = round((r - rf*252)/s, 4), weights = w)
    }, error = function(e) NULL)
  })
  frontier <- Filter(Negate(is.null), frontier)

  sharpes <- sapply(frontier, function(f) f$sharpe)
  max_sharpe <- frontier[[which.max(sharpes)]]

  asset_info <- data.frame(
    symbol = symbols,
    ann_return = round(mu * 252, 4),
    ann_risk = round(sqrt(diag(sigma_pd)) * sqrt(252), 4),
    min_var_weight = min_var_w,
    max_sharpe_weight = max_sharpe$weights
  )

  list(
    success = TRUE,
    assets = asset_info,
    min_variance = list(
      weights = setNames(as.list(min_var_w), symbols),
      return_ann = round(min_var_ret, 4),
      risk_ann = round(min_var_risk, 4)
    ),
    max_sharpe = list(
      weights = setNames(as.list(max_sharpe$weights), symbols),
      return_ann = max_sharpe$return_ann,
      risk_ann = max_sharpe$risk_ann,
      sharpe = max_sharpe$sharpe
    ),
    frontier = lapply(frontier, function(f) list(ret=f$return_ann, risk=f$risk_ann, sharpe=f$sharpe)),
    note = "Based on historical data. Assumes normal returns."
  )
}, error = function(e) {
  list(success = FALSE, error = e$message)
})

cat(toJSON(result, auto_unbox = TRUE))
