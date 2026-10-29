-- A user explicitly opts their submitted goals into one organization sheet.
-- This stores routing consent only; there are no goal contents or credentials.
ALTER TABLE account_profiles ADD CONSTRAINT account_profiles_tenant_user_unique UNIQUE(tenant_id,user_id);
CREATE TABLE personal_sheet_destinations (
 tenant_id text NOT NULL,
 user_id text NOT NULL,
 org_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES account_profiles(tenant_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,user_id,org_id) REFERENCES memberships(tenant_id,user_id,org_id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,org_id) REFERENCES organization_sheet_bindings(tenant_id,org_id) ON DELETE CASCADE
);
CREATE TRIGGER personal_sheet_destination_changed
 AFTER INSERT OR UPDATE OR DELETE ON personal_sheet_destinations
 FOR EACH ROW EXECUTE FUNCTION queue_organization_sheet_change();

CREATE FUNCTION queue_personal_goal_sheet_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE destination record;
BEGIN
 IF TG_OP IN ('DELETE','UPDATE') THEN
  FOR destination IN SELECT tenant_id,org_id FROM personal_sheet_destinations
   WHERE tenant_id=OLD.tenant_id AND user_id=OLD.user_id LOOP
   PERFORM enqueue_organization_sheet(destination.tenant_id,destination.org_id);
  END LOOP;
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND (OLD.tenant_id,OLD.user_id) IS DISTINCT FROM (NEW.tenant_id,NEW.user_id)) THEN
  FOR destination IN SELECT tenant_id,org_id FROM personal_sheet_destinations
   WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id LOOP
   PERFORM enqueue_organization_sheet(destination.tenant_id,destination.org_id);
  END LOOP;
 END IF;
 RETURN NULL;
END;
$$;
CREATE TRIGGER personal_goal_sheet_changed
 AFTER INSERT OR UPDATE OR DELETE ON goals
 FOR EACH ROW EXECUTE FUNCTION queue_personal_goal_sheet_change();
CREATE TRIGGER personal_onboarding_sheet_changed
 AFTER INSERT OR UPDATE OR DELETE ON workspace_onboarding_requests
 FOR EACH ROW EXECUTE FUNCTION queue_personal_goal_sheet_change();

-- A consented account name/email or active status change can alter the export.
-- Credential fields and session tables never trigger or enter sheet payloads.
CREATE FUNCTION queue_personal_account_sheet_change() RETURNS trigger
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
CREATE TRIGGER personal_sheet_user_changed
 AFTER UPDATE OF name,email ON app_users
 FOR EACH ROW EXECUTE FUNCTION queue_personal_account_sheet_change();
CREATE TRIGGER personal_sheet_profile_changed
 AFTER UPDATE OF status ON account_profiles
 FOR EACH ROW EXECUTE FUNCTION queue_personal_account_sheet_change();
