ALTER TABLE finance_orgs ADD COLUMN savings_model text CHECK(savings_model IN ('ACCUMULATING','ROTATING'));
UPDATE finance_orgs SET savings_model='ACCUMULATING' WHERE kind='group' AND savings_model IS NULL;
ALTER TABLE finance_orgs ADD CONSTRAINT finance_org_group_model CHECK((kind='group' AND savings_model IS NOT NULL) OR (kind<>'group' AND savings_model IS NULL));

CREATE TABLE savings_group_policies (
 tenant_id text NOT NULL, org_id text NOT NULL,
 description text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', contact text NOT NULL DEFAULT '',
 expected_members integer NOT NULL DEFAULT 5 CHECK(expected_members BETWEEN 2 AND 500),
 contribution_amount bigint NOT NULL DEFAULT 10000 CHECK(contribution_amount BETWEEN 1 AND 9007199254740991),
 contribution_frequency text NOT NULL DEFAULT 'monthly' CHECK(contribution_frequency IN ('daily','weekly','monthly')),
 contribution_type text NOT NULL DEFAULT 'fixed' CHECK(contribution_type IN ('fixed','variable')),
 due_day integer NOT NULL DEFAULT 1 CHECK(due_day BETWEEN 1 AND 31),
 rotation_order jsonb NOT NULL DEFAULT '[]'::jsonb,
 partial_policy text NOT NULL DEFAULT 'allow' CHECK(partial_policy IN ('allow','full_only')),
 missed_policy text NOT NULL DEFAULT 'flag' CHECK(missed_policy IN ('flag','delay_round')),
 late_penalty bigint NOT NULL DEFAULT 0 CHECK(late_penalty BETWEEN 0 AND 9007199254740991),
 cycle_start date, cycle_end date, share_out_date date,
 minimum_reserve_bps integer NOT NULL DEFAULT 2000 CHECK(minimum_reserve_bps BETWEEN 0 AND 10000),
 emergency_lending boolean NOT NULL DEFAULT true,
 loan_limit_bps integer NOT NULL DEFAULT 5000 CHECK(loan_limit_bps BETWEEN 0 AND 10000),
 distribution_rule text NOT NULL DEFAULT 'proportional' CHECK(distribution_rule IN ('proportional','equal')),
 accepted_by text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,org_id), FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE savings_cycles (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL,
 start_date date NOT NULL, end_date date NOT NULL, status text NOT NULL DEFAULT 'collecting' CHECK(status IN ('collecting','frozen','settling','closed')),
 closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id), CHECK(end_date>start_date)
);
CREATE UNIQUE INDEX savings_one_open_cycle ON savings_cycles(tenant_id,org_id) WHERE status<>'closed';
CREATE TABLE savings_rotation_rounds (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, cycle_id text NOT NULL REFERENCES savings_cycles(id),
 round_number integer NOT NULL CHECK(round_number>0), recipient_user_id text NOT NULL,
 due_date date NOT NULL, expected_pool bigint NOT NULL CHECK(expected_pool BETWEEN 0 AND 9007199254740991),
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','collecting','ready','approved','pending','paid','delayed','failed','unknown','cancelled')),
 actual_paid bigint NOT NULL DEFAULT 0 CHECK(actual_paid BETWEEN 0 AND 9007199254740991), payout_reference text,
 UNIQUE(tenant_id,org_id,cycle_id,round_number), UNIQUE(tenant_id,org_id,cycle_id,recipient_user_id),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE savings_obligations (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, cycle_id text NOT NULL REFERENCES savings_cycles(id),
 round_id text REFERENCES savings_rotation_rounds(id), user_id text NOT NULL,
 amount_due bigint NOT NULL CHECK(amount_due BETWEEN 1 AND 9007199254740991), amount_confirmed bigint NOT NULL DEFAULT 0 CHECK(amount_confirmed BETWEEN 0 AND 9007199254740991),
 due_date date NOT NULL, status text NOT NULL DEFAULT 'due' CHECK(status IN ('due','partial','paid','missed','waived')),
 UNIQUE(tenant_id,org_id,cycle_id,round_id,user_id), FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id), CHECK(amount_confirmed<=amount_due)
);
CREATE TABLE savings_group_invites (
 invite_code text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
INSERT INTO savings_group_policies(tenant_id,org_id,expected_members,cycle_start,cycle_end,accepted_by)
 SELECT tenant_id,org_id,GREATEST(member_count,2),CURRENT_DATE,(CURRENT_DATE+interval '1 year')::date,'system-migration'
 FROM finance_orgs WHERE kind='group' ON CONFLICT(tenant_id,org_id) DO NOTHING;
INSERT INTO savings_cycles(id,tenant_id,org_id,start_date,end_date)
 SELECT 'cycle-migrated-'||tenant_id||'-'||org_id,tenant_id,org_id,cycle_start,cycle_end
 FROM savings_group_policies p WHERE NOT EXISTS(SELECT 1 FROM savings_cycles c WHERE c.tenant_id=p.tenant_id AND c.org_id=p.org_id AND c.status<>'closed');
CREATE INDEX savings_group_invites_scope ON savings_group_invites(tenant_id,org_id);
ALTER TABLE finance_payments ADD COLUMN obligation_id text REFERENCES savings_obligations(id);
ALTER TABLE finance_payments ADD COLUMN rotation_round_id text REFERENCES savings_rotation_rounds(id);
ALTER TABLE finance_payments ADD COLUMN cycle_id text REFERENCES savings_cycles(id);
CREATE UNIQUE INDEX savings_unique_round_payout ON finance_payments(tenant_id,org_id,rotation_round_id) WHERE kind='group-payout' AND rotation_round_id IS NOT NULL AND status IN ('pending','unknown','success');
ALTER TABLE finance_payments DROP CONSTRAINT IF EXISTS finance_payments_kind_check;
ALTER TABLE finance_payments ADD CONSTRAINT finance_payments_kind_check CHECK(kind IN ('contribution','loan','repayment','donation','expense','group-payout','share-out'));
CREATE UNIQUE INDEX savings_unique_shareout ON finance_payments(tenant_id,org_id,cycle_id,user_id) WHERE kind='share-out' AND cycle_id IS NOT NULL AND status IN ('pending','unknown','success');

CREATE FUNCTION prevent_savings_model_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.kind='group' AND NEW.savings_model IS DISTINCT FROM OLD.savings_model THEN RAISE EXCEPTION 'A savings group model cannot be changed after creation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_org_savings_model_immutable BEFORE UPDATE OF savings_model ON finance_orgs FOR EACH ROW EXECUTE FUNCTION prevent_savings_model_change();
