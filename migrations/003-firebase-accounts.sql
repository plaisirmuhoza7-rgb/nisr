CREATE TABLE IF NOT EXISTS account_profiles (
 user_id text PRIMARY KEY REFERENCES app_users(id),
 tenant_id text NOT NULL REFERENCES demo_tenants(id),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
 is_test_account boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS firebase_sessions (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES account_profiles(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS firebase_sessions_user ON firebase_sessions(user_id);
