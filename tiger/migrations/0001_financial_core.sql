-- TigerData (Tiger Cloud) schema for per-user financial data.
-- Ownership: every row carries user_id = the verified auth user id (uuid from the session).
-- Defense in depth: the app always runs queries as role fin_app with app.user_id set per
-- transaction, and Row Level Security restricts every table to that user.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fin_app') THEN
    CREATE ROLE fin_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
-- Allow the connecting role to switch into fin_app (SET LOCAL ROLE fin_app).
GRANT fin_app TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;

CREATE SCHEMA IF NOT EXISTS fin;
REVOKE ALL ON SCHEMA fin FROM PUBLIC;
GRANT USAGE ON SCHEMA fin TO fin_app;

CREATE OR REPLACE FUNCTION fin.current_owner() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Financial (investment) accounts
CREATE TABLE fin.financial_accounts (
  user_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  institution text,
  currency text NOT NULL DEFAULT 'USD',
  cash_cents bigint NOT NULL DEFAULT 0,
  valuation_timestamp text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- Transactions
CREATE TABLE fin.transactions (
  user_id uuid NOT NULL,
  id text NOT NULL,
  txn_date date NOT NULL,
  merchant text NOT NULL,
  amount_cents bigint NOT NULL,
  txn_type text NOT NULL,
  category text NOT NULL,
  category_source text NOT NULL,
  description text NOT NULL DEFAULT '',
  account_id text NOT NULL,
  linked_account_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX transactions_user_date_idx ON fin.transactions (user_id, txn_date);

-- Investment holdings; composite FK guarantees a holding can only link to the SAME user's account.
CREATE TABLE fin.investment_holdings (
  user_id uuid NOT NULL,
  id text NOT NULL,
  account_id text NOT NULL,
  symbol text,
  external_security_id text,
  name text NOT NULL,
  asset_class text NOT NULL,
  quantity numeric NOT NULL,
  latest_price numeric,
  price_timestamp text,
  supplied_value_cents bigint,
  supplied_value_date text,
  cost_basis_cents bigint,
  sector text,
  underlying_exposure text,
  source text NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, account_id) REFERENCES fin.financial_accounts (user_id, id) ON DELETE CASCADE
);

-- Recurring-expense overrides (keyed by recurring series key)
CREATE TABLE fin.recurring_overrides (
  user_id uuid NOT NULL,
  series_key text NOT NULL,
  detection text,
  review text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_key)
);

-- Financial goals, risk inputs, savings scenario, and view settings (one row per user)
CREATE TABLE fin.user_settings (
  user_id uuid PRIMARY KEY,
  risk_inputs jsonb NOT NULL,          -- ManualFinancialInputs incl. goals, debts, horizon, risk comfort
  savings_settings jsonb NOT NULL,     -- savings scenario percentages
  date_range jsonb,
  transaction_source text NOT NULL DEFAULT 'csv',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Least-privilege grants: DML only, no DDL, no TRUNCATE.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  fin.financial_accounts, fin.transactions, fin.investment_holdings,
  fin.recurring_overrides, fin.user_settings TO fin_app;
GRANT EXECUTE ON FUNCTION fin.current_owner() TO fin_app;

ALTER TABLE fin.financial_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.investment_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.recurring_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.user_settings       ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON fin.financial_accounts  TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
CREATE POLICY owner_all ON fin.transactions        TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
CREATE POLICY owner_all ON fin.investment_holdings TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
CREATE POLICY owner_all ON fin.recurring_overrides TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
CREATE POLICY owner_all ON fin.user_settings       TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
