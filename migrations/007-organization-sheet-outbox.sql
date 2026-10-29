-- Durable organization-only delivery intent. This migration never exports data.
-- Worker contract: serialize delivery using a SEPARATE destination lock, never
-- this coalescing row across network I/O. Read a revision, write its snapshot,
-- then briefly acknowledge that revision without overwriting a newer desired
-- revision. New changes must remain pending if desired exceeds the sent revision.
CREATE TABLE organization_sheet_outbox (
 tenant_id text NOT NULL,
 org_id text NOT NULL,
 desired_revision bigint NOT NULL DEFAULT 1 CHECK (desired_revision > 0),
 delivered_revision bigint NOT NULL DEFAULT 0 CHECK (delivered_revision >= 0 AND delivered_revision <= desired_revision),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','blocked')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, org_id),
 FOREIGN KEY (tenant_id, org_id) REFERENCES organization_sheet_bindings(tenant_id, org_id) ON DELETE CASCADE,
 CHECK (status <> 'synced' OR delivered_revision = desired_revision)
);

CREATE FUNCTION enqueue_organization_sheet(p_tenant text, p_org text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
 -- Hold the binding against deletion until this transaction finishes. Unbound
 -- scopes create no queue row. The conflict update locks and increments the
 -- current row atomically, so concurrent committed changes cannot be lost.
 PERFORM 1 FROM organization_sheet_bindings
  WHERE tenant_id=p_tenant AND org_id=p_org FOR SHARE;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO organization_sheet_outbox(tenant_id,org_id)
 VALUES(p_tenant,p_org)
 ON CONFLICT(tenant_id,org_id) DO UPDATE
 SET desired_revision=organization_sheet_outbox.desired_revision+1,
     status='pending', updated_at=now();
END;
$$;

CREATE FUNCTION queue_organization_sheet_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM enqueue_organization_sheet(OLD.tenant_id,OLD.org_id);
 ELSIF TG_OP='INSERT' THEN
  PERFORM enqueue_organization_sheet(NEW.tenant_id,NEW.org_id);
 ELSE
  -- Queue both destinations if a mutable record changes scope; ordinary
  -- updates enqueue only once. No record content is retained in the queue.
  PERFORM enqueue_organization_sheet(NEW.tenant_id,NEW.org_id);
  IF (OLD.tenant_id,OLD.org_id) IS DISTINCT FROM (NEW.tenant_id,NEW.org_id) THEN
   PERFORM enqueue_organization_sheet(OLD.tenant_id,OLD.org_id);
  END IF;
 END IF;
 RETURN NULL;
END;
$$;

CREATE TRIGGER organization_sheet_initial_snapshot
 AFTER INSERT ON organization_sheet_bindings
 FOR EACH ROW EXECUTE FUNCTION queue_organization_sheet_change();

DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY[
  'finance_orgs','finance_entries','finance_lines','finance_loans',
  'finance_campaigns','finance_expenses','finance_payments','finance_proposals',
  'finance_votes','finance_audit','savings_group_policies','savings_cycles',
  'savings_rotation_rounds','savings_obligations','memberships','interventions'
 ] LOOP
  EXECUTE format('CREATE TRIGGER organization_sheet_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION queue_organization_sheet_change()',table_name);
 END LOOP;
END;
$$;

-- Existing trusted bindings need their first snapshot as well.
INSERT INTO organization_sheet_outbox(tenant_id,org_id)
 SELECT tenant_id,org_id FROM organization_sheet_bindings;
