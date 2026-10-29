-- Migration 014: Cooperative Management, Financial Governance & Member Value Engine

-- 1. Cooperative Profiles & Bylaw Policies
CREATE TABLE IF NOT EXISTS cooperative_profiles (
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  category text NOT NULL DEFAULT 'agriculture' CHECK(category IN ('agriculture','processing','service','commercial','multipurpose')),
  sector text NOT NULL DEFAULT '',
  registration_number text,
  nominal_share_value bigint NOT NULL DEFAULT 10000 CHECK(nominal_share_value > 0 AND nominal_share_value <= 9007199254740991),
  min_shares_per_member integer NOT NULL DEFAULT 5 CHECK(min_shares_per_member >= 1),
  max_shares_per_member integer DEFAULT 1000 CHECK(max_shares_per_member >= 1),
  statutory_reserve_bps integer NOT NULL DEFAULT 2000 CHECK(statutory_reserve_bps BETWEEN 0 AND 10000),
  social_fund_bps integer NOT NULL DEFAULT 1000 CHECK(social_fund_bps BETWEEN 0 AND 10000),
  dividend_pool_bps integer NOT NULL DEFAULT 4000 CHECK(dividend_pool_bps BETWEEN 0 AND 10000),
  bonus_pool_bps integer NOT NULL DEFAULT 6000 CHECK(bonus_pool_bps BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id, org_id),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 2. Staff and Governance Appointments
CREATE TABLE IF NOT EXISTS cooperative_staff_appointments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  department text NOT NULL DEFAULT 'Administration',
  appointed_at date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','resigned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 3. Member Share Accounts (Subscribed vs Paid vs Outstanding)
CREATE TABLE IF NOT EXISTS cooperative_share_accounts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  user_id text NOT NULL,
  shares_subscribed integer NOT NULL DEFAULT 0 CHECK(shares_subscribed >= 0),
  shares_paid integer NOT NULL DEFAULT 0 CHECK(shares_paid >= 0 AND shares_paid <= shares_subscribed),
  amount_subscribed bigint NOT NULL DEFAULT 0 CHECK(amount_subscribed >= 0 AND amount_subscribed <= 9007199254740991),
  amount_paid bigint NOT NULL DEFAULT 0 CHECK(amount_paid >= 0 AND amount_paid <= 9007199254740991),
  amount_outstanding bigint NOT NULL DEFAULT 0 CHECK(amount_outstanding >= 0 AND amount_outstanding <= 9007199254740991),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','suspended','transferred')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, org_id, user_id),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 4. Share Transactions (Subscriptions, Payments, Transfers)
CREATE TABLE IF NOT EXISTS cooperative_share_transactions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  user_id text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('subscription','payment','transfer','refund')),
  shares integer NOT NULL CHECK(shares > 0),
  amount bigint NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
  payment_reference text,
  journal_id text,
  status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('recorded','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 5. Production Deliveries (Member Agricultural / Product Deliveries)
CREATE TABLE IF NOT EXISTS cooperative_deliveries (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  user_id text NOT NULL,
  product_name text NOT NULL,
  category text NOT NULL DEFAULT 'grain' CHECK(category IN ('grain','horticulture','coffee','dairy','tea','other')),
  quantity bigint NOT NULL CHECK(quantity > 0 AND quantity <= 9007199254740991),
  unit text NOT NULL DEFAULT 'kg' CHECK(unit IN ('kg','liter','bag','crate','ton')),
  grade text NOT NULL DEFAULT 'Grade A' CHECK(grade IN ('Grade A','Grade B','Standard')),
  unit_price bigint NOT NULL CHECK(unit_price > 0 AND unit_price <= 9007199254740991),
  total_value bigint NOT NULL CHECK(total_value > 0 AND total_value <= 9007199254740991),
  payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','approved','paid','cancelled')),
  payment_reference text,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 6. Commercial Sales & Receivables (Cooperative Selling to Buyers)
CREATE TABLE IF NOT EXISTS cooperative_sales (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  buyer_name text NOT NULL,
  product_name text NOT NULL,
  quantity bigint NOT NULL CHECK(quantity > 0 AND quantity <= 9007199254740991),
  unit text NOT NULL DEFAULT 'kg',
  unit_price bigint NOT NULL CHECK(unit_price > 0 AND unit_price <= 9007199254740991),
  total_amount bigint NOT NULL CHECK(total_amount > 0 AND total_amount <= 9007199254740991),
  payment_status text NOT NULL DEFAULT 'invoiced' CHECK(payment_status IN ('invoiced','paid','overdue','cancelled')),
  payment_reference text,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  journal_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 7. Surplus Allocations (Period Close & Allocation Calculations)
CREATE TABLE IF NOT EXISTS cooperative_surplus_allocations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  period_label text NOT NULL,
  gross_revenue bigint NOT NULL DEFAULT 0 CHECK(gross_revenue >= 0 AND gross_revenue <= 9007199254740991),
  total_expenses bigint NOT NULL DEFAULT 0 CHECK(total_expenses >= 0 AND total_expenses <= 9007199254740991),
  net_surplus bigint NOT NULL DEFAULT 0 CHECK(net_surplus >= 0 AND net_surplus <= 9007199254740991),
  statutory_reserve_amount bigint NOT NULL DEFAULT 0 CHECK(statutory_reserve_amount >= 0),
  social_fund_amount bigint NOT NULL DEFAULT 0 CHECK(social_fund_amount >= 0),
  distributable_surplus bigint NOT NULL DEFAULT 0 CHECK(distributable_surplus >= 0),
  dividend_pool bigint NOT NULL DEFAULT 0 CHECK(dividend_pool >= 0),
  bonus_pool bigint NOT NULL DEFAULT 0 CHECK(bonus_pool >= 0),
  status text NOT NULL DEFAULT 'calculated' CHECK(status IN ('calculated','approved_by_assembly','distributed')),
  resolution_ref text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 8. Member Value Distributions (Individual Dividends & Patronage Bonuses)
CREATE TABLE IF NOT EXISTS cooperative_member_distributions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  allocation_id text NOT NULL REFERENCES cooperative_surplus_allocations(id),
  user_id text NOT NULL,
  shares_held integer NOT NULL DEFAULT 0 CHECK(shares_held >= 0),
  share_ratio_bps integer NOT NULL DEFAULT 0 CHECK(share_ratio_bps >= 0 AND share_ratio_bps <= 10000),
  dividend_amount bigint NOT NULL DEFAULT 0 CHECK(dividend_amount >= 0),
  participation_units bigint NOT NULL DEFAULT 0 CHECK(participation_units >= 0),
  participation_ratio_bps integer NOT NULL DEFAULT 0 CHECK(participation_ratio_bps >= 0 AND participation_ratio_bps <= 10000),
  bonus_amount bigint NOT NULL DEFAULT 0 CHECK(bonus_amount >= 0),
  total_entitlement bigint NOT NULL DEFAULT 0 CHECK(total_entitlement >= 0),
  payout_status text NOT NULL DEFAULT 'entitled' CHECK(payout_status IN ('entitled','pending','paid')),
  payout_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 9. Investment Guardian Proposals & Digital Twin Scenarios
CREATE TABLE IF NOT EXISTS cooperative_investments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'equipment' CHECK(category IN ('processing','logistics','storage','equipment','energy','infrastructure')),
  capital_cost bigint NOT NULL CHECK(capital_cost > 0 AND capital_cost <= 9007199254740991),
  monthly_operating_cost bigint NOT NULL DEFAULT 0 CHECK(monthly_operating_cost >= 0),
  expected_monthly_benefit bigint NOT NULL DEFAULT 0 CHECK(expected_monthly_benefit >= 0),
  useful_life_months integer NOT NULL DEFAULT 60 CHECK(useful_life_months > 0),
  financing_source text NOT NULL DEFAULT 'cash_reserve' CHECK(financing_source IN ('cash_reserve','member_levy','commercial_loan')),
  status text NOT NULL DEFAULT 'simulated' CHECK(status IN ('draft','simulated','board_approved','assembly_approved','purchased','rejected')),
  guardian_verdict text NOT NULL DEFAULT 'sustainable' CHECK(guardian_verdict IN ('sustainable','caution','critical_liquidity')),
  payback_months integer NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 10. Governance Meetings & Assembly Resolutions
CREATE TABLE IF NOT EXISTS cooperative_governance_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('board_meeting','general_assembly','supervisory_audit')),
  title text NOT NULL,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  agenda text NOT NULL,
  resolutions text NOT NULL,
  recorded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);
