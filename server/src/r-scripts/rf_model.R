# Random Forest Model with Walk-Forward Validation
# Falls back to Logistic Regression if 'ranger' not installed
# Features: same as factor_model.R (15 technical features)
# Target: direction up/down over lookahead period
# Input: { prices, volumes, highs, lows, closes, dates, lookahead, n_trees, train_pct }

library(jsonlite)

input     <- fromJSON(readLines("stdin", warn = FALSE))
closes    <- as.numeric(input$prices)
volumes   <- if (!is.null(input$volumes)) as.numeric(input$volumes) else rep(1e6, length(closes))
highs     <- if (!is.null(input$highs)) as.numeric(input$highs) else closes
lows      <- if (!is.null(input$lows))  as.numeric(input$lows)  else closes
dates     <- as.character(input$dates)
lookahead <- as.integer(ifelse(is.null(input$lookahead), 10, input$lookahead))
n_trees   <- as.integer(ifelse(is.null(input$n_trees), 200, input$n_trees))
train_pct <- ifelse(is.null(input$train_pct), 0.75, as.numeric(input$train_pct))

has_ranger <- requireNamespace("ranger", quietly=TRUE)
model_engine <- if (has_ranger) "Random Forest (ranger)" else "Logistic Regression (fallback)"

safe_sd  <- function(x) { s <- sd(x, na.rm=TRUE); ifelse(is.na(s)||s==0, 1, s) }

# ── Feature engineering (same as factor_model) ────────────────────────────────
lag_f <- function(x, k) c(rep(NA, k), head(x, -k))
ema_f <- function(x, k) {
  a <- 2/(k+1); e <- numeric(length(x)); e[1] <- x[1]
  for (i in 2:length(x)) e[i] <- a*x[i] + (1-a)*e[i-1]
  e
}
calc_rsi <- function(p, n=14) {
  r <- c(NA, diff(p)); rsi <- rep(NA, length(p))
  for (i in (n+1):length(p)) {
    g <- pmax(r[(i-n+1):i],0); l <- pmax(-r[(i-n+1):i],0)
    rsi[i] <- 100 - 100/(1 + mean(g)/(mean(l)+1e-9))
  }
  rsi
}

build_features <- function(cl, hi, lo, vo) {
  ret1 <- c(NA, diff(log(cl)))
  r1<-lag_f(ret1,1); r2<-lag_f(ret1,2); r3<-lag_f(ret1,3)
  r5<-lag_f(ret1,5); r10<-lag_f(ret1,10)
  e12<-ema_f(cl,12); e26<-ema_f(cl,26); e50<-ema_f(cl,50)
  rsi_raw <- calc_rsi(cl)
  stoch_k <- sapply(seq_along(cl), function(i) {
    if(i<14) return(NA)
    (cl[i]-min(lo[(i-13):i]))/(max(hi[(i-13):i])-min(lo[(i-13):i])+1e-9)*100
  })
  vol10 <- sapply(seq_along(ret1), function(i) if(i<10) NA else safe_sd(ret1[(i-9):i])*sqrt(252))
  atr   <- sapply(seq_along(cl), function(i) {
    if(i<2) return(NA)
    max(hi[i]-lo[i], abs(hi[i]-cl[i-1]), abs(lo[i]-cl[i-1]))/cl[i]
  })
  data.frame(
    r1=r1, r2=r2, r3=r3, r5=r5, r10=r10,
    ema1226=cl/e12-1, ema_cl50=cl/e50-1,
    macd=e12-e26,
    rsi=(rsi_raw-50)/25, stoch=stoch_k/100-0.5,
    vol10=vol10, vol_chg=c(NA, diff(log(vo+1))),
    mom3=cl/lag_f(cl,3)-1, mom10=cl/lag_f(cl,10)-1, atr=atr
  )
}

# ── Train one model on X_tr, y_tr → predict X_te ─────────────────────────────
train_predict <- function(X_tr, y_tr, X_te, n_trees) {
  df_tr <- data.frame(X_tr, y=factor(y_tr))
  if (has_ranger) {
    mdl <- ranger::ranger(y ~ ., data=df_tr, num.trees=n_trees, probability=TRUE, seed=42)
    preds <- predict(mdl, data=data.frame(X_te))$predictions
    p_up  <- if ("1" %in% colnames(preds)) preds[,"1"] else preds[,2]
    list(pred=ifelse(p_up > 0.5, 1, 0), prob=p_up)
  } else {
    mdl <- glm(y ~ ., data=df_tr, family=binomial, maxit=100)
    p   <- predict(mdl, newdata=data.frame(X_te), type="response")
    list(pred=ifelse(p > 0.5, 1, 0), prob=p)
  }
}

# ── Walk-forward ──────────────────────────────────────────────────────────────
walk_forward <- function(X_all, y_all, min_train=60, step=5, n_trees) {
  n <- nrow(X_all); results <- list(); i <- min_train
  while (i + 1 <= n) {
    X_tr <- X_all[1:i,,drop=FALSE]; y_tr <- y_all[1:i]
    keep <- complete.cases(X_tr) & !is.na(y_tr)
    X_te <- X_all[i+1,,drop=FALSE]; y_te <- y_all[i+1]
    if (sum(keep) < 30 || !complete.cases(X_te) || is.na(y_te)) { i <- i+step; next }
    r <- tryCatch(train_predict(X_tr[keep,,drop=FALSE], y_tr[keep], X_te, n_trees), error=function(e) NULL)
    if (!is.null(r)) results[[length(results)+1]] <- list(
      idx=i+1, pred=r$pred, prob=r$prob, actual=y_te
    )
    i <- i + step
  }
  results
}

# ── Feature importance (RF only) ─────────────────────────────────────────────
get_importance <- function(X_tr, y_tr, n_trees) {
  if (!has_ranger) return(NULL)
  df_tr <- data.frame(X_tr, y=factor(y_tr))
  mdl   <- ranger::ranger(y ~ ., data=df_tr, num.trees=n_trees,
                           importance="impurity", seed=42)
  imp <- sort(mdl$variable.importance, decreasing=TRUE)
  round(imp / sum(imp) * 100, 1)
}

result <- tryCatch({
  n  <- length(closes)
  if (n < 80) stop(paste("Need ≥ 80 prices, got:", n))

  feats   <- build_features(closes, highs, lows, volumes)
  fwd_ret <- c(rep(NA, lookahead),
    sapply(1:(n-lookahead), function(i) (closes[i+lookahead]/closes[i]-1)*100))
  y_dir   <- ifelse(fwd_ret > 0, 1, 0)

  X_all   <- as.matrix(feats)
  keep_all<- complete.cases(X_all) & !is.na(y_dir)

  # Walk-forward
  wf <- walk_forward(X_all, y_dir, min_train=60, step=5, n_trees=n_trees)

  wf_acc <- wf_naive <- wf_skill <- wf_brier <- NA
  if (length(wf) >= 10) {
    preds   <- sapply(wf, function(r) r$pred)
    actuals <- sapply(wf, function(r) r$actual)
    probs   <- sapply(wf, function(r) r$prob)
    wf_acc   <- round(mean(preds == actuals, na.rm=TRUE)*100, 1)
    wf_naive <- round(mean(actuals==1)*100, 1)
    wf_skill <- round(wf_acc - wf_naive, 1)
    # Brier score (lower = better, 0.25 = random)
    wf_brier <- round(mean((probs - actuals)^2, na.rm=TRUE), 4)
  }

  # Final model on all data
  X_final <- X_all[keep_all,,drop=FALSE]
  y_final <- y_dir[keep_all]
  last_X  <- X_all[nrow(X_all),,drop=FALSE]

  final_pred <- tryCatch({
    r <- train_predict(X_final, y_final, last_X, n_trees)
    list(direction=ifelse(r$pred==1,"Up","Down"), prob_up=round(as.numeric(r$prob),4))
  }, error=function(e) list(direction="Unknown", prob_up=0.5))

  # Feature importance
  fi <- tryCatch(get_importance(X_final, y_final, n_trees), error=function(e) NULL)

  # Confidence: distance from 0.5 prob × accuracy × skill
  conf <- if (!is.na(wf_acc) && wf_skill > 0)
    round(min((abs(final_pred$prob_up - 0.5)*2) * (wf_acc/100) * (1 + wf_skill/100), 1) * 100, 1)
  else round(abs(final_pred$prob_up - 0.5)*100, 1)

  list(
    success       = TRUE,
    model_type    = model_engine,
    n_trees       = n_trees,
    lookahead     = lookahead,
    n_train_obs   = sum(keep_all),
    walk_forward = list(
      n_steps        = length(wf),
      dir_accuracy   = wf_acc,
      naive_accuracy = wf_naive,
      skill_score    = wf_skill,
      brier_score    = wf_brier,
      brier_baseline = 0.25,
      interpretation = if (!is.na(wf_acc)) paste0(
        model_engine, " achieved ", wf_acc, "% direction accuracy ",
        "(naive=", wf_naive, "%, skill=", if(wf_skill>0) paste0("+",wf_skill) else wf_skill, "%). ",
        "Brier score: ", wf_brier, " (0.25=random). ",
        if (!is.na(wf_skill) && wf_skill > 5) "Meaningful skill above naive."
        else if (!is.na(wf_skill) && wf_skill > 0) "Marginal improvement."
        else "No skill above naive baseline."
      ) else "Insufficient steps for evaluation."
    ),
    prediction = list(
      next_direction = final_pred$direction,
      probability_up = final_pred$prob_up,
      confidence     = conf
    ),
    feature_importance = if (!is.null(fi)) as.list(fi) else list(),
    note = paste0(
      model_engine, " with ", n_trees, " trees, walk-forward step=5 days. ",
      "15 technical features. Brier score measures probability calibration. NOT financial advice."
    )
  )
}, error = function(e) list(success = FALSE, error = e$message))

cat(toJSON(result, auto_unbox = TRUE))
