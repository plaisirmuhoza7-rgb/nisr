-- HURIZA IMPACT — OPERATION INSTITUTIONAL INTELLIGENCE
-- NGO Management, Grants, Field Operations, Monitoring & Evaluation (MEAL),
-- ImpactTrace, and Donor Accountability Platform

CREATE TABLE ngo_profiles (
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  name text NOT NULL,
  ngo_type text NOT NULL DEFAULT 'national_ngo' CHECK (ngo_type IN ('local_ngo','national_ngo','international_ngo','foundation','faith_based','social_enterprise','government_program','research_partner')),
  designation text NOT NULL DEFAULT 'National Financial Inclusion & Community Development Partner',
  mission text NOT NULL DEFAULT '',
  focus_sectors text NOT NULL DEFAULT '["financial_inclusion","savings_groups","cooperative_strengthening","women_youth_empowerment"]',
  operating_districts text NOT NULL DEFAULT '["Gasabo","Kicukiro","Rulindo","Rwamagana","Huye"]',
  contact_email text NOT NULL DEFAULT 'programs@cgi-rwanda.org',
  contact_phone text NOT NULL DEFAULT '+250 788 310 400',
  website text NOT NULL DEFAULT 'https://cgi-rwanda.org',
  registration_ref text NOT NULL DEFAULT 'RGB/NGO/2021/0418',
  reporting_period text NOT NULL DEFAULT 'quarterly' CHECK (reporting_period IN ('monthly','quarterly','semi_annual','annual')),
  approval_threshold_rwf bigint NOT NULL DEFAULT 500000 CHECK (approval_threshold_rwf >= 0),
  data_retention_months integer NOT NULL DEFAULT 60 CHECK (data_retention_months >= 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, org_id)
);

CREATE TABLE ngo_staff_members (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  user_id text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  ngo_role text NOT NULL CHECK (ngo_role IN ('country_director','program_director','program_manager','project_officer','field_officer','meal_officer','finance_manager','accountant','grants_officer','safeguarding_officer','donor_viewer','partner_user','auditor','super_admin')),
  assigned_program_id text NOT NULL DEFAULT 'all',
  department text NOT NULL DEFAULT 'Programs & Field Operations',
  location_district text NOT NULL DEFAULT 'Gasabo',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','inactive')),
  assigned_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_programs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  objective text NOT NULL DEFAULT '',
  target_population text NOT NULL DEFAULT '',
  districts text NOT NULL DEFAULT '[]',
  start_date text NOT NULL,
  end_date text NOT NULL,
  funding_source text NOT NULL DEFAULT '',
  total_budget bigint NOT NULL DEFAULT 0 CHECK (total_budget >= 0),
  lead_officer text NOT NULL DEFAULT '',
  partner_orgs text NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planning','active','completed','on_hold','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_projects (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  district text NOT NULL,
  sector text NOT NULL DEFAULT '',
  site_name text NOT NULL DEFAULT '',
  budget_allocated bigint NOT NULL DEFAULT 0 CHECK (budget_allocated >= 0),
  budget_spent bigint NOT NULL DEFAULT 0 CHECK (budget_spent >= 0),
  lead_officer text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planning','active','completed','paused')),
  start_date text NOT NULL,
  end_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_grants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  grant_code text NOT NULL,
  title text NOT NULL,
  currency text NOT NULL DEFAULT 'RWF' CHECK (currency IN ('RWF','USD','EUR','GBP')),
  original_amount bigint NOT NULL CHECK (original_amount >= 0),
  exchange_rate_rwf bigint NOT NULL DEFAULT 1 CHECK (exchange_rate_rwf > 0),
  award_amount_rwf bigint NOT NULL CHECK (award_amount_rwf >= 0),
  received_amount_rwf bigint NOT NULL DEFAULT 0 CHECK (received_amount_rwf >= 0),
  approved_budget_rwf bigint NOT NULL DEFAULT 0 CHECK (approved_budget_rwf >= 0),
  restricted_categories text NOT NULL DEFAULT '[]',
  start_date text NOT NULL,
  end_date text NOT NULL,
  next_report_due text NOT NULL DEFAULT '',
  reporting_schedule text NOT NULL DEFAULT 'Quarterly financial & MEAL narrative',
  conditions_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pipeline','active','reporting_due','closing','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_budget_lines (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  grant_id text NOT NULL REFERENCES ngo_grants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('savings_group_capacity','cooperative_support','field_operations','training_materials','monitoring_evaluation','digital_inclusion','safeguarding','personnel_admin','contingency')),
  line_code text NOT NULL,
  description text NOT NULL,
  allocated_amount bigint NOT NULL CHECK (allocated_amount >= 0),
  committed_amount bigint NOT NULL DEFAULT 0 CHECK (committed_amount >= 0),
  spent_amount bigint NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_activities (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  project_id text,
  grant_id text,
  budget_line_id text,
  title text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('group_training','cooperative_advisory','seed_kit_distribution','digital_ledger_onboarding','field_monitoring','safeguarding_clinic','community_dialogue','baseline_survey')),
  district text NOT NULL,
  sector text NOT NULL DEFAULT '',
  scheduled_date text NOT NULL,
  completed_date text NOT NULL DEFAULT '',
  lead_officer text NOT NULL DEFAULT '',
  target_participants integer NOT NULL DEFAULT 0 CHECK (target_participants >= 0),
  actual_participants integer NOT NULL DEFAULT 0 CHECK (actual_participants >= 0),
  linked_entity_type text NOT NULL DEFAULT 'savings_group' CHECK (linked_entity_type IN ('savings_group','cooperative','fund_campaign','household_cohort','community_org')),
  linked_entity_id text NOT NULL DEFAULT '',
  evidence_url text NOT NULL DEFAULT '',
  evidence_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','delayed','cancelled')),
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted','meal_reviewed','approved','flagged')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_expenses (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  project_id text,
  grant_id text NOT NULL REFERENCES ngo_grants(id) ON DELETE CASCADE,
  budget_line_id text NOT NULL REFERENCES ngo_budget_lines(id) ON DELETE CASCADE,
  activity_id text,
  title text NOT NULL,
  category text NOT NULL,
  vendor_name text NOT NULL DEFAULT '',
  amount bigint NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'RWF',
  receipt_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','program_reviewed','finance_approved','paid','rejected','reversed')),
  requested_by text NOT NULL,
  reviewed_by text NOT NULL DEFAULT '',
  approved_by text NOT NULL DEFAULT '',
  payment_reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_beneficiary_cohorts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  cohort_code text NOT NULL,
  name text NOT NULL,
  cohort_type text NOT NULL CHECK (cohort_type IN ('savings_group_itsinda','savings_group_ikimina','cooperative','household_cluster','youth_enterprise','women_collective')),
  district text NOT NULL,
  sector text NOT NULL DEFAULT '',
  linked_org_id text NOT NULL DEFAULT '',
  households_count integer NOT NULL DEFAULT 0 CHECK (households_count >= 0),
  participants_count integer NOT NULL DEFAULT 0 CHECK (participants_count >= 0),
  female_count integer NOT NULL DEFAULT 0 CHECK (female_count >= 0),
  youth_count integer NOT NULL DEFAULT 0 CHECK (youth_count >= 0),
  enrollment_stage text NOT NULL DEFAULT 'active' CHECK (enrollment_stage IN ('registered','enrolled','active','graduated','inactive')),
  safeguarding_level text NOT NULL DEFAULT 'standard' CHECK (safeguarding_level IN ('standard','protected_youth','high_confidentiality')),
  consent_basis text NOT NULL DEFAULT 'informed_program_consent',
  assigned_officer text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_field_visits (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  activity_id text,
  officer_id text NOT NULL,
  officer_name text NOT NULL,
  visit_date text NOT NULL,
  district text NOT NULL,
  sector text NOT NULL DEFAULT '',
  community_name text NOT NULL DEFAULT '',
  purpose text NOT NULL,
  form_type text NOT NULL DEFAULT 'savings_group_monitoring' CHECK (form_type IN ('group_registration','training_attendance','savings_group_monitoring','cooperative_support_visit','beneficiary_enrollment','follow_up_assessment')),
  attendees_count integer NOT NULL DEFAULT 0 CHECK (attendees_count >= 0),
  observations text NOT NULL DEFAULT '',
  outcomes_recorded text NOT NULL DEFAULT '',
  follow_up_needed text NOT NULL DEFAULT '',
  evidence_attachment text NOT NULL DEFAULT '',
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('queued_offline','synced','verified')),
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted','meal_reviewed','approved','flagged')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_indicators (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('input','activity','output','outcome','impact_context')),
  unit text NOT NULL DEFAULT 'count' CHECK (unit IN ('count','percentage','rwf','groups','cooperatives','households')),
  baseline_value bigint NOT NULL DEFAULT 0,
  target_value bigint NOT NULL DEFAULT 0,
  current_value bigint NOT NULL DEFAULT 0,
  numerator_label text NOT NULL DEFAULT '',
  denominator_label text NOT NULL DEFAULT '',
  data_source text NOT NULL DEFAULT '',
  disaggregation text NOT NULL DEFAULT '{}',
  reporting_period text NOT NULL DEFAULT '2026-Q2',
  responsible_officer text NOT NULL DEFAULT '',
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('submitted','meal_reviewed','approved','flagged')),
  methodology_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_data_quality_issues (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  issue_type text NOT NULL CHECK (issue_type IN ('missing_evidence','duplicate_beneficiary','unverified_indicator','overdue_group_report','budget_variance','missing_consent')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  record_ref text NOT NULL,
  description text NOT NULL,
  resolution_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','dismissed')),
  detected_by text NOT NULL DEFAULT 'HURIZA Data Quality Guardian',
  resolved_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_report_snapshots (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  grant_id text,
  title text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('donor_quarterly','rgb_compliance','district_partner','annual_impact','audit_pack')),
  reporting_period text NOT NULL,
  executive_summary text NOT NULL,
  activities_summary text NOT NULL DEFAULT '',
  indicators_snapshot text NOT NULL DEFAULT '[]',
  budget_summary text NOT NULL DEFAULT '{}',
  risks_and_limitations text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved')),
  prepared_by text NOT NULL,
  approved_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ngo_donor_access_grants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES demo_tenants(id) ON DELETE CASCADE,
  org_id text NOT NULL DEFAULT 'ngo-imizi',
  program_id text NOT NULL REFERENCES ngo_programs(id) ON DELETE CASCADE,
  grant_id text,
  donor_name text NOT NULL,
  donor_email text NOT NULL,
  access_code text NOT NULL,
  permissions_scope text NOT NULL DEFAULT 'aggregates_and_reports' CHECK (permissions_scope IN ('aggregates_only','aggregates_and_reports','full_grant_financials')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at text NOT NULL DEFAULT '2026-12-31',
  granted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ngo_profiles','ngo_staff_members','ngo_programs','ngo_projects',
    'ngo_grants','ngo_budget_lines','ngo_activities','ngo_expenses',
    'ngo_beneficiary_cohorts','ngo_field_visits','ngo_indicators',
    'ngo_data_quality_issues','ngo_report_snapshots','ngo_donor_access_grants'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER organization_sheet_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION queue_organization_sheet_change()',
      table_name
    );
  END LOOP;
END;
$$;
