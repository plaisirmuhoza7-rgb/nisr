ALTER TABLE personal_loans ADD COLUMN repayment_months integer CHECK (repayment_months BETWEEN 1 AND 120);
ALTER TABLE personal_loans ADD COLUMN first_payment_date date;
ALTER TABLE personal_loans ADD CONSTRAINT personal_loans_plan_pair CHECK ((repayment_months IS NULL) = (first_payment_date IS NULL));
ALTER TABLE personal_loans ADD CONSTRAINT personal_loans_scoped_id_unique UNIQUE (tenant_id,user_id,id);
CREATE TABLE personal_loan_payments (
 id text PRIMARY KEY,
 tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 loan_id text NOT NULL,
 amount bigint NOT NULL CHECK (amount > 0 AND amount <= 1000000000000),
 payment_date date NOT NULL,
 reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,user_id,loan_id) REFERENCES personal_loans(tenant_id,user_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX personal_loan_payments_reference_idx ON personal_loan_payments(tenant_id,user_id,reference) WHERE reference IS NOT NULL;
CREATE INDEX personal_loan_payments_scope_idx ON personal_loan_payments(tenant_id,user_id,loan_id);
