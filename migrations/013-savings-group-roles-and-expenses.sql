-- Migration 013: Savings Group Leadership Roles & Expense Accounting

-- 1. Extend app_users role check to include 'accountant' and 'secretary'
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK(role IN ('member','president','treasurer','accountant','secretary','cooperative','ngo'));

-- 1b. Extend finance_payments kind check to include 'income'
ALTER TABLE finance_payments DROP CONSTRAINT IF EXISTS finance_payments_kind_check;
ALTER TABLE finance_payments ADD CONSTRAINT finance_payments_kind_check CHECK(kind IN ('contribution','loan','repayment','donation','expense','group-payout','share-out','income'));

-- 2. Role assignment history
CREATE TABLE IF NOT EXISTS savings_group_role_history (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  user_id text NOT NULL,
  old_role text NOT NULL,
  new_role text NOT NULL,
  assigned_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 3. Expense categories for savings groups
CREATE TABLE IF NOT EXISTS savings_group_expense_categories (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id),
  UNIQUE(tenant_id, org_id, name)
);

-- 4. Savings group expenses with approval workflow and receipt attachments
CREATE TABLE IF NOT EXISTS savings_group_expenses (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  amount bigint NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
  receipt_attachment text,
  status text NOT NULL DEFAULT 'recorded' CHECK(status IN ('recorded','approved','declined','paid','failed')),
  recorded_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  payment_reference text,
  journal_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);
