CREATE TABLE IF NOT EXISTS finance_orgs (
 tenant_id text NOT NULL REFERENCES demo_tenants(id), org_id text NOT NULL,
 name text NOT NULL, kind text NOT NULL CHECK(kind IN ('group','fund','cooperative')),
 district text NOT NULL DEFAULT 'Gasabo', member_count integer NOT NULL DEFAULT 0,
 reserve_bps integer NOT NULL DEFAULT 2000 CHECK(reserve_bps BETWEEN 0 AND 10000),
 loan_limit_bps integer NOT NULL DEFAULT 5000 CHECK(loan_limit_bps BETWEEN 0 AND 10000),
 PRIMARY KEY(tenant_id,org_id)
);
CREATE TABLE IF NOT EXISTS finance_entries (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL,
 description text NOT NULL, reference text NOT NULL, reversal_of text,
 posting_txid bigint NOT NULL DEFAULT txid_current(),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id),
 UNIQUE(tenant_id,org_id,reference), UNIQUE(tenant_id,org_id,reversal_of)
);
CREATE TABLE IF NOT EXISTS finance_lines (
 id text PRIMARY KEY, entry_id text NOT NULL REFERENCES finance_entries(id),
 tenant_id text NOT NULL, org_id text NOT NULL, account text NOT NULL, user_id text,
 debit bigint NOT NULL DEFAULT 0 CHECK(debit BETWEEN 0 AND 9007199254740991),
 credit bigint NOT NULL DEFAULT 0 CHECK(credit BETWEEN 0 AND 9007199254740991),
 CHECK((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE INDEX IF NOT EXISTS finance_lines_scope ON finance_lines(tenant_id,org_id,account,user_id);
CREATE OR REPLACE FUNCTION finance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Posted journals are immutable; create a reversal'; END;
$$;
CREATE TRIGGER finance_entries_immutable BEFORE UPDATE OR DELETE ON finance_entries FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER finance_lines_immutable BEFORE UPDATE OR DELETE ON finance_lines FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE OR REPLACE FUNCTION finance_validate_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF NOT EXISTS (SELECT 1 FROM finance_entries WHERE id=NEW.entry_id AND tenant_id=NEW.tenant_id AND org_id=NEW.org_id AND posting_txid=txid_current()) THEN
   RAISE EXCEPTION 'Journal lines must be posted with their entry in the same transaction, tenant and organization';
  END IF;
  RETURN NEW;
 END;
$$;
CREATE TRIGGER finance_lines_scope BEFORE INSERT ON finance_lines FOR EACH ROW EXECUTE FUNCTION finance_validate_line_scope();
CREATE OR REPLACE FUNCTION finance_validate_balance() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE scoped_entry text; debits numeric; credits numeric; line_count integer;
 BEGIN
  IF TG_TABLE_NAME='finance_entries' THEN scoped_entry=NEW.id; ELSE scoped_entry=NEW.entry_id; END IF;
  SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0),COUNT(*) INTO debits,credits,line_count FROM finance_lines WHERE entry_id=scoped_entry;
  IF line_count<2 OR debits<>credits OR debits<=0 THEN RAISE EXCEPTION 'Posted journal must have balanced debit and credit lines'; END IF;
  RETURN NEW;
 END;
$$;
CREATE CONSTRAINT TRIGGER finance_entry_balance AFTER INSERT ON finance_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_validate_balance();
CREATE CONSTRAINT TRIGGER finance_line_balance AFTER INSERT ON finance_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_validate_balance();
CREATE TABLE IF NOT EXISTS finance_loans (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, user_id text NOT NULL,
 amount bigint NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991), months integer NOT NULL CHECK(months BETWEEN 1 AND 24),
 status text NOT NULL CHECK(status IN ('requested','declined','disbursing','active','repaid','failed','reversed')),
 approved_by text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE IF NOT EXISTS finance_campaigns (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, title text NOT NULL,
 category text NOT NULL, description text NOT NULL,
 target bigint NOT NULL CHECK(target > 0 AND target <= 9007199254740991), status text NOT NULL DEFAULT 'active',
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE IF NOT EXISTS finance_expenses (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, campaign_id text NOT NULL REFERENCES finance_campaigns(id),
 title text NOT NULL, amount bigint NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
 requested_by text NOT NULL, approved_by text, status text NOT NULL DEFAULT 'requested',
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE IF NOT EXISTS finance_payments (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, user_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('contribution','loan','repayment','donation','expense')),
 amount bigint NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
 status text NOT NULL CHECK(status IN ('success','failed','pending','unknown')),
 reference text NOT NULL, loan_id text, campaign_id text, expense_id text,
 journal_id text REFERENCES finance_entries(id), synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id),
 UNIQUE(tenant_id,org_id,reference)
);
CREATE INDEX IF NOT EXISTS finance_payments_scope ON finance_payments(tenant_id,org_id,status,kind);
CREATE TABLE IF NOT EXISTS finance_proposals (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL, title text NOT NULL,
 amount bigint NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
 status text NOT NULL DEFAULT 'proposed', created_by text NOT NULL,
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE IF NOT EXISTS finance_votes (
 tenant_id text NOT NULL, org_id text NOT NULL, proposal_id text NOT NULL REFERENCES finance_proposals(id), user_id text NOT NULL,
 PRIMARY KEY(tenant_id,org_id,proposal_id,user_id),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TABLE IF NOT EXISTS finance_audit (
 id text PRIMARY KEY, tenant_id text NOT NULL, org_id text NOT NULL,
 sequence bigint NOT NULL CHECK(sequence>0), action text NOT NULL, actor_id text NOT NULL, actor_role text NOT NULL,
 details text NOT NULL, created_at timestamptz NOT NULL,
 prev_hash text NOT NULL, hash text NOT NULL CHECK(length(hash)=64),
 UNIQUE(tenant_id,org_id,sequence),
 FOREIGN KEY(tenant_id,org_id) REFERENCES finance_orgs(tenant_id,org_id)
);
CREATE TRIGGER finance_audit_immutable BEFORE UPDATE OR DELETE ON finance_audit FOR EACH ROW EXECUTE FUNCTION finance_immutable();
