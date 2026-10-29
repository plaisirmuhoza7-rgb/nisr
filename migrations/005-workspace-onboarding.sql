CREATE TABLE IF NOT EXISTS workspace_onboarding_requests (
 id text PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES demo_tenants(id),
 user_id text NOT NULL REFERENCES account_profiles(user_id),
 purpose text NOT NULL CHECK (purpose IN ('fundraising','cooperative','impact')),
 organization_name text NOT NULL,
 district text NOT NULL,
 description text NOT NULL,
 status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,user_id,purpose)
);
CREATE INDEX IF NOT EXISTS workspace_onboarding_owner ON workspace_onboarding_requests(tenant_id,user_id);
