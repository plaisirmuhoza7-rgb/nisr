-- Migration 015: HURIZA Fund — Social Fundraising, Campaign Pages, Contributions & TrustFlow Transparency

-- 1. Extended Campaign Profiles, Themes & Granular Visibility Policies
CREATE TABLE IF NOT EXISTS fundraising_campaign_profiles (
  campaign_id text PRIMARY KEY REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  slug text NOT NULL,
  family text NOT NULL DEFAULT 'causes' CHECK (family IN ('moments','causes','community')),
  subcategory text NOT NULL DEFAULT 'charity',
  theme text NOT NULL DEFAULT 'classic_blue' CHECK (theme IN ('wedding_elegant','birthday_celebration','medical_trust','charity_warm','community_impact','classic_blue')),
  organizer_user_id text NOT NULL,
  organizer_name text NOT NULL,
  beneficiary_name text NOT NULL DEFAULT '',
  beneficiary_type text NOT NULL DEFAULT 'community' CHECK (beneficiary_type IN ('self','individual','family','child_protected','community','organization')),
  location text NOT NULL DEFAULT 'Kigali, Rwanda',
  event_date date,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  story text NOT NULL DEFAULT '',
  cover_image_url text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted','private')),
  stats_visibility text NOT NULL DEFAULT 'everyone' CHECK (stats_visibility IN ('everyone','contributors_only','selected_contributors','team_only')),
  goal_visibility text NOT NULL DEFAULT 'everyone' CHECK (goal_visibility IN ('everyone','contributors_only','selected_contributors','team_only')),
  raised_visibility text NOT NULL DEFAULT 'everyone' CHECK (raised_visibility IN ('everyone','contributors_only','selected_contributors','team_only')),
  contributors_visibility text NOT NULL DEFAULT 'everyone' CHECK (contributors_visibility IN ('everyone','contributors_only','selected_contributors','team_only')),
  spending_visibility text NOT NULL DEFAULT 'everyone' CHECK (spending_visibility IN ('everyone','contributors_only','selected_contributors','team_only')),
  allow_comments boolean NOT NULL DEFAULT true,
  allow_anonymous boolean NOT NULL DEFAULT true,
  allow_rsvp boolean NOT NULL DEFAULT false,
  suggested_amounts text NOT NULL DEFAULT '5000,10000,25000,50000',
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending_review','verified_demo','requires_review','suspended')),
  verification_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

CREATE INDEX IF NOT EXISTS fundraising_campaign_profiles_slug_idx ON fundraising_campaign_profiles(slug);
CREATE INDEX IF NOT EXISTS fundraising_campaign_profiles_scope_idx ON fundraising_campaign_profiles(tenant_id, org_id, visibility);

-- 2. Campaign Media Gallery & Documents
CREATE TABLE IF NOT EXISTS fundraising_campaign_media (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'gallery' CHECK (media_type IN ('cover','gallery','video','document')),
  url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 3. Organizer Social Updates & Progress Feed
CREATE TABLE IF NOT EXISTS fundraising_campaign_updates (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  update_type text NOT NULL DEFAULT 'progress' CHECK (update_type IN ('progress','milestone','thank_you','announcement','spending','photo')),
  title text NOT NULL,
  body text NOT NULL,
  media_url text NOT NULL DEFAULT '',
  author_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 4. Supporter Comments, Guestbook & Congratulatory Messages
CREATE TABLE IF NOT EXISTS fundraising_comments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  update_id text,
  author_id text NOT NULL,
  author_name text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  comment_type text NOT NULL DEFAULT 'comment' CHECK (comment_type IN ('comment','guestbook','congratulation','dedication')),
  message text NOT NULL,
  reaction text NOT NULL DEFAULT 'heart',
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 5. Supporter Reactions
CREATE TABLE IF NOT EXISTS fundraising_reactions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'campaign' CHECK (target_type IN ('campaign','update')),
  target_id text NOT NULL,
  user_id text NOT NULL,
  reaction_type text NOT NULL DEFAULT 'heart' CHECK (reaction_type IN ('heart','celebrate','pray','clap','star')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, org_id, campaign_id, target_type, target_id, user_id),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 6. Campaign Followers
CREATE TABLE IF NOT EXISTS fundraising_followers (
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id, org_id, campaign_id, user_id),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 7. Contributions, Pledges & Supporter Privacy Preferences
CREATE TABLE IF NOT EXISTS fundraising_contributions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  payment_id text REFERENCES finance_payments(id),
  user_id text NOT NULL,
  contributor_name text NOT NULL,
  display_preference text NOT NULL DEFAULT 'public_name' CHECK (display_preference IN ('public_name','display_name','anonymous')),
  custom_display_name text NOT NULL DEFAULT '',
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),
  contribution_type text NOT NULL DEFAULT 'one_time' CHECK (contribution_type IN ('one_time','recurring_simulated','pledge','gift_item')),
  channel text NOT NULL DEFAULT 'mtn_momo' CHECK (channel IN ('mtn_momo','airtel_money','card_simulated')),
  status text NOT NULL CHECK (status IN ('success','pending','failed','unknown','pledged','refunded')),
  reference text NOT NULL,
  message text NOT NULL DEFAULT '',
  dedication text NOT NULL DEFAULT '',
  gift_item_id text,
  team_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, org_id, reference),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 8. Database-Backed Access Grants (Selected Contributors & Private Invitations)
CREATE TABLE IF NOT EXISTS fundraising_access_grants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL DEFAULT '',
  grant_type text NOT NULL DEFAULT 'selected_stats' CHECK (grant_type IN ('campaign_view','selected_stats','full_transparency')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_by text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, org_id, campaign_id, user_id, grant_type),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 9. Campaign Organizing Team & Role Assignments
CREATE TABLE IF NOT EXISTS fundraising_team_members (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  campaign_role text NOT NULL CHECK (campaign_role IN ('owner','co_organizer','accountant','treasurer','approver','content_manager','team_captain')),
  team_name text NOT NULL DEFAULT '',
  assigned_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, org_id, campaign_id, user_id),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 10. Campaign Milestones & Outcome Tracking
CREATE TABLE IF NOT EXISTS fundraising_milestones (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_amount bigint NOT NULL CHECK (target_amount > 0 AND target_amount <= 9007199254740991),
  allocated_amount bigint NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0 AND allocated_amount <= 9007199254740991),
  spent_amount bigint NOT NULL DEFAULT 0 CHECK (spent_amount >= 0 AND spent_amount <= 9007199254740991),
  outcome_status text NOT NULL DEFAULT 'planned' CHECK (outcome_status IN ('planned','in_progress','funded_pending_execution','completed_verified')),
  outcome_evidence text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 11. TrustFlow Expense Details (Accountant Metadata Linked to finance_expenses)
CREATE TABLE IF NOT EXISTS fundraising_expense_details (
  expense_id text PRIMARY KEY REFERENCES finance_expenses(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Program Execution',
  description text NOT NULL DEFAULT '',
  vendor_name text NOT NULL DEFAULT '',
  receipt_url text NOT NULL DEFAULT '',
  milestone_id text,
  payment_reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 12. Wedding & Birthday Gift Registry / Group Gift Goals
CREATE TABLE IF NOT EXISTS fundraising_gift_items (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_amount bigint NOT NULL CHECK (target_amount > 0 AND target_amount <= 9007199254740991),
  contributed_amount bigint NOT NULL DEFAULT 0 CHECK (contributed_amount >= 0 AND contributed_amount <= 9007199254740991),
  image_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','partially_funded','fulfilled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 13. Event RSVPs for Moments Campaigns
CREATE TABLE IF NOT EXISTS fundraising_rsvps (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  guest_name text NOT NULL,
  attendance_status text NOT NULL DEFAULT 'attending' CHECK (attendance_status IN ('attending','maybe','declined')),
  guests_count integer NOT NULL DEFAULT 1 CHECK (guests_count BETWEEN 1 AND 10),
  dietary_or_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, org_id, campaign_id, user_id),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 14. Sponsor Matching Pledges
CREATE TABLE IF NOT EXISTS fundraising_matching_pledges (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  sponsor_name text NOT NULL,
  pledged_amount bigint NOT NULL CHECK (pledged_amount > 0 AND pledged_amount <= 9007199254740991),
  confirmed_amount bigint NOT NULL DEFAULT 0 CHECK (confirmed_amount >= 0 AND confirmed_amount <= pledged_amount),
  match_ratio_bps integer NOT NULL DEFAULT 10000 CHECK (match_ratio_bps BETWEEN 1000 AND 10000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- 15. Safety, Verification & Moderation Events
CREATE TABLE IF NOT EXISTS fundraising_moderation_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  org_id text NOT NULL,
  campaign_id text NOT NULL REFERENCES finance_campaigns(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('report_submitted','verification_updated','campaign_suspended','campaign_restored','comment_moderated','privacy_warning_acknowledged')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);

-- Attach Google Sheets outbox change triggers so fundraising changes sync automatically
DO $$
DECLARE table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'queue_organization_sheet_change') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'fundraising_campaign_profiles','fundraising_campaign_updates','fundraising_contributions',
      'fundraising_milestones','fundraising_expense_details','fundraising_matching_pledges'
    ] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS organization_sheet_changed ON %I', table_name);
      EXECUTE format('CREATE TRIGGER organization_sheet_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION queue_organization_sheet_change()', table_name);
    END LOOP;
  END IF;
END;
$$;
