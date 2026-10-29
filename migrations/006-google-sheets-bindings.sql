CREATE TABLE IF NOT EXISTS organization_sheet_bindings (
 tenant_id text NOT NULL,
 org_id text NOT NULL,
 spreadsheet_id text NOT NULL UNIQUE CHECK (spreadsheet_id ~ '^[A-Za-z0-9_-]{10,200}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, org_id),
 FOREIGN KEY (tenant_id, org_id) REFERENCES finance_orgs(tenant_id, org_id)
);
