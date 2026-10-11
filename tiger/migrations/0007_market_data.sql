-- Market data (Alpaca / IEX). Shared, non-owner reference data kept separate from personal holdings.

-- Historical bars: hypertable, one row per (symbol, timeframe, feed, bar timestamp).
CREATE TABLE fin.market_bars (
  symbol     text        NOT NULL,
  ts         timestamptz NOT NULL,
  timeframe  text        NOT NULL,          -- e.g. '1Day'
  feed       text        NOT NULL,          -- e.g. 'iex'
  source     text        NOT NULL DEFAULT 'alpaca',
  open       numeric     NOT NULL,
  high       numeric     NOT NULL,
  low        numeric     NOT NULL,
  close      numeric     NOT NULL,
  volume     bigint      NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, timeframe, feed, ts)
);
SELECT create_hypertable('fin.market_bars', by_range('ts', INTERVAL '180 days'));

-- Latest trade per symbol/feed; doubles as the ~60s server-side cache.
CREATE TABLE fin.market_latest (
  symbol     text        NOT NULL,
  feed       text        NOT NULL,
  source     text        NOT NULL DEFAULT 'alpaca',
  price      numeric,                       -- NULL when unsupported / no valid price
  trade_ts   timestamptz,
  status     text        NOT NULL,          -- ok | unsupported
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, feed)
);

-- Per-user watchlist: symbols tracked, NOT owned.
CREATE TABLE fin.watchlist (
  user_id  uuid        NOT NULL,
  symbol   text        NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);

GRANT SELECT, INSERT, UPDATE ON fin.market_bars, fin.market_latest TO fin_app;
GRANT SELECT, INSERT, DELETE ON fin.watchlist TO fin_app;
ALTER TABLE fin.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_rw ON fin.watchlist TO fin_app
  USING (user_id = fin.current_owner())
  WITH CHECK (user_id = fin.current_owner());
