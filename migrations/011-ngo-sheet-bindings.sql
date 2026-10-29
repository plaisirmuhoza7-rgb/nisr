-- Preserve a real composite finance-org FK for every non-NGO destination.
-- NGO programs are not fabricated financial organizations.
ALTER TABLE organization_sheet_bindings
 ADD COLUMN financial_org_id text GENERATED ALWAYS AS
  (CASE WHEN org_id='ngo-imizi' THEN NULL ELSE org_id END) STORED;
ALTER TABLE organization_sheet_bindings
 ADD CONSTRAINT organization_sheet_financial_org_fk
 FOREIGN KEY(tenant_id,financial_org_id) REFERENCES finance_orgs(tenant_id,org_id);
ALTER TABLE organization_sheet_bindings
 ADD CONSTRAINT organization_sheet_tenant_fk
 FOREIGN KEY(tenant_id) REFERENCES demo_tenants(id);
ALTER TABLE organization_sheet_bindings
 DROP CONSTRAINT organization_sheet_bindings_tenant_id_org_id_fkey;

-- Fail safely rather than silently grandfathering any previously fabricated
-- NGO financial organization binding without an exact active NGO administrator.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM organization_sheet_bindings b WHERE b.org_id='ngo-imizi'
  AND NOT EXISTS(SELECT 1 FROM memberships m
   JOIN account_profiles p ON p.tenant_id=m.tenant_id AND p.user_id=m.user_id AND p.status='active'
   JOIN app_users u ON u.id=m.user_id AND u.role='ngo'
   WHERE m.tenant_id=b.tenant_id AND m.org_id=b.org_id AND m.role='ngo')) THEN
  RAISE EXCEPTION 'Existing NGO binding requires an active administrator in the exact organization';
 END IF;
END;
$$;

CREATE FUNCTION validate_ngo_sheet_binding() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE candidate record;
BEGIN
 IF NEW.org_id<>'ngo-imizi' THEN RETURN NEW; END IF;
 FOR candidate IN SELECT m.user_id FROM memberships m
  JOIN account_profiles p ON p.tenant_id=m.tenant_id AND p.user_id=m.user_id
  WHERE m.tenant_id=NEW.tenant_id AND m.org_id=NEW.org_id
   AND m.role='ngo' AND p.status='active' ORDER BY m.user_id LOOP
  -- Match provisioning's profile -> account -> membership lock order.
  PERFORM 1 FROM account_profiles WHERE tenant_id=NEW.tenant_id
   AND user_id=candidate.user_id AND status='active' FOR SHARE;
  IF NOT FOUND THEN CONTINUE; END IF;
  PERFORM 1 FROM app_users WHERE id=candidate.user_id AND role='ngo' FOR SHARE;
  IF NOT FOUND THEN CONTINUE; END IF;
  PERFORM 1 FROM memberships WHERE tenant_id=NEW.tenant_id
   AND org_id=NEW.org_id AND user_id=candidate.user_id AND role='ngo' FOR SHARE;
  IF FOUND THEN RETURN NEW; END IF;
 END LOOP;
 RAISE EXCEPTION 'NGO sheet binding requires an active administrator in the exact organization';
END;
$$;
CREATE TRIGGER organization_sheet_ngo_guard BEFORE INSERT OR UPDATE
 ON organization_sheet_bindings FOR EACH ROW EXECUTE FUNCTION validate_ngo_sheet_binding();

-- NGO spreadsheets contain interventions only, never personal/account records.
ALTER TABLE personal_sheet_destinations ADD CONSTRAINT personal_sheet_financial_destination_only
 CHECK(org_id<>'ngo-imizi');

CREATE FUNCTION queue_organization_profile_status_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE destination record;
BEGIN
 IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;
 FOR destination IN SELECT DISTINCT m.tenant_id,m.org_id FROM memberships m
  JOIN organization_sheet_bindings b ON b.tenant_id=m.tenant_id AND b.org_id=m.org_id
  WHERE m.tenant_id=NEW.tenant_id AND m.user_id=NEW.user_id
  ORDER BY m.tenant_id,m.org_id LOOP
  PERFORM enqueue_organization_sheet(destination.tenant_id,destination.org_id);
 END LOOP;
 RETURN NULL;
END;
$$;
CREATE TRIGGER organization_sheet_profile_status_changed AFTER UPDATE OF status
 ON account_profiles FOR EACH ROW EXECUTE FUNCTION queue_organization_profile_status_change();
