-- Make retries durable and ensure added triggers also exist for databases that
-- had already applied the preceding migrations before this update.
ALTER TABLE organization_sheet_outbox ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE organization_sheet_outbox ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE organization_sheet_outbox ADD COLUMN IF NOT EXISTS last_error_code text;

CREATE OR REPLACE FUNCTION enqueue_organization_sheet(p_tenant text, p_org text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM organization_sheet_bindings WHERE tenant_id=p_tenant AND org_id=p_org FOR SHARE;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO organization_sheet_outbox(tenant_id,org_id) VALUES(p_tenant,p_org)
 ON CONFLICT(tenant_id,org_id) DO UPDATE
 SET desired_revision=organization_sheet_outbox.desired_revision+1,
     status='pending', updated_at=now(), next_attempt_at=now(),
     attempt_count=0, last_error_code=NULL;
END;
$$;

DROP TRIGGER IF EXISTS organization_sheet_changed ON interventions;
CREATE TRIGGER organization_sheet_changed AFTER INSERT OR UPDATE OR DELETE ON interventions
 FOR EACH ROW EXECUTE FUNCTION queue_organization_sheet_change();
DROP TRIGGER IF EXISTS personal_onboarding_sheet_changed ON workspace_onboarding_requests;
CREATE TRIGGER personal_onboarding_sheet_changed AFTER INSERT OR UPDATE OR DELETE ON workspace_onboarding_requests
 FOR EACH ROW EXECUTE FUNCTION queue_personal_goal_sheet_change();

CREATE OR REPLACE FUNCTION queue_personal_account_sheet_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE destination record; selected_user text;
BEGIN
 IF TG_TABLE_NAME='app_users' THEN
  IF (OLD.name,OLD.email) IS NOT DISTINCT FROM (NEW.name,NEW.email) THEN RETURN NULL; END IF;
  selected_user=NEW.id;
 ELSE
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;
  selected_user=NEW.user_id;
 END IF;
 FOR destination IN SELECT tenant_id,org_id FROM personal_sheet_destinations WHERE user_id=selected_user LOOP
  PERFORM enqueue_organization_sheet(destination.tenant_id,destination.org_id);
 END LOOP;
 RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS personal_sheet_user_changed ON app_users;
CREATE TRIGGER personal_sheet_user_changed AFTER UPDATE OF name,email ON app_users
 FOR EACH ROW EXECUTE FUNCTION queue_personal_account_sheet_change();
DROP TRIGGER IF EXISTS personal_sheet_profile_changed ON account_profiles;
CREATE TRIGGER personal_sheet_profile_changed AFTER UPDATE OF status ON account_profiles
 FOR EACH ROW EXECUTE FUNCTION queue_personal_account_sheet_change();
