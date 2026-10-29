-- Migration 017: Personal Finance Extensions
-- Wallets & Accounts, Personal Loans & IOUs, and Investment Planning

CREATE TABLE IF NOT EXISTS personal_wallets (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  institution text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('mobile_money','bank','sacco','cash','investment','other')),
  account_identifier text NOT NULL DEFAULT '',
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <= 1000000000000),
  currency text NOT NULL DEFAULT 'RWF',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_wallets_scope_idx ON personal_wallets(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS personal_loans (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  counterparty_name text NOT NULL,
  counterparty_phone text NOT NULL DEFAULT '',
  direction text NOT NULL CHECK (direction IN ('i_owe','they_owe')),
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 1000000000000),
  paid_amount bigint NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
  due_date date,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','partially_paid','settled','defaulted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_loans_scope_idx ON personal_loans(tenant_id, user_id, direction, status);

CREATE TABLE IF NOT EXISTS personal_investment_plans (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'business' CHECK (category IN ('agriculture','retail','transport','real_estate','technology','services','other')),
  capital_required bigint NOT NULL DEFAULT 0 CHECK (capital_required >= 0 AND capital_required <= 1000000000000),
  projected_revenue bigint NOT NULL DEFAULT 0 CHECK (projected_revenue >= 0 AND projected_revenue <= 1000000000000),
  projected_expenses bigint NOT NULL DEFAULT 0 CHECK (projected_expenses >= 0 AND projected_expenses <= 1000000000000),
  time_horizon_months integer NOT NULL DEFAULT 12 CHECK (time_horizon_months BETWEEN 1 AND 120),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','active','completed','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_investment_plans_scope_idx ON personal_investment_plans(tenant_id, user_id);
