-- tiger:no-transaction
-- Materializes the daily aggregate for all existing data (refresh cannot run inside a transaction).
CALL refresh_continuous_aggregate('fin.daily_activity', NULL, NULL);
