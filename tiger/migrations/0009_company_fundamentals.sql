-- Reference cache of SEC EDGAR company fundamentals (non-owner, shared across users).
-- metrics: output of src/lib/risk/fundamentals.ts extractFundamentals; NULL/unavailable
-- metrics stay null — never fabricated. Written only by the server-side EDGAR sync.
CREATE TABLE fin.company_fundamentals (
  symbol text PRIMARY KEY,
  cik text,
  company_name text,
  metrics jsonb,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','no_filings','unavailable')),
  source text NOT NULL DEFAULT 'sec_edgar',
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON fin.company_fundamentals TO fin_app;
