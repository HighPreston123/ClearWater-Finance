-- One profile per authenticated user. Written only by the server after verifying the session.
CREATE TABLE fin.user_profiles (
  auth_user_id text PRIMARY KEY,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- No DELETE: profiles are only created/updated on login.
GRANT SELECT, INSERT, UPDATE ON fin.user_profiles TO fin_app;

ALTER TABLE fin.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_rw ON fin.user_profiles TO fin_app
  USING (auth_user_id = fin.current_owner()::text)
  WITH CHECK (auth_user_id = fin.current_owner()::text);
