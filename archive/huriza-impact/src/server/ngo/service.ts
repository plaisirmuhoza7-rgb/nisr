import { randomUUID } from 'node:crypto';
import type { Sql } from '../db';
import { DomainError } from '../permissions';
import type {
  Actor,
  NGOActivity,
  NGOBeneficiaryCohort,
  NGOBudgetLine,
  NGODataQualityIssue,
  NGODistrictContext,
  NGODonorAccessGrant,
  NGOExpense,
  NGOFieldVisit,
  NGOGrant,
  NGOGuardianInsight,
  NGOImpactTraceChain,
  NGOIndicator,
  NGOLinkedEntityAggregate,
  NGOProfile,
  NGOProgram,
  NGOProject,
  NGOReportSnapshot,
  NGORole,
  NGOStaffMember,
  NGOState,
} from '@/lib/contracts';

const num = (v: unknown): number => Number(v ?? 0);
const sid = (tenantId: string, base: string): string =>
  tenantId === 'demo' || base.startsWith(`${tenantId}-`) ? base : `${tenantId}-${base}`;
const safeJson = <T>(raw: unknown, fallback: T): T => {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export async function hasNgoPlatform(sql: Sql): Promise<boolean> {
  const { rows } = await sql.query<{ ok: string | null }>(
    `SELECT to_regclass('public.ngo_profiles')::text AS ok`
  );
  return Boolean(rows[0]?.ok);
}

export async function seedNgoDemoData(sql: Sql, tenantId: string, orgId = 'ngo-imizi'): Promise<void> {
  if (!(await hasNgoPlatform(sql))) return;
  const existing = await sql.query<{ org_id: string }>(
    `SELECT org_id FROM ngo_profiles WHERE tenant_id = $1 AND org_id = $2`,
    [tenantId, orgId]
  );
  if (existing.rows.length > 0) return;

  await sql.query(
    `INSERT INTO ngo_profiles (
      tenant_id, org_id, name, ngo_type, designation, mission,
      focus_sectors, operating_districts, contact_email, contact_phone,
      website, registration_ref, reporting_period, approval_threshold_rwf, data_retention_months
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (tenant_id, org_id) DO NOTHING`,
    [
      tenantId,
      orgId,
      'Community Growth Initiative Rwanda (CGI Rwanda)',
      'national_ngo',
      'National Financial Inclusion, Savings Group & Cooperative Development Partner',
      'Strengthening financial resilience, transparent group governance, and sustainable rural livelihoods across Rwanda through digital ledger accompaniment and evidence-backed MEAL.',
      JSON.stringify([
        'Financial Inclusion & VSLAs',
        'Savings Groups (Itsinda & Ikimina)',
        'Cooperative Strengthening',
        'Women & Youth Livelihoods',
        'Climate-Resilient Agriculture',
      ]),
      JSON.stringify(['Gasabo', 'Kicukiro', 'Rulindo', 'Rwamagana', 'Huye']),
      'impact@cgi-rwanda.org',
      '+250 788 310 400',
      'https://cgi-rwanda.org',
      'RGB/NGO/2021/0418',
      'quarterly',
      500000,
      60,
    ]
  );

  // Staff roster
  const staffRows: Array<[string, string, string, string, string, NGORole, string, string, string]> = [
    ['ngo-staff-1', 'user-ngo', 'Dr. Clarisse Mukandori', 'clarisse@cgi-rwanda.org', '+250 788 310 401', 'country_director', 'all', 'Executive Leadership', 'Gasabo'],
    ['ngo-staff-2', 'user-ngo-pm', 'Jean-Paul Nshimiyimana', 'j.nshimiyimana@cgi-rwanda.org', '+250 788 310 402', 'program_manager', 'prog-frc-2026', 'Programs & Field Delivery', 'Rulindo'],
    ['ngo-staff-3', 'user-ngo-meal', 'Diane Uwimana', 'd.uwimana@cgi-rwanda.org', '+250 788 310 403', 'meal_officer', 'all', 'MEAL & Data Quality', 'Gasabo'],
    ['ngo-staff-4', 'user-ngo-fin', 'Eric Habimana', 'e.habimana@cgi-rwanda.org', '+250 788 310 404', 'finance_manager', 'all', 'Grants & Finance', 'Kicukiro'],
    ['ngo-staff-5', 'user-ngo-field1', 'Solange Mukamana', 's.mukamana@cgi-rwanda.org', '+250 788 310 405', 'field_officer', 'prog-frc-2026', 'Field Accompaniment', 'Rwamagana'],
    ['ngo-staff-6', 'user-ngo-safe', 'Beatrice Ingabire', 'b.ingabire@cgi-rwanda.org', '+250 788 310 406', 'safeguarding_officer', 'all', 'Safeguarding & Ethics', 'Huye'],
    ['ngo-staff-7', 'user-ngo-donor', 'Nordic & RIFT Donor Observer', 'observer@rift-donor.org', '+250 788 310 499', 'donor_viewer', 'prog-frc-2026', 'Donor Accountability', 'Gasabo'],
  ];
  for (const [id, userId, fullName, email, phone, role, progId, dept, district] of staffRows) {
    await sql.query(
      `INSERT INTO ngo_staff_members (
        id, tenant_id, org_id, user_id, full_name, email, phone, ngo_role,
        assigned_program_id, department, location_district, status, assigned_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active','user-ngo')
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, id), tenantId, orgId, userId, fullName, email, phone, role, progId === 'all' ? 'all' : sid(tenantId, progId), dept, district]
    );
  }

  // Flagship & Secondary Programs
  await sql.query(
    `INSERT INTO ngo_programs (
      id, tenant_id, org_id, code, name, description, objective, target_population,
      districts, start_date, end_date, funding_source, total_budget, lead_officer, partner_orgs, status
    ) VALUES
      ($1,$2,$3,'FRC-2026','Financial Resilience for Communities','Flagship multi-district financial inclusion program supporting 80 savings groups (Itsinda & Ikimina), 12 primary cooperatives, and 2,000 community members with digital bookkeeping, governance coaching, and resilience capital.','Increase verified group savings mobilization, transparent governance, and productive livelihood investments across 5 Rwandan districts.','80 Savings Groups, 12 Cooperatives, 2,000 Members (68% Women, 42% Youth)',$4,'2026-01-01','2026-12-31','Rwanda Inclusive Finance Trust (RIFT) & East Africa Community Resilience Fund',185000000,'Jean-Paul Nshimiyimana',$5,'active'),
      ($6,$2,$3,'WYE-2026','Women & Youth Cooperative Enterprise Accelerator','Targeted capacity-building and market-linkage program helping rural agro-processing cooperatives and youth Ikimina transition from informal savings to formal bank-linked enterprises.','Equip 12 rural cooperatives and 25 youth savings groups with Investment Guardian simulation literacy and working-capital governance.','12 Cooperatives & 650 Women/Youth Entrepreneurs',$7,'2026-02-01','2027-01-31','Green Cooperative & Rural Livelihoods Facility',58000000,'Solange Mukamana',$8,'active')
    ON CONFLICT (id) DO NOTHING`,
    [
      sid(tenantId, 'prog-frc-2026'),
      tenantId,
      orgId,
      JSON.stringify(['Gasabo', 'Kicukiro', 'Rulindo', 'Rwamagana', 'Huye']),
      JSON.stringify(['group-ubumwe', 'group-hope', 'coop-imena']),
      sid(tenantId, 'prog-wye-2026'),
      JSON.stringify(['Rulindo', 'Rwamagana', 'Huye']),
      JSON.stringify(['coop-imena', 'group-ubumwe']),
    ]
  );

  // District Projects
  const projects: Array<[string, string, string, string, string, string, string, number, number, string]> = [
    ['proj-gasabo', 'prog-frc-2026', 'FRC-GAS-01', 'Gasabo Itsinda Digital Governance Hub', 'Gasabo', 'Kimironko & Remera', 'Gasabo Community Resource Center', 42000000, 24500000, 'Jean-Paul Nshimiyimana'],
    ['proj-kicukiro', 'prog-frc-2026', 'FRC-KIC-02', 'Kicukiro Rotating Ikimina Resilience Cluster', 'Kicukiro', 'Niboye & Gahanga', 'Kicukiro Youth Innovation Site', 34000000, 18200000, 'Solange Mukamana'],
    ['proj-rulindo', 'prog-frc-2026', 'FRC-RUL-03', 'Rulindo Highland Savings & Agro-Coop Link', 'Rulindo', 'Base & Bushoki', 'Rulindo Farmer Field School', 45000000, 26800000, 'Jean-Paul Nshimiyimana'],
    ['proj-rwamagana', 'prog-frc-2026', 'FRC-RWA-04', 'Rwamagana Cooperative Value Engine Accompaniment', 'Rwamagana', 'Kigabiro & Muhazi', 'Rwamagana Cooperative Union Hub', 36000000, 19400000, 'Solange Mukamana'],
    ['proj-huye', 'prog-frc-2026', 'FRC-HUY-05', 'Huye Women VSL & Micro-Enterprise Graduation', 'Huye', 'Ngoma & Tumba', 'Huye Southern Inclusion Center', 28000000, 14100000, 'Beatrice Ingabire'],
  ];
  for (const [id, progId, code, name, district, sector, site, alloc, spent, officer] of projects) {
    await sql.query(
      `INSERT INTO ngo_projects (
        id, tenant_id, org_id, program_id, code, name, district, sector, site_name,
        budget_allocated, budget_spent, lead_officer, status, start_date, end_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active','2026-01-15','2026-12-31')
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, id), tenantId, orgId, sid(tenantId, progId), code, name, district, sector, site, alloc, spent, officer]
    );
  }

  // Multi-donor Grants
  await sql.query(
    `INSERT INTO ngo_grants (
      id, tenant_id, org_id, program_id, donor_name, grant_code, title, currency,
      original_amount, exchange_rate_rwf, award_amount_rwf, received_amount_rwf, approved_budget_rwf,
      restricted_categories, start_date, end_date, next_report_due, reporting_schedule, conditions_note, status
    ) VALUES
      ($6,$1,$2,$7,'Rwanda Inclusive Finance Trust (RIFT)','RIFT-RW-2026-08','Scaling Digital Savings Groups & Transparent Governance','USD',100000,1350,135000000,108000000,135000000,$3,'2026-01-01','2026-12-31','2026-07-15','Quarterly Financial & Verified MEAL ImpactTrace Package','Restricted to savings group capacity building, field officer accompaniment, and verified MEAL surveys. Max 12% personnel/admin overhead.','active'),
      ($8,$1,$2,$7,'East Africa Community Resilience Fund','EACRF-2026-114','Rural Household Resilience & Emergency Liquidity Buffer','RWF',50000000,1,50000000,50000000,50000000,$4,'2026-01-15','2026-12-31','2026-06-30','Semi-Annual Donor Accountability & RGB Compliance Report','Must prioritize women-led Itsinda and youth rotating Ikimina in Rulindo, Rwamagana, and Huye.','active'),
      ($9,$1,$2,$10,'Green Cooperative & Rural Livelihoods Facility','GCRL-EU-2026-04','Cooperative Member Value Engine & Post-Harvest Readiness','EUR',40000,1450,58000000,43500000,58000000,$5,'2026-02-01','2027-01-31','2026-08-01','Quarterly Cooperative Governance & Surplus Audit','Restricted to cooperative governance coaching, quality grading kits, and digital member ledger adoption.','active')
    ON CONFLICT (id) DO NOTHING`,
    [
      tenantId,
      orgId,
      JSON.stringify(['savings_group_capacity', 'field_operations', 'monitoring_evaluation', 'digital_inclusion']),
      JSON.stringify(['savings_group_capacity', 'training_materials', 'safeguarding']),
      JSON.stringify(['cooperative_support', 'digital_inclusion', 'monitoring_evaluation']),
      sid(tenantId, 'grant-rift-2026'),
      sid(tenantId, 'prog-frc-2026'),
      sid(tenantId, 'grant-eacrf-2026'),
      sid(tenantId, 'grant-gcrl-2026'),
      sid(tenantId, 'prog-wye-2026'),
    ]
  );

  // Restricted Budget Lines
  const budgetLines: Array<[string, string, string, string, string, string, number, number, number]> = [
    ['bl-101', 'prog-frc-2026', 'grant-rift-2026', 'savings_group_capacity', 'BL-101', 'Itsinda & Ikimina Leadership, Treasurer & Accountant Governance Training', 48000000, 32000000, 26500000],
    ['bl-102', 'prog-frc-2026', 'grant-rift-2026', 'field_operations', 'BL-102', 'District Field Officer Accompaniment & Mobile Monitoring Visits (5 Districts)', 42000000, 28500000, 24200000],
    ['bl-103', 'prog-frc-2026', 'grant-rift-2026', 'monitoring_evaluation', 'BL-103', 'MEAL Baseline/Endline Verification, Data Quality Audits & ImpactTrace', 25000000, 16000000, 14000000],
    ['bl-104', 'prog-frc-2026', 'grant-rift-2026', 'digital_inclusion', 'BL-104', 'HURIZA Digital Ledger Onboarding & USSD/MoMo Literacy Clinics', 20000000, 14500000, 12800000],
    ['bl-201', 'prog-frc-2026', 'grant-eacrf-2026', 'training_materials', 'BL-201', 'Financial Literacy Toolkits, Passbooks & Group Constitutional Templates', 32000000, 21000000, 18500000],
    ['bl-202', 'prog-frc-2026', 'grant-eacrf-2026', 'safeguarding', 'BL-202', 'Participant Safeguarding Clinics, Informed Consent & Grievance Desk', 18000000, 9500000, 7000000],
    ['bl-301', 'prog-wye-2026', 'grant-gcrl-2026', 'cooperative_support', 'BL-301', 'Cooperative Share Register, Surplus Allocation & Investment Guardian Coaching', 58000000, 31000000, 25000000],
  ];
  for (const [id, progId, grantId, cat, code, desc, alloc, comm, spent] of budgetLines) {
    await sql.query(
      `INSERT INTO ngo_budget_lines (
        id, tenant_id, org_id, program_id, grant_id, category, line_code, description,
        allocated_amount, committed_amount, spent_amount
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, id), tenantId, orgId, sid(tenantId, progId), sid(tenantId, grantId), cat, code, desc, alloc, comm, spent]
    );
  }

  // Implemented & Planned Activities (linked to group-ubumwe, group-hope, coop-imena, camp-water)
  const activities: Array<[string, string, string, string, string, string, string, string, string, string, string, string, number, number, string, string, string, string, string, string]> = [
    [
      'act-101', 'prog-frc-2026', 'proj-gasabo', 'grant-rift-2026', 'bl-101',
      'Itsinda Treasurer & Accountant Dual-Approval Governance Bootcamp', 'group_training',
      'Gasabo', 'Kimironko', '2026-02-18', '2026-02-20', 'Jean-Paul Nshimiyimana',
      45, 48, 'savings_group', 'group-ubumwe',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/evidence/ubumwe-governance-training.pdf',
      'Verified attendance register of 16 Itsinda committees (48 leaders) including Ubumwe Twitezimbere Itsinda; pre/post ledger test scores improved from 54% to 91%.',
      'completed', 'approved',
    ],
    [
      'act-102', 'prog-frc-2026', 'proj-kicukiro', 'grant-rift-2026', 'bl-104',
      'Rotating Ikimina Cycle & Payout Transparency Onboarding', 'digital_ledger_onboarding',
      'Kicukiro', 'Niboye', '2026-03-05', '2026-03-06', 'Solange Mukamana',
      60, 64, 'savings_group', 'group-hope',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/evidence/hope-ikimina-onboarding.pdf',
      'Onboarded Hope Entrepreneurs Ikimina and 14 neighboring rotating groups onto automated round scheduling and arrears tracking.',
      'completed', 'approved',
    ],
    [
      'act-103', 'prog-wye-2026', 'proj-rwamagana', 'grant-gcrl-2026', 'bl-301',
      'Cooperative Share Capital & Investment Guardian Advisory Clinic', 'cooperative_advisory',
      'Rwamagana', 'Kigabiro', '2026-03-22', '2026-03-24', 'Solange Mukamana',
      35, 38, 'cooperative', 'coop-imena',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/evidence/imena-coop-clinic.pdf',
      'Imena Coffee & Maize Cooperative board and supervisory committee completed share-register reconciliation and 10% statutory reserve policy adoption.',
      'completed', 'approved',
    ],
    [
      'act-104', 'prog-frc-2026', 'proj-rulindo', 'grant-eacrf-2026', 'bl-201',
      'Rulindo Rural Women Savings & Household Resilience Coaching', 'field_monitoring',
      'Rulindo', 'Bushoki', '2026-04-10', '2026-04-12', 'Jean-Paul Nshimiyimana',
      120, 115, 'savings_group', 'group-ubumwe',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/evidence/rulindo-field-monitoring.pdf',
      '22 rural savings groups audited; 19/22 met minimum 20% emergency reserve ratio.',
      'completed', 'meal_reviewed',
    ],
    [
      'act-105', 'prog-frc-2026', 'proj-huye', 'grant-eacrf-2026', 'bl-202',
      'Huye Participant Safeguarding, Consent & Community Water Co-Financing Clinic', 'safeguarding_clinic',
      'Huye', 'Ngoma', '2026-05-02', '', 'Beatrice Ingabire',
      90, 82, 'fund_campaign', 'camp-water',
      '',
      'Field session conducted; awaiting signed community safeguarding checklist upload from Huye field office.',
      'in_progress', 'submitted',
    ],
  ];
  for (const a of activities) {
    await sql.query(
      `INSERT INTO ngo_activities (
        id, tenant_id, org_id, program_id, project_id, grant_id, budget_line_id,
        title, activity_type, district, sector, scheduled_date, completed_date,
        lead_officer, target_participants, actual_participants, linked_entity_type,
        linked_entity_id, evidence_url, evidence_note, status, verification_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, a[0]), tenantId, orgId, sid(tenantId, a[1]), sid(tenantId, a[2]), sid(tenantId, a[3]), sid(tenantId, a[4]), a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15], a[16], a[17], a[18], a[19]]
    );
  }

  // 4-step NGO Expenses (paid, finance_approved, program_reviewed, proposed)
  const expenses: Array<[string, string, string, string, string, string, string, string, string, number, string, string, string, string, string, string, string]> = [
    [
      'ngo-exp-101', 'prog-frc-2026', 'proj-gasabo', 'grant-rift-2026', 'bl-101', 'act-101',
      'Gasabo & Rulindo Itsinda Governance Training Venues, Manuals & Certified Facilitators',
      'savings_group_capacity', 'Kigali Cooperative Training Institute', 14500000,
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/receipts/kcti-invoice-101.pdf',
      'Training of 48 savings group presidents, treasurers, and accountants on dual-control bookkeeping.',
      'paid', 'Jean-Paul Nshimiyimana', 'Diane Uwimana', 'Dr. Clarisse Mukandori', 'MOMO-NGO-DISB-8821',
    ],
    [
      'ngo-exp-102', 'prog-frc-2026', 'proj-kicukiro', 'grant-rift-2026', 'bl-104', 'act-102',
      'Kicukiro & Rwamagana Digital Ledger Onboarding Clinics & Field Tablets',
      'digital_inclusion', 'Rwanda Tech Inclusion Supply Ltd', 12800000,
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/receipts/rtis-invoice-102.pdf',
      'Field data collection tablets and USSD simulation cards for 15 rotating Ikimina clusters.',
      'paid', 'Solange Mukamana', 'Jean-Paul Nshimiyimana', 'Eric Habimana', 'MOMO-NGO-DISB-8849',
    ],
    [
      'ngo-exp-103', 'prog-wye-2026', 'proj-rwamagana', 'grant-gcrl-2026', 'bl-301', 'act-103',
      'Cooperative Value Engine Workshop & Moisture/Grading Equipment Co-Investment',
      'cooperative_support', 'AgriScale East Africa Ltd', 15200000,
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/receipts/agriscale-103.pdf',
      'Advisory clinic and quality grading kit supporting Imena Cooperative and 11 partner cooperatives.',
      'paid', 'Solange Mukamana', 'Jean-Paul Nshimiyimana', 'Dr. Clarisse Mukandori', 'BNR-NGO-EFT-4402',
    ],
    [
      'ngo-exp-104', 'prog-frc-2026', 'proj-rulindo', 'grant-eacrf-2026', 'bl-201', 'act-104',
      'Rulindo & Huye Kinyarwanda Financial Literacy Passbooks (1,200 Copies)',
      'training_materials', 'Imprimerie Nouvelle Kigali', 4800000,
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/receipts/ink-quote-104.pdf',
      'Approved by finance manager; awaiting final MoMo/bank disbursement confirmation.',
      'finance_approved', 'Jean-Paul Nshimiyimana', 'Jean-Paul Nshimiyimana', 'Eric Habimana', '',
    ],
    [
      'ngo-exp-105', 'prog-frc-2026', 'proj-huye', 'grant-eacrf-2026', 'bl-202', 'act-105',
      'Huye Safeguarding & Grievance Redress Community Dialogues',
      'safeguarding', 'Southern Community Facilitators Network', 2500000,
      '',
      'Proposed field expense for Huye sector clinics; requires program manager review and receipt upload.',
      'proposed', 'Beatrice Ingabire', '', '', '',
    ],
  ];
  for (const e of expenses) {
    await sql.query(
      `INSERT INTO ngo_expenses (
        id, tenant_id, org_id, program_id, project_id, grant_id, budget_line_id, activity_id,
        title, category, vendor_name, amount, currency, receipt_url, description,
        status, requested_by, reviewed_by, approved_by, payment_reference
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'RWF',$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, e[0]), tenantId, orgId, sid(tenantId, e[1]), sid(tenantId, e[2]), sid(tenantId, e[3]), sid(tenantId, e[4]), sid(tenantId, e[5]), e[6], e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15], e[16]]
    );
  }

  // Beneficiary Cohorts (80 supported savings groups, 12 cooperatives, 2,000 members across 5 districts)
  const cohorts: Array<[string, string, string, string, string, string, string, string, number, number, number, number, string, string, string, string]> = [
    [
      'coh-gasabo-itsinda', 'prog-frc-2026', 'COH-GAS-01',
      'Gasabo Ubumwe Itsinda Network (18 Groups)', 'savings_group_itsinda',
      'Gasabo', 'Kimironko', 'group-ubumwe',
      450, 460, 318, 190, 'active', 'standard', 'Solange Mukamana',
      'Anchored by Ubumwe Twitezimbere Itsinda (group-ubumwe); 18 accumulating savings & lending groups using digital dual-control expense approval.',
    ],
    [
      'coh-kicukiro-ikimina', 'prog-frc-2026', 'COH-KIC-02',
      'Kicukiro Hope Rotating Ikimina Cluster (16 Groups)', 'savings_group_ikimina',
      'Kicukiro', 'Niboye', 'group-hope',
      380, 410, 265, 225, 'active', 'standard', 'Solange Mukamana',
      'Anchored by Hope Entrepreneurs Ikimina (group-hope); 16 fixed-round rotating ROSCAs with automated payout verification.',
    ],
    [
      'coh-rulindo-rural', 'prog-frc-2026', 'COH-RUL-03',
      'Rulindo Highland Women & Youth VSL Cluster (20 Groups)', 'savings_group_itsinda',
      'Rulindo', 'Bushoki', 'group-ubumwe',
      490, 510, 372, 210, 'active', 'standard', 'Jean-Paul Nshimiyimana',
      '20 rural agricultural savings groups pairing seasonal crop savings with emergency health & school-fee liquidity.',
    ],
    [
      'coh-rwamagana-itsinda', 'prog-frc-2026', 'COH-RWA-04',
      'Rwamagana Eastern Plains Savings Federation (14 Groups)', 'savings_group_itsinda',
      'Rwamagana', 'Kigabiro', 'group-hope',
      310, 320, 214, 135, 'active', 'standard', 'Solange Mukamana',
      '14 peri-urban and rural savings groups linked to local agro-dealers and mobile money agents.',
    ],
    [
      'coh-huye-youth', 'prog-frc-2026', 'COH-HUY-05',
      'Huye Southern Women & Youth Graduation Groups (12 Groups)', 'savings_group_itsinda',
      'Huye', 'Ngoma', 'group-ubumwe',
      290, 300, 218, 168, 'active', 'protected_youth', 'Beatrice Ingabire',
      '12 vulnerable youth and female-headed household savings groups under enhanced safeguarding privacy.',
    ],
    [
      'coh-coop-network', 'prog-wye-2026', 'COH-COOP-06',
      'Imena & Partner Primary Cooperatives Network (12 Cooperatives)', 'cooperative',
      'Rwamagana', 'Kigabiro', 'coop-imena',
      340, 360, 220, 140, 'active', 'standard', 'Jean-Paul Nshimiyimana',
      '12 primary agricultural & service cooperatives anchored by Imena Cooperative (coop-imena), tracking share capital and surplus governance.',
    ],
  ];
  for (const c of cohorts) {
    await sql.query(
      `INSERT INTO ngo_beneficiary_cohorts (
        id, tenant_id, org_id, program_id, cohort_code, name, cohort_type,
        district, sector, linked_org_id, households_count, participants_count,
        female_count, youth_count, enrollment_stage, safeguarding_level,
        consent_basis, assigned_officer, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'informed_program_consent',$17,$18)
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, c[0]), tenantId, orgId, sid(tenantId, c[1]), c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11], c[12], c[13], c[14], c[15]]
    );
  }

  // Mobile-First Field Visits & Structured Surveys
  const visits: Array<[string, string, string, string, string, string, string, string, string, string, string, number, string, string, string, string, string, string]> = [
    [
      'fv-101', 'prog-frc-2026', 'act-101', 'user-ngo-pm', 'Jean-Paul Nshimiyimana',
      '2026-02-20', 'Gasabo', 'Kimironko', 'Kimironko Sector Center',
      'Post-training ledger verification of Ubumwe Twitezimbere Itsinda',
      'savings_group_monitoring', 32,
      'Cash box retired in favor of verified MoMo group treasury; President, Treasurer, and Accountant roles active in HURIZA.',
      '100% reconciliation between member passbooks and HURIZA digital ledger; reserve ratio at 22%.',
      'Follow up on Q2 emergency loan repayment schedule.',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/field/fv-101-ubumwe.jpg',
      'verified', 'approved',
    ],
    [
      'fv-102', 'prog-frc-2026', 'act-102', 'user-ngo-field1', 'Solange Mukamana',
      '2026-03-06', 'Kicukiro', 'Niboye', 'Niboye Parish Hall',
      'Rotating round payout observation for Hope Entrepreneurs Ikimina',
      'savings_group_monitoring', 28,
      'Observed Round 2 pot collection and automated recipient payout verification; zero disputes recorded.',
      'All 16 rotating groups in Kicukiro cluster adopted transparent late-penalty rules.',
      'None required; next visit scheduled for Round 4.',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/field/fv-102-hope.jpg',
      'verified', 'approved',
    ],
    [
      'fv-103', 'prog-wye-2026', 'act-103', 'user-ngo-field1', 'Solange Mukamana',
      '2026-03-24', 'Rwamagana', 'Kigabiro', 'Imena Cooperative Collection Yard',
      'Cooperative governance & Member Value Engine audit',
      'cooperative_support_visit', 38,
      'Reviewed member produce delivery receipts, share capital installments, and Investment Guardian simulation for maize dryer.',
      'Statutory reserve locked at 10% prior to surplus distribution calculation.',
      'Assist board secretary with Q2 General Assembly resolution upload.',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/field/fv-103-imena.jpg',
      'verified', 'approved',
    ],
    [
      'fv-104', 'prog-frc-2026', 'act-104', 'user-ngo-pm', 'Jean-Paul Nshimiyimana',
      '2026-04-12', 'Rulindo', 'Bushoki', 'Bushoki Terraces Community Hall',
      'Quarterly rural savings mobilization & attendance audit',
      'training_attendance', 54,
      '19 of 22 highland groups submitted monthly financial reports on time; 3 remote groups experienced mobile network delay.',
      'Aggregate rural group savings increased by 18% over baseline.',
      'Provide offline sync coaching to 3 Bushoki group secretaries.',
      'https://res.cloudinary.com/a0bcyupp/image/upload/v1/huriza/field/fv-104-rulindo.jpg',
      'synced', 'meal_reviewed',
    ],
    [
      'fv-105', 'prog-frc-2026', 'act-105', 'user-ngo-safe', 'Beatrice Ingabire',
      '2026-05-03', 'Huye', 'Ngoma', 'Tumba Youth Center',
      'Youth beneficiary safeguarding & enrollment follow-up',
      'follow_up_assessment', 41,
      'Captured offline during field visit in Tumba; verified youth consent records and anonymized household vulnerability scores.',
      '41 youth participants confirmed active in weekly savings.',
      'Upload signed safeguarding attendance sheet upon returning to Huye office.',
      '',
      'queued_offline', 'submitted',
    ],
  ];
  for (const v of visits) {
    await sql.query(
      `INSERT INTO ngo_field_visits (
        id, tenant_id, org_id, program_id, activity_id, officer_id, officer_name,
        visit_date, district, sector, community_name, purpose, form_type,
        attendees_count, observations, outcomes_recorded, follow_up_needed,
        evidence_attachment, sync_status, verification_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, v[0]), tenantId, orgId, sid(tenantId, v[1]), sid(tenantId, v[2]), v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12], v[13], v[14], v[15], v[16], v[17]]
    );
  }

  // MEAL Indicators across Results Chain (Input -> Activity -> Output -> Outcome -> Impact Context)
  const indicators: Array<[string, string, string, string, string, string, number, number, number, string, string, string, Record<string, number>, string, string, string]> = [
    [
      'ind-101', 'prog-frc-2026', 'IND-OUT-01',
      'Active Savings Groups (Itsinda & Ikimina) Maintaining Verified Digital Ledgers',
      'output', 'groups', 18, 80, 74,
      'Groups with verified monthly ledger reconciliation', 'Total enrolled program savings groups (80)',
      'HURIZA Group Aggregate Telemetry & Field Visit Audits',
      { Gasabo: 18, Kicukiro: 15, Rulindo: 18, Rwamagana: 13, Huye: 10 },
      'Diane Uwimana', 'approved',
      'Observed monitoring indicator: counts enrolled groups with complete monthly journal entries and zero unresolved audit flags.',
    ],
    [
      'ind-102', 'prog-frc-2026', 'IND-OUT-02',
      'Community Members Actively Saving in Program-Supported Groups',
      'output', 'count', 420, 2000, 2000,
      'Enrolled active savers across 5 districts', 'Target program participant cohort (2,000)',
      'Cohort Enrollment Registry & Anonymized Group Headcounts',
      { Female: 1387, Male: 613, Youth_Under_30: 928 },
      'Diane Uwimana', 'approved',
      'Aggregated from authorized group membership counts without exposing individual member balances.',
    ],
    [
      'ind-103', 'prog-frc-2026', 'IND-OCM-01',
      'Percentage of Supported Savings Groups Meeting Minimum Liquidity Reserve Policy (>=15%)',
      'outcome', 'percentage', 45, 90, 88,
      'Groups meeting reserve threshold (70)', 'Total active savings groups monitored (80)',
      'HURIZA Guardian Reserve Ratio Engine',
      { Itsinda_Groups: 91, Ikimina_Groups: 84 },
      'Diane Uwimana', 'approved',
      'Observed institutional health outcome; does not claim causal household poverty reduction without endline control comparison.',
    ],
    [
      'ind-104', 'prog-frc-2026', 'IND-OCM-02',
      'On-Time Group Loan Repayment & Cycle Obligation Completion Rate',
      'outcome', 'percentage', 78, 95, 93,
      'Confirmed on-time repayments & rotation contributions', 'Total scheduled obligations due in period',
      'Savings Group Aggregate Repayment Telemetry',
      { Gasabo: 96, Kicukiro: 94, Rulindo: 91, Rwamagana: 93, Huye: 90 },
      'Diane Uwimana', 'meal_reviewed',
      'Measured across participating Itsinda emergency loans and Ikimina rotation rounds.',
    ],
    [
      'ind-105', 'prog-wye-2026', 'IND-COOP-01',
      'Supported Cooperatives Operating Verified Share Registers & Statutory Reserves',
      'outcome', 'cooperatives', 2, 12, 11,
      'Cooperatives with reconciled share capital & 10% reserve', 'Total supported primary cooperatives (12)',
      'HURIZA Cooperative Governance & Member Value Engine',
      { Rwamagana: 5, Rulindo: 4, Huye: 2 },
      'Solange Mukamana', 'approved',
      'Anchored by Imena Cooperative (coop-imena) live governance telemetry.',
    ],
    [
      'ind-106', 'prog-frc-2026', 'IND-ACT-01',
      'Group Leaders & Treasurers Certified in Financial Governance & Safeguarding',
      'activity', 'count', 0, 240, 212,
      'Leaders completing 3-day governance curriculum', 'Target 3 leaders per group across 80 groups (240)',
      'Training Attendance Registers (act-101, act-102, act-105)',
      { Female_Leaders: 148, Male_Leaders: 64 },
      'Jean-Paul Nshimiyimana', 'submitted',
      'Pending final Huye safeguarding attendance verification (act-105).',
    ],
  ];
  for (const ind of indicators) {
    await sql.query(
      `INSERT INTO ngo_indicators (
        id, tenant_id, org_id, program_id, code, name, level, unit,
        baseline_value, target_value, current_value, numerator_label, denominator_label,
        data_source, disaggregation, reporting_period, responsible_officer,
        verification_status, methodology_note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'2026-Q2',$16,$17,$18)
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, ind[0]), tenantId, orgId, sid(tenantId, ind[1]), ind[2], ind[3], ind[4], ind[5], ind[6], ind[7], ind[8], ind[9], ind[10], ind[11], JSON.stringify(ind[12]), ind[13], ind[14], ind[15]]
    );
  }

  // Data Quality & Verification Queue Issues
  const dqIssues: Array<[string, string, string, string, string, string, string, string]> = [
    [
      'dq-101', 'prog-frc-2026', 'missing_evidence', 'warning', 'act-105 / ngo-exp-105',
      'Activity act-105 (Huye Safeguarding Clinic) and proposed expense ngo-exp-105 (2,500,000 RWF) do not yet have a signed attendance sheet or vendor receipt attached.',
      'Awaiting Beatrice Ingabire offline field sync from Tumba sector.', 'open',
    ],
    [
      'dq-102', 'prog-frc-2026', 'overdue_group_report', 'info', 'coh-rulindo-rural',
      '3 of 20 highland savings groups in Rulindo (Bushoki sector) are 5 days past the monthly aggregate reporting cutoff due to connectivity delay.',
      'Field officer scheduled offline tablet sync during next market day.', 'in_review',
    ],
    [
      'dq-103', 'prog-frc-2026', 'unverified_indicator', 'warning', 'ind-106',
      'Indicator IND-ACT-01 (212 certified leaders) includes 32 Huye participants whose field visit (fv-105) is still in queued_offline status.',
      'Sync fv-105 and complete MEAL officer review before locking Q2 donor report.', 'open',
    ],
  ];
  for (const dq of dqIssues) {
    await sql.query(
      `INSERT INTO ngo_data_quality_issues (
        id, tenant_id, org_id, program_id, issue_type, severity, record_ref,
        description, resolution_note, status, detected_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'HURIZA Data Quality Guardian')
      ON CONFLICT (id) DO NOTHING`,
      [sid(tenantId, dq[0]), tenantId, orgId, sid(tenantId, dq[1]), dq[2], dq[3], dq[4], dq[5], dq[6], dq[7]]
    );
  }

  // Donor & RGB Report Snapshots
  const sampleIndicatorsSnapshot = JSON.stringify([
    { code: 'IND-OUT-01', name: 'Active Savings Groups with Verified Ledgers', baseline: 18, target: 80, actual: 74, unit: 'groups', verified: true },
    { code: 'IND-OUT-02', name: 'Enrolled Community Members Saving Actively', baseline: 420, target: 2000, actual: 2000, unit: 'count', verified: true },
    { code: 'IND-OCM-01', name: 'Groups Meeting >=15% Reserve Policy', baseline: 45, target: 90, actual: 88, unit: 'percentage', verified: true },
    { code: 'IND-COOP-01', name: 'Supported Cooperatives with Verified Share Register', baseline: 2, target: 12, actual: 11, unit: 'cooperatives', verified: true },
  ]);
  const sampleBudgetSnapshot = JSON.stringify({
    allocatedRwf: 185000000,
    committedRwf: 121500000,
    spentRwf: 103000000,
    utilizationPercent: 56,
  });

  await sql.query(
    `INSERT INTO ngo_report_snapshots (
      id, tenant_id, org_id, program_id, grant_id, title, report_type, reporting_period,
      executive_summary, activities_summary, indicators_snapshot, budget_summary,
      risks_and_limitations, status, prepared_by, approved_by
    ) VALUES
      ($5,$1,$2,$6,$7,'RIFT Q1-Q2 2026 Verified Institutional Accountability & ImpactTrace Report','donor_quarterly','2026-Q1/Q2','Across Gasabo, Kicukiro, Rulindo, Rwamagana, and Huye, CGI Rwanda accompanied 80 savings groups (2,000 members; 69% women) and 12 cooperatives. 92.5% of groups maintain verified digital ledgers and 88% meet the 15% liquidity reserve threshold.','Completed Itsinda dual-approval governance bootcamps (act-101), Kicukiro rotating Ikimina onboarding (act-102), and Rwamagana cooperative Value Engine clinics (act-103).',$3,$4,'Observed monitoring indicators reflect verified group aggregates in HURIZA. They represent operational progress and financial discipline, not causal randomized impact claims.','approved','Diane Uwimana','Dr. Clarisse Mukandori'),
      ($8,$1,$2,$6,NULL,'Rwanda Governance Board (RGB) & District JADF Semi-Annual Compliance Pack','rgb_compliance','2026-H1','Alignment of Financial Resilience for Communities (FRC-2026) with District Development Strategies (DDS) and National Strategy for Transformation (NST2) financial inclusion pillars across 5 districts.','5 district projects active; 80 community groups and 12 primary cooperatives accompanied with zero safeguarding breaches.',$3,$4,'3 highland groups in Rulindo experienced minor offline sync delays; field accompaniment scheduled.','reviewed','Jean-Paul Nshimiyimana','')
    ON CONFLICT (id) DO NOTHING`,
    [tenantId, orgId, sampleIndicatorsSnapshot, sampleBudgetSnapshot, sid(tenantId, 'rep-2026-q1'), sid(tenantId, 'prog-frc-2026'), sid(tenantId, 'grant-rift-2026'), sid(tenantId, 'rep-rgb-2026')]
  );

  // Donor Access Grants
  await sql.query(
    `INSERT INTO ngo_donor_access_grants (
      id, tenant_id, org_id, program_id, grant_id, donor_name, donor_email,
      access_code, permissions_scope, status, expires_at, granted_by
    ) VALUES
      ($3,$1,$2,$4,$5,'Rwanda Inclusive Finance Trust (RIFT)','portfolio@rift-donor.org','RIFT-TRACE-2026','full_grant_financials','active','2026-12-31','Dr. Clarisse Mukandori'),
      ($6,$1,$2,$4,$7,'East Africa Community Resilience Fund','meal@eacrf.org','EACRF-VIEW-2026','aggregates_and_reports','active','2026-12-31','Dr. Clarisse Mukandori')
    ON CONFLICT (id) DO NOTHING`,
    [tenantId, orgId, sid(tenantId, 'dag-rift-1'), sid(tenantId, 'prog-frc-2026'), sid(tenantId, 'grant-rift-2026'), sid(tenantId, 'dag-eacrf-2'), sid(tenantId, 'grant-eacrf-2026')]
  );
}

function computePermissions(role: NGORole) {
  const isExec = role === 'country_director' || role === 'program_director' || role === 'super_admin';
  const isProg = isExec || role === 'program_manager' || role === 'project_officer';
  const isFin = isExec || role === 'finance_manager' || role === 'accountant' || role === 'grants_officer';
  const isMeal = isExec || role === 'meal_officer' || role === 'program_manager';
  const isField = isProg || role === 'field_officer' || role === 'meal_officer' || role === 'safeguarding_officer';
  const isReadOnly = role === 'donor_viewer' || role === 'auditor' || role === 'partner_user';

  return {
    canManageOrganization: isExec,
    canManageStaff: isExec || role === 'program_manager',
    canManagePrograms: isProg,
    canManageGrantsAndBudget: isFin,
    canApproveExpenses: isExec || role === 'finance_manager' || role === 'program_manager',
    canConfirmPayments: isExec || role === 'finance_manager' || role === 'accountant',
    canSubmitFieldData: isField,
    canVerifyMeal: isMeal,
    canGenerateReports: isExec || isMeal || isFin,
    canManageDonorAccess: isExec || role === 'grants_officer',
    isReadOnlyDonorOrAuditor: isReadOnly,
  };
}

export async function buildNgoState(sql: Sql, actor: Actor, orgId = 'ngo-imizi'): Promise<NGOState | undefined> {
  if (!(await hasNgoPlatform(sql))) return undefined;
  await seedNgoDemoData(sql, actor.tenantId, orgId);

  const profileRes = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ngo_profiles WHERE tenant_id = $1 AND org_id = $2`,
    [actor.tenantId, orgId]
  );
  if (profileRes.rows.length === 0) return undefined;
  const p = profileRes.rows[0];

  const profile: NGOProfile = {
    tenantId: String(p.tenant_id),
    orgId: String(p.org_id),
    name: String(p.name),
    ngoType: String(p.ngo_type),
    designation: String(p.designation),
    mission: String(p.mission),
    focusSectors: safeJson<string[]>(p.focus_sectors, []),
    operatingDistricts: safeJson<string[]>(p.operating_districts, []),
    contactEmail: String(p.contact_email),
    contactPhone: String(p.contact_phone),
    website: String(p.website),
    registrationRef: String(p.registration_ref),
    reportingPeriod: String(p.reporting_period) as NGOProfile['reportingPeriod'],
    approvalThresholdRwf: num(p.approval_threshold_rwf),
    dataRetentionMonths: num(p.data_retention_months),
    createdAt: String(p.created_at),
  };

  const staffRows = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_staff_members WHERE tenant_id = $1 AND org_id = $2 ORDER BY created_at ASC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows;

  const staff: NGOStaffMember[] = staffRows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    fullName: String(r.full_name),
    email: String(r.email),
    phone: String(r.phone),
    ngoRole: String(r.ngo_role) as NGORole,
    assignedProgramId: String(r.assigned_program_id),
    department: String(r.department),
    locationDistrict: String(r.location_district),
    status: String(r.status) as NGOStaffMember['status'],
    assignedBy: String(r.assigned_by),
    createdAt: String(r.created_at),
  }));

  const matchedStaff = staff.find((s) => s.userId === actor.userId && s.status === 'active');
  const viewerRole: NGORole = matchedStaff
    ? matchedStaff.ngoRole
    : actor.role === 'ngo'
      ? 'country_director'
      : 'partner_user';
  const viewerPermissions = computePermissions(viewerRole);

  const programs: NGOProgram[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_programs WHERE tenant_id = $1 AND org_id = $2 ORDER BY id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    description: String(r.description),
    objective: String(r.objective),
    targetPopulation: String(r.target_population),
    districts: safeJson<string[]>(r.districts, []),
    startDate: String(r.start_date),
    endDate: String(r.end_date),
    fundingSource: String(r.funding_source),
    totalBudget: num(r.total_budget),
    leadOfficer: String(r.lead_officer),
    partnerOrgs: safeJson<string[]>(r.partner_orgs, []),
    status: String(r.status) as NGOProgram['status'],
    createdAt: String(r.created_at),
  }));

  const projects: NGOProject[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_projects WHERE tenant_id = $1 AND org_id = $2 ORDER BY id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    code: String(r.code),
    name: String(r.name),
    district: String(r.district),
    sector: String(r.sector),
    siteName: String(r.site_name),
    budgetAllocated: num(r.budget_allocated),
    budgetSpent: num(r.budget_spent),
    leadOfficer: String(r.lead_officer),
    status: String(r.status) as NGOProject['status'],
    startDate: String(r.start_date),
    endDate: String(r.end_date),
    createdAt: String(r.created_at),
  }));

  const expenses: NGOExpense[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_expenses WHERE tenant_id = $1 AND org_id = $2 ORDER BY created_at DESC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    projectId: r.project_id ? String(r.project_id) : null,
    grantId: String(r.grant_id),
    budgetLineId: String(r.budget_line_id),
    activityId: r.activity_id ? String(r.activity_id) : null,
    title: String(r.title),
    category: String(r.category),
    vendorName: String(r.vendor_name),
    amount: num(r.amount),
    currency: String(r.currency),
    receiptUrl: String(r.receipt_url),
    description: String(r.description),
    status: String(r.status) as NGOExpense['status'],
    requestedBy: String(r.requested_by),
    reviewedBy: String(r.reviewed_by),
    approvedBy: String(r.approved_by),
    paymentReference: String(r.payment_reference),
    createdAt: String(r.created_at),
  }));

  const budgetLines: NGOBudgetLine[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_budget_lines WHERE tenant_id = $1 AND org_id = $2 ORDER BY line_code ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => {
    const allocated = num(r.allocated_amount);
    const committed = num(r.committed_amount);
    const spent = num(r.spent_amount);
    return {
      id: String(r.id),
      programId: String(r.program_id),
      grantId: String(r.grant_id),
      category: String(r.category),
      lineCode: String(r.line_code),
      description: String(r.description),
      allocatedAmount: allocated,
      committedAmount: committed,
      spentAmount: spent,
      remainingAmount: Math.max(0, allocated - spent),
      utilizationPercent: allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0,
      createdAt: String(r.created_at),
    };
  });

  const grants: NGOGrant[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_grants WHERE tenant_id = $1 AND org_id = $2 ORDER BY id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => {
    const id = String(r.id);
    const awardAmountRwf = num(r.award_amount_rwf);
    const receivedAmountRwf = num(r.received_amount_rwf);
    const approvedBudgetRwf = num(r.approved_budget_rwf);
    const grantLines = budgetLines.filter((b) => b.grantId === id);
    const confirmedPaidRwf = grantLines.reduce((acc, b) => acc + b.spentAmount, 0);
    const expensesIncurredRwf = grantLines.reduce((acc, b) => acc + Math.max(b.committedAmount, b.spentAmount), 0);
    return {
      id,
      programId: String(r.program_id),
      donorName: String(r.donor_name),
      grantCode: String(r.grant_code),
      title: String(r.title),
      currency: String(r.currency) as NGOGrant['currency'],
      originalAmount: num(r.original_amount),
      exchangeRateRwf: num(r.exchange_rate_rwf),
      awardAmountRwf,
      receivedAmountRwf,
      approvedBudgetRwf,
      expensesIncurredRwf,
      confirmedPaidRwf,
      remainingBudgetRwf: Math.max(0, approvedBudgetRwf - confirmedPaidRwf),
      uncommittedRwf: Math.max(0, approvedBudgetRwf - expensesIncurredRwf),
      restrictedCategories: safeJson<string[]>(r.restricted_categories, []),
      startDate: String(r.start_date),
      endDate: String(r.end_date),
      nextReportDue: String(r.next_report_due),
      reportingSchedule: String(r.reporting_schedule),
      conditionsNote: String(r.conditions_note),
      status: String(r.status) as NGOGrant['status'],
      createdAt: String(r.created_at),
    };
  });

  const activities: NGOActivity[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_activities WHERE tenant_id = $1 AND org_id = $2 ORDER BY scheduled_date DESC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    projectId: r.project_id ? String(r.project_id) : null,
    grantId: r.grant_id ? String(r.grant_id) : null,
    budgetLineId: r.budget_line_id ? String(r.budget_line_id) : null,
    title: String(r.title),
    activityType: String(r.activity_type),
    district: String(r.district),
    sector: String(r.sector),
    scheduledDate: String(r.scheduled_date),
    completedDate: String(r.completed_date),
    leadOfficer: String(r.lead_officer),
    targetParticipants: num(r.target_participants),
    actualParticipants: num(r.actual_participants),
    linkedEntityType: String(r.linked_entity_type) as NGOActivity['linkedEntityType'],
    linkedEntityId: String(r.linked_entity_id),
    evidenceUrl: String(r.evidence_url),
    evidenceNote: String(r.evidence_note),
    status: String(r.status) as NGOActivity['status'],
    verificationStatus: String(r.verification_status) as NGOActivity['verificationStatus'],
    createdAt: String(r.created_at),
  }));

  const beneficiaryCohorts: NGOBeneficiaryCohort[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_beneficiary_cohorts WHERE tenant_id = $1 AND org_id = $2 ORDER BY cohort_code ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    cohortCode: String(r.cohort_code),
    name: String(r.name),
    cohortType: String(r.cohort_type) as NGOBeneficiaryCohort['cohortType'],
    district: String(r.district),
    sector: String(r.sector),
    linkedOrgId: String(r.linked_org_id),
    householdsCount: num(r.households_count),
    participantsCount: num(r.participants_count),
    femaleCount: num(r.female_count),
    youthCount: num(r.youth_count),
    enrollmentStage: String(r.enrollment_stage) as NGOBeneficiaryCohort['enrollmentStage'],
    safeguardingLevel: String(r.safeguarding_level) as NGOBeneficiaryCohort['safeguardingLevel'],
    consentBasis: String(r.consent_basis),
    assignedOfficer: String(r.assigned_officer),
    notes: String(r.notes),
    createdAt: String(r.created_at),
  }));

  const fieldVisits: NGOFieldVisit[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_field_visits WHERE tenant_id = $1 AND org_id = $2 ORDER BY visit_date DESC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    activityId: r.activity_id ? String(r.activity_id) : null,
    officerId: String(r.officer_id),
    officerName: String(r.officer_name),
    visitDate: String(r.visit_date),
    district: String(r.district),
    sector: String(r.sector),
    communityName: String(r.community_name),
    purpose: String(r.purpose),
    formType: String(r.form_type) as NGOFieldVisit['formType'],
    attendeesCount: num(r.attendees_count),
    observations: String(r.observations),
    outcomesRecorded: String(r.outcomes_recorded),
    followUpNeeded: String(r.follow_up_needed),
    evidenceAttachment: String(r.evidence_attachment),
    syncStatus: String(r.sync_status) as NGOFieldVisit['syncStatus'],
    verificationStatus: String(r.verification_status) as NGOFieldVisit['verificationStatus'],
    createdAt: String(r.created_at),
  }));

  const indicators: NGOIndicator[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_indicators WHERE tenant_id = $1 AND org_id = $2 ORDER BY code ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => {
    const baseline = num(r.baseline_value);
    const target = num(r.target_value);
    const current = num(r.current_value);
    const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return {
      id: String(r.id),
      programId: String(r.program_id),
      code: String(r.code),
      name: String(r.name),
      level: String(r.level) as NGOIndicator['level'],
      unit: String(r.unit) as NGOIndicator['unit'],
      baselineValue: baseline,
      targetValue: target,
      currentValue: current,
      progressPercent,
      numeratorLabel: String(r.numerator_label),
      denominatorLabel: String(r.denominator_label),
      dataSource: String(r.data_source),
      disaggregation: safeJson<Record<string, number>>(r.disaggregation, {}),
      reportingPeriod: String(r.reporting_period),
      responsibleOfficer: String(r.responsible_officer),
      verificationStatus: String(r.verification_status) as NGOIndicator['verificationStatus'],
      methodologyNote: String(r.methodology_note),
      createdAt: String(r.created_at),
    };
  });

  const dataQualityIssues: NGODataQualityIssue[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_data_quality_issues WHERE tenant_id = $1 AND org_id = $2 ORDER BY created_at DESC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    issueType: String(r.issue_type) as NGODataQualityIssue['issueType'],
    severity: String(r.severity) as NGODataQualityIssue['severity'],
    recordRef: String(r.record_ref),
    description: String(r.description),
    resolutionNote: String(r.resolution_note),
    status: String(r.status) as NGODataQualityIssue['status'],
    detectedBy: String(r.detected_by),
    resolvedBy: String(r.resolved_by),
    createdAt: String(r.created_at),
  }));

  const reportSnapshots: NGOReportSnapshot[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_report_snapshots WHERE tenant_id = $1 AND org_id = $2 ORDER BY created_at DESC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    grantId: r.grant_id ? String(r.grant_id) : null,
    title: String(r.title),
    reportType: String(r.report_type) as NGOReportSnapshot['reportType'],
    reportingPeriod: String(r.reporting_period),
    executiveSummary: String(r.executive_summary),
    activitiesSummary: String(r.activities_summary),
    indicatorsSnapshot: safeJson<NGOReportSnapshot['indicatorsSnapshot']>(r.indicators_snapshot, []),
    budgetSummary: safeJson<NGOReportSnapshot['budgetSummary']>(r.budget_summary, {
      allocatedRwf: 0,
      committedRwf: 0,
      spentRwf: 0,
      utilizationPercent: 0,
    }),
    risksAndLimitations: String(r.risks_and_limitations),
    status: String(r.status) as NGOReportSnapshot['status'],
    preparedBy: String(r.prepared_by),
    approvedBy: String(r.approved_by),
    createdAt: String(r.created_at),
  }));

  const donorAccessGrants: NGODonorAccessGrant[] = (
    await sql.query<Record<string, unknown>>(
      `SELECT * FROM ngo_donor_access_grants WHERE tenant_id = $1 AND org_id = $2 ORDER BY created_at DESC, id ASC`,
      [actor.tenantId, orgId]
    )
  ).rows.map((r) => ({
    id: String(r.id),
    programId: String(r.program_id),
    grantId: r.grant_id ? String(r.grant_id) : null,
    donorName: String(r.donor_name),
    donorEmail: String(r.donor_email),
    accessCode: String(r.access_code),
    permissionsScope: String(r.permissions_scope) as NGODonorAccessGrant['permissionsScope'],
    status: String(r.status) as NGODonorAccessGrant['status'],
    expiresAt: String(r.expires_at),
    grantedBy: String(r.granted_by),
    createdAt: String(r.created_at),
  }));

  // Live Authorized Aggregates from HURIZA Savings Groups, Cooperatives, and Fund Campaigns
  // Privacy Rule: Never expose individual member loans or private member transactions!
  const orgRows = (
    await sql.query<{
      org_id: string;
      name: string;
      kind: string;
      district: string;
      member_count: number;
      savings_model: string | null;
      savings: string;
      loans: string;
      share_capital: string;
    }>(
      `SELECT
        o.org_id, o.name, o.kind, o.district, o.member_count, o.savings_model,
        COALESCE(SUM(CASE WHEN l.account='savings' THEN l.credit - l.debit ELSE 0 END), 0)::text AS savings,
        COALESCE(SUM(CASE WHEN l.account='loans' THEN l.debit - l.credit ELSE 0 END), 0)::text AS loans,
        COALESCE(SUM(CASE WHEN l.account='capital' THEN l.credit - l.debit ELSE 0 END), 0)::text AS share_capital
       FROM finance_orgs o
       LEFT JOIN finance_lines l ON l.tenant_id = o.tenant_id AND l.org_id = o.org_id
       WHERE o.tenant_id = $1 AND o.kind IN ('group', 'cooperative')
       GROUP BY o.org_id, o.name, o.kind, o.district, o.member_count, o.savings_model
       ORDER BY o.org_id ASC`,
      [actor.tenantId]
    )
  ).rows;

  const linkedEntities: NGOLinkedEntityAggregate[] = orgRows.map((o) => {
    const isCoop = o.kind === 'cooperative';
    const isIkimina = o.kind === 'group' && (String(o.savings_model).toUpperCase() === 'ROTATING' || o.org_id === 'group-hope');
    const savingsOrCap = isCoop ? num(o.share_capital) : num(o.savings);
    const loansOrSales = num(o.loans);
    const reserveHealthPercent = savingsOrCap > 0 ? Math.min(100, Math.max(15, Math.round(((savingsOrCap - loansOrSales) / savingsOrCap) * 100))) : 25;
    return {
      orgId: o.org_id,
      name: o.name,
      entityType: isCoop ? 'cooperative' : isIkimina ? 'ikimina_rotating_group' : 'itsinda_savings_group',
      district: o.district,
      memberCount: num(o.member_count),
      aggregateSavingsOrCapitalRwf: savingsOrCap,
      aggregateActiveLoansOrSalesRwf: loansOrSales,
      reserveHealthPercent,
      reportingCompletenessPercent: 96,
      governanceStatus: reserveHealthPercent >= 18 ? 'verified_healthy' : 'attention_needed',
      privacyNotice: isCoop
        ? 'Authorized Cooperative Aggregate: Individual member deliveries & personal payout accounts remain private to cooperative governance.'
        : 'Authorized Group Aggregate Only: Individual member savings passbooks and emergency loan identities are protected by HURIZA group privacy rules.',
    };
  });

  // Build HURIZA ImpactTrace End-to-End Accountability Chains
  // Donor Grant -> Budget Line -> Activity & Confirmed Expense -> Participating Cohort/Group -> Field Evidence -> Verified Indicator -> Approved Donor Report
  const approvedReport = reportSnapshots.find((r) => r.status === 'approved') ?? reportSnapshots[0];
  const impactTraceChains: NGOImpactTraceChain[] = activities.map((act, idx) => {
    const grant = grants.find((g) => g.id === act.grantId) ?? grants[0];
    const bl = budgetLines.find((b) => b.id === act.budgetLineId) ?? budgetLines[0];
    const actExpenses = expenses.filter((e) => e.activityId === act.id && e.status === 'paid');
    const confirmedExpenseRwf = actExpenses.reduce((acc, e) => acc + e.amount, 0);
    const cohort =
      beneficiaryCohorts.find((c) => c.linkedOrgId === act.linkedEntityId || c.district === act.district) ??
      beneficiaryCohorts[0];
    const visit = fieldVisits.find((v) => v.activityId === act.id) ?? fieldVisits[idx % Math.max(1, fieldVisits.length)];
    const indicator =
      act.linkedEntityType === 'cooperative'
        ? indicators.find((i) => i.code === 'IND-COOP-01') ?? indicators[0]
        : indicators[idx % Math.max(1, indicators.length)];

    return {
      traceId: `TRACE-${act.id.toUpperCase()}`,
      grantId: grant?.id ?? 'grant-rift-2026',
      donorName: grant?.donorName ?? 'Rwanda Inclusive Finance Trust (RIFT)',
      grantTitle: grant?.title ?? 'Scaling Digital Savings Groups',
      grantAwardRwf: grant?.awardAmountRwf ?? 135000000,
      budgetLineCode: bl?.lineCode ?? 'BL-101',
      budgetCategory: bl?.category ?? 'savings_group_capacity',
      budgetAllocatedRwf: bl?.allocatedAmount ?? 48000000,
      activityId: act.id,
      activityTitle: act.title,
      activityDistrict: act.district,
      activityStatus: act.status,
      confirmedExpenseRwf,
      beneficiaryCohortName: cohort?.name ?? 'Community Savings Cohort',
      linkedEntityId: act.linkedEntityId || 'group-ubumwe',
      participantsReached: act.actualParticipants || cohort?.participantsCount || 0,
      fieldEvidenceSummary: visit
        ? `${visit.visitDate} (${visit.officerName}): ${visit.outcomesRecorded || visit.observations}`
        : act.evidenceNote,
      evidenceVerified: act.verificationStatus === 'approved' && Boolean(act.evidenceUrl || visit?.syncStatus === 'verified'),
      indicatorCode: indicator?.code ?? 'IND-OUT-01',
      indicatorName: indicator?.name ?? 'Active Savings Groups Maintaining Verified Digital Ledgers',
      indicatorObservedValue: indicator?.currentValue ?? 74,
      indicatorTargetValue: indicator?.targetValue ?? 80,
      indicatorVerificationStatus: indicator?.verificationStatus ?? 'approved',
      reportTitle: approvedReport?.title ?? 'RIFT Q1-Q2 2026 Verified Institutional Accountability Report',
      reportStatus: approvedReport?.status ?? 'approved',
    };
  });

  // Rwanda District Financial Inclusion Context (pairing CGI Rwanda program telemetry with NISR FinScope / EICV context benchmarks)
  const districtContexts: NGODistrictContext[] = [
    {
      district: 'Gasabo',
      province: 'Kigali City',
      programGroupsSupported: 18,
      programCooperativesSupported: 2,
      programParticipantsEnrolled: 460,
      programConfirmedDisbursementsRwf: 14500000,
      nisrFinScopeFormalInclusionPct: 92,
      nisrFinScopeInformalSavingsUsagePct: 68,
      nisrEicvPovertyHeadcountPct: 14,
      contextPriorityLevel: 'urban_enterprise',
      contextSourceLabel: 'Contextual Benchmark: NISR FinScope Rwanda / EICV District Reference (Paired with Synthetic Program Telemetry)',
    },
    {
      district: 'Kicukiro',
      province: 'Kigali City',
      programGroupsSupported: 16,
      programCooperativesSupported: 2,
      programParticipantsEnrolled: 410,
      programConfirmedDisbursementsRwf: 12800000,
      nisrFinScopeFormalInclusionPct: 94,
      nisrFinScopeInformalSavingsUsagePct: 65,
      nisrEicvPovertyHeadcountPct: 12,
      contextPriorityLevel: 'urban_enterprise',
      contextSourceLabel: 'Contextual Benchmark: NISR FinScope Rwanda / EICV District Reference (Paired with Synthetic Program Telemetry)',
    },
    {
      district: 'Rulindo',
      province: 'Northern Province',
      programGroupsSupported: 20,
      programCooperativesSupported: 3,
      programParticipantsEnrolled: 510,
      programConfirmedDisbursementsRwf: 9400000,
      nisrFinScopeFormalInclusionPct: 81,
      nisrFinScopeInformalSavingsUsagePct: 79,
      nisrEicvPovertyHeadcountPct: 31,
      contextPriorityLevel: 'high_priority_rural',
      contextSourceLabel: 'Contextual Benchmark: NISR FinScope Rwanda / EICV District Reference (Paired with Synthetic Program Telemetry)',
    },
    {
      district: 'Rwamagana',
      province: 'Eastern Province',
      programGroupsSupported: 14,
      programCooperativesSupported: 3,
      programParticipantsEnrolled: 320,
      programConfirmedDisbursementsRwf: 15200000,
      nisrFinScopeFormalInclusionPct: 85,
      nisrFinScopeInformalSavingsUsagePct: 74,
      nisrEicvPovertyHeadcountPct: 24,
      contextPriorityLevel: 'peri_urban_growth',
      contextSourceLabel: 'Contextual Benchmark: NISR FinScope Rwanda / EICV District Reference (Paired with Synthetic Program Telemetry)',
    },
    {
      district: 'Huye',
      province: 'Southern Province',
      programGroupsSupported: 12,
      programCooperativesSupported: 2,
      programParticipantsEnrolled: 300,
      programConfirmedDisbursementsRwf: 6200000,
      nisrFinScopeFormalInclusionPct: 83,
      nisrFinScopeInformalSavingsUsagePct: 76,
      nisrEicvPovertyHeadcountPct: 29,
      contextPriorityLevel: 'high_priority_rural',
      contextSourceLabel: 'Contextual Benchmark: NISR FinScope Rwanda / EICV District Reference (Paired with Synthetic Program Telemetry)',
    },
  ];

  // KPIs
  const totalGrantAwardedRwf = grants.reduce((a, g) => a + g.awardAmountRwf, 0);
  const totalGrantReceivedRwf = grants.reduce((a, g) => a + g.receivedAmountRwf, 0);
  const totalApprovedBudgetRwf = grants.reduce((a, g) => a + g.approvedBudgetRwf, 0);
  const totalCommittedExpensesRwf = budgetLines.reduce((a, b) => a + b.committedAmount, 0);
  const totalConfirmedPaidRwf = budgetLines.reduce((a, b) => a + b.spentAmount, 0);
  const remainingRestrictedBalanceRwf = Math.max(0, totalGrantReceivedRwf - totalConfirmedPaidRwf);

  const groupCohorts = beneficiaryCohorts.filter((c) => c.cohortType !== 'cooperative');
  const totalParticipants = groupCohorts.reduce((a, c) => a + c.participantsCount, 0);
  const totalFemale = groupCohorts.reduce((a, c) => a + c.femaleCount, 0);
  const approvedIndCount = indicators.filter((i) => i.verificationStatus === 'approved').length;

  // 5 Guardian NGO Intelligence Lenses
  const guardianInsights: NGOGuardianInsight[] = [
    {
      id: 'g-grant-1',
      lens: 'grant_guardian',
      severity: 'info',
      title: 'Grant Guardian: Restricted Burn Rate & Cash Coverage Healthy',
      explanation: `Confirmed disbursements (${totalConfirmedPaidRwf.toLocaleString()} RWF) represent ${Math.round((totalConfirmedPaidRwf / Math.max(1, totalApprovedBudgetRwf)) * 100)}% of approved multi-donor budgets, with ${remainingRestrictedBalanceRwf.toLocaleString()} RWF in received restricted cash still available.`,
      recommendedAction: 'Confirm payment on approved expense ngo-exp-104 (4,800,000 RWF) before Q2 close.',
      metricLabel: `${Math.round((totalConfirmedPaidRwf / Math.max(1, totalApprovedBudgetRwf)) * 100)}% Budget Burn`,
    },
    {
      id: 'g-prog-2',
      lens: 'program_guardian',
      severity: 'warning',
      title: 'Program Guardian: Huye Safeguarding Clinic Awaiting Field Sync',
      explanation: 'Activity act-105 in Huye (Ngoma sector) is in progress with 1 field visit (fv-105) queued offline and 1 proposed expense awaiting supporting receipt.',
      recommendedAction: 'Sync offline field visit fv-105 and attach signed attendance evidence to unlock MEAL approval.',
      metricLabel: '4/5 Activities Completed',
    },
    {
      id: 'g-dq-3',
      lens: 'data_quality_guardian',
      severity: dataQualityIssues.some((d) => d.status !== 'resolved') ? 'warning' : 'info',
      title: `Data Quality Guardian: ${dataQualityIssues.filter((d) => d.status !== 'resolved').length} Verification Items in Queue`,
      explanation: 'Indicator IND-ACT-01 (212 certified leaders) is held at submitted status until Huye field visit fv-105 is synced and reviewed by the MEAL Officer.',
      recommendedAction: 'Open the MEAL & Data Quality Center to sync fv-105 and verify IND-ACT-01.',
      metricLabel: `${Math.round((approvedIndCount / Math.max(1, indicators.length)) * 100)}% Indicators Verified`,
    },
    {
      id: 'g-fi-4',
      lens: 'financial_inclusion_guardian',
      severity: 'info',
      title: 'Financial Inclusion Guardian: High Rural VSL Adoption in Rulindo & Huye',
      explanation: 'Pairing program telemetry with NISR FinScope context shows Rulindo (79% informal savings usage) and Huye (76%) have strong Itsinda retention and 88% reserve compliance.',
      recommendedAction: 'Prioritize Q3 cooperative linkage grants for graduating Rulindo and Huye women savings groups.',
      metricLabel: '80 Groups · 12 Coops',
    },
    {
      id: 'g-rep-5',
      lens: 'donor_reporting_assistant',
      severity: 'info',
      title: 'Donor Reporting Assistant: RIFT Q2 Package & RGB Compliance Ready',
      explanation: 'All 4 core outcome indicators have verified ImpactTrace chains linking donor funds to group/cooperative aggregates without exposing personal member data.',
      recommendedAction: 'Generate or export the Q2 Donor Accountability & RGB Compliance snapshot from the Report Studio.',
      metricLabel: 'Next Due: 2026-06-30',
    },
  ];

  return {
    profile,
    viewerRole,
    viewerPermissions,
    kpis: {
      activeProgramsCount: programs.filter((p) => p.status === 'active').length,
      activeGrantsCount: grants.filter((g) => g.status === 'active').length,
      totalGrantAwardedRwf,
      totalGrantReceivedRwf,
      totalApprovedBudgetRwf,
      totalCommittedExpensesRwf,
      totalConfirmedPaidRwf,
      remainingRestrictedBalanceRwf,
      supportedSavingsGroupsCount: 80,
      supportedCooperativesCount: 12,
      enrolledBeneficiariesCount: totalParticipants || 2000,
      femaleBeneficiariesPct: totalParticipants > 0 ? Math.round((totalFemale / totalParticipants) * 100) : 69,
      verifiedIndicatorsPct: indicators.length > 0 ? Math.round((approvedIndCount / indicators.length) * 100) : 100,
      openDataQualityIssuesCount: dataQualityIssues.filter((d) => d.status !== 'resolved' && d.status !== 'dismissed').length,
    },
    staff,
    programs,
    projects,
    grants,
    budgetLines,
    activities,
    expenses,
    beneficiaryCohorts,
    fieldVisits,
    indicators,
    dataQualityIssues,
    reportSnapshots,
    donorAccessGrants,
    linkedEntities,
    impactTraceChains,
    districtContexts,
    guardianInsights,
  };
}

export async function handleNgoAction(
  sql: Sql,
  actor: Actor,
  input: Record<string, unknown>,
  appendAudit: (sql: Sql, actor: Actor, orgId: string, action: string, details: unknown) => Promise<void>
): Promise<boolean> {
  const kind = String(input.kind ?? '');
  const ngoKinds = new Set([
    'createNgoOrganization',
    'updateNgoProfile',
    'addNgoStaffMember',
    'updateNgoStaffRole',
    'createNgoProgram',
    'createNgoProject',
    'createNgoGrant',
    'createNgoBudgetLine',
    'requestNgoExpense',
    'reviewNgoExpense',
    'approveNgoExpense',
    'confirmNgoExpensePayment',
    'recordNgoActivity',
    'verifyNgoActivity',
    'enrollNgoBeneficiaryCohort',
    'submitNgoFieldVisit',
    'syncOfflineFieldVisits',
    'createNgoIndicator',
    'recordIndicatorObservation',
    'verifyNgoIndicator',
    'resolveDataQualityIssue',
    'generateNgoReportSnapshot',
    'approveNgoReportSnapshot',
    'grantNgoDonorAccess',
    'revokeNgoDonorAccess',
  ]);
  if (!ngoKinds.has(kind)) return false;

  const orgId = String(input.orgId ?? 'ngo-imizi');
  await seedNgoDemoData(sql, actor.tenantId, orgId);

  const userRes = await sql.query<{ name: string }>(`SELECT name FROM app_users WHERE id = $1`, [actor.userId]);
  const actorName = userRes.rows[0]?.name ? String(userRes.rows[0].name) : actor.userId;

  const staffRes = await sql.query<{ ngo_role: string }>(
    `SELECT ngo_role FROM ngo_staff_members WHERE tenant_id = $1 AND org_id = $2 AND user_id = $3 AND status = 'active'`,
    [actor.tenantId, orgId, actor.userId]
  );
  const viewerRole: NGORole = staffRes.rows[0]
    ? (staffRes.rows[0].ngo_role as NGORole)
    : actor.role === 'ngo'
      ? 'country_director'
      : 'partner_user';
  const perms = computePermissions(viewerRole);

  if ( perms.isReadOnlyDonorOrAuditor ) {
    throw new DomainError('Donor Viewer and Auditor roles have read-only institutional access and cannot modify NGO records.', 403);
  }

  if (kind === 'createNgoOrganization' || kind === 'updateNgoProfile') {
    if (!perms.canManageOrganization) throw new DomainError('Only NGO Executive Leadership can update organization profile & governance settings.', 403);
    const name = String(input.name ?? 'Community Growth Initiative Rwanda').trim();
    const ngoType = String(input.ngoType ?? 'national_ngo');
    const designation = String(input.designation ?? 'National Financial Inclusion Partner').trim();
    const mission = String(input.mission ?? '').trim();
    const focusSectors = Array.isArray(input.focusSectors) ? input.focusSectors.map(String) : ['Financial Inclusion', 'Savings Groups', 'Cooperatives'];
    const operatingDistricts = Array.isArray(input.operatingDistricts) ? input.operatingDistricts.map(String) : ['Gasabo', 'Kicukiro', 'Rulindo', 'Rwamagana', 'Huye'];
    const contactEmail = String(input.contactEmail ?? 'impact@cgi-rwanda.org').trim();
    const contactPhone = String(input.contactPhone ?? '+250 788 310 400').trim();
    const registrationRef = String(input.registrationRef ?? 'RGB/NGO/2021/0418').trim();
    const reportingPeriod = String(input.reportingPeriod ?? 'quarterly');
    const approvalThresholdRwf = Math.max(0, Math.trunc(num(input.approvalThresholdRwf ?? 500000)));

    await sql.query(
      `INSERT INTO ngo_profiles (
        tenant_id, org_id, name, ngo_type, designation, mission,
        focus_sectors, operating_districts, contact_email, contact_phone,
        registration_ref, reporting_period, approval_threshold_rwf
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (tenant_id, org_id) DO UPDATE SET
        name = EXCLUDED.name,
        ngo_type = EXCLUDED.ngo_type,
        designation = EXCLUDED.designation,
        mission = EXCLUDED.mission,
        focus_sectors = EXCLUDED.focus_sectors,
        operating_districts = EXCLUDED.operating_districts,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        registration_ref = EXCLUDED.registration_ref,
        reporting_period = EXCLUDED.reporting_period,
        approval_threshold_rwf = EXCLUDED.approval_threshold_rwf`,
      [
        actor.tenantId, orgId, name, ngoType, designation, mission,
        JSON.stringify(focusSectors), JSON.stringify(operatingDistricts),
        contactEmail, contactPhone, registrationRef, reportingPeriod, approvalThresholdRwf,
      ]
    );
    await appendAudit(sql, actor, orgId, 'ngo_profile_updated', { name, ngoType, registrationRef });
    return true;
  }

  if (kind === 'addNgoStaffMember') {
    if (!perms.canManageStaff) throw new DomainError('Not authorized to add or invite NGO staff members.', 403);
    const fullName = String(input.fullName ?? '').trim();
    const email = String(input.email ?? '').trim().toLowerCase();
    const phone = String(input.phone ?? '').trim();
    const ngoRole = String(input.ngoRole ?? 'field_officer') as NGORole;
    const assignedProgramId = String(input.assignedProgramId ?? 'all');
    const department = String(input.department ?? 'Programs & Field Operations').trim();
    const locationDistrict = String(input.locationDistrict ?? 'Gasabo').trim();
    if (!fullName || (!email && !phone)) {
      throw new DomainError('Staff member full name and email or telephone are required.', 400);
    }

    const userId = String(input.userId ?? `user-ngo-${randomUUID().slice(0, 8)}`);
    const loginIdentifier = email || `${phone.replace(/\D/g, '')}@phone.huriza.rw`;

    // Provision app_users, account_profiles, and memberships so the added user can sign in to the NGO workspace
    await sql.query(
      `INSERT INTO app_users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, 'demo-pin-1234', 'ngo')
       ON CONFLICT (id) DO NOTHING`,
      [userId, fullName, loginIdentifier]
    );
    await sql.query(
      `INSERT INTO account_profiles (user_id, tenant_id, status, is_test_account, workspace)
       VALUES ($1, $2, 'active', true, 'impact')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, actor.tenantId]
    );
    await sql.query(
      `INSERT INTO memberships (tenant_id, user_id, org_id, role)
       VALUES ($1, $2, $3, 'ngo')
       ON CONFLICT (tenant_id, user_id, org_id) DO NOTHING`,
      [actor.tenantId, userId, orgId]
    );

    const staffId = `ngo-staff-${randomUUID().slice(0, 8)}`;
    await sql.query(
      `INSERT INTO ngo_staff_members (
        id, tenant_id, org_id, user_id, full_name, email, phone, ngo_role,
        assigned_program_id, department, location_district, status, assigned_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12)`,
      [staffId, actor.tenantId, orgId, userId, fullName, email, phone, ngoRole, assignedProgramId, department, locationDistrict, actor.userId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_staff_added', { staffId, userId, fullName, ngoRole, department, locationDistrict });
    return true;
  }

  if (kind === 'updateNgoStaffRole') {
    if (!perms.canManageStaff) throw new DomainError('Not authorized to modify NGO staff roles.', 403);
    const staffId = String(input.staffId ?? '');
    const ngoRole = String(input.ngoRole ?? 'field_officer') as NGORole;
    const status = String(input.status ?? 'active');
    await sql.query(
      `UPDATE ngo_staff_members SET ngo_role = $1, status = $2, assigned_by = $3
       WHERE id = $4 AND tenant_id = $5 AND org_id = $6`,
      [ngoRole, status, actor.userId, staffId, actor.tenantId, orgId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_staff_role_updated', { staffId, ngoRole, status });
    return true;
  }

  if (kind === 'createNgoProgram') {
    if (!perms.canManagePrograms) throw new DomainError('Not authorized to create NGO programs.', 403);
    const id = `prog-${randomUUID().slice(0, 8)}`;
    const code = String(input.code ?? `PRG-${Math.floor(100 + Math.random() * 900)}`).trim();
    const name = String(input.name ?? '').trim();
    if (!name) throw new DomainError('Program name is required.', 400);
    const description = String(input.description ?? '').trim();
    const objective = String(input.objective ?? '').trim();
    const targetPopulation = String(input.targetPopulation ?? 'Savings groups & rural households').trim();
    const districts = Array.isArray(input.districts) ? input.districts.map(String) : ['Gasabo', 'Rulindo'];
    const startDate = String(input.startDate ?? '2026-01-01');
    const endDate = String(input.endDate ?? '2026-12-31');
    const fundingSource = String(input.fundingSource ?? 'Institutional Donor Grant').trim();
    const totalBudget = Math.max(0, Math.trunc(num(input.totalBudget ?? 25000000)));
    const leadOfficer = String(input.leadOfficer ?? actorName).trim();

    await sql.query(
      `INSERT INTO ngo_programs (
        id, tenant_id, org_id, code, name, description, objective, target_population,
        districts, start_date, end_date, funding_source, total_budget, lead_officer, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active')`,
      [id, actor.tenantId, orgId, code, name, description, objective, targetPopulation, JSON.stringify(districts), startDate, endDate, fundingSource, totalBudget, leadOfficer]
    );
    await appendAudit(sql, actor, orgId, 'ngo_program_created', { id, code, name, totalBudget });
    return true;
  }

  if (kind === 'createNgoProject') {
    if (!perms.canManagePrograms) throw new DomainError('Not authorized to create NGO projects.', 403);
    const id = `proj-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const code = String(input.code ?? `PRJ-${Math.floor(100 + Math.random() * 900)}`).trim();
    const name = String(input.name ?? '').trim();
    if (!name) throw new DomainError('Project name is required.', 400);
    const district = String(input.district ?? 'Gasabo');
    const sector = String(input.sector ?? 'Kimironko');
    const siteName = String(input.siteName ?? `${district} Field Site`);
    const budgetAllocated = Math.max(0, Math.trunc(num(input.budgetAllocated ?? 10000000)));
    const leadOfficer = String(input.leadOfficer ?? actorName);

    await sql.query(
      `INSERT INTO ngo_projects (
        id, tenant_id, org_id, program_id, code, name, district, sector, site_name,
        budget_allocated, budget_spent, lead_officer, status, start_date, end_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,'active','2026-01-01','2026-12-31')`,
      [id, actor.tenantId, orgId, programId, code, name, district, sector, siteName, budgetAllocated, leadOfficer]
    );
    await appendAudit(sql, actor, orgId, 'ngo_project_created', { id, programId, name, district, budgetAllocated });
    return true;
  }

  if (kind === 'createNgoGrant') {
    if (!perms.canManageGrantsAndBudget) throw new DomainError('Not authorized to register donor grants.', 403);
    const id = `grant-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const donorName = String(input.donorName ?? '').trim();
    const grantCode = String(input.grantCode ?? `GRT-${Math.floor(100 + Math.random() * 900)}`).trim();
    const title = String(input.title ?? '').trim();
    if (!donorName || !title) throw new DomainError('Donor name and grant title are required.', 400);
    const currency = String(input.currency ?? 'RWF');
    const originalAmount = Math.max(1, Math.trunc(num(input.originalAmount ?? 10000000)));
    const exchangeRateRwf = Math.max(1, Math.trunc(num(input.exchangeRateRwf ?? 1)));
    const awardAmountRwf = Number(BigInt(originalAmount) * BigInt(exchangeRateRwf));
    const receivedAmountRwf = Math.max(0, Math.trunc(num(input.receivedAmountRwf ?? awardAmountRwf)));
    const approvedBudgetRwf = Math.max(0, Math.trunc(num(input.approvedBudgetRwf ?? awardAmountRwf)));
    const startDate = String(input.startDate ?? '2026-01-01');
    const endDate = String(input.endDate ?? '2026-12-31');
    const nextReportDue = String(input.nextReportDue ?? '2026-09-30');
    const conditionsNote = String(input.conditionsNote ?? 'Restricted to approved program budget lines.');

    await sql.query(
      `INSERT INTO ngo_grants (
        id, tenant_id, org_id, program_id, donor_name, grant_code, title, currency,
        original_amount, exchange_rate_rwf, award_amount_rwf, received_amount_rwf, approved_budget_rwf,
        restricted_categories, start_date, end_date, next_report_due, conditions_note, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'["savings_group_capacity","field_operations"]',$14,$15,$16,$17,'active')`,
      [id, actor.tenantId, orgId, programId, donorName, grantCode, title, currency, originalAmount, exchangeRateRwf, awardAmountRwf, receivedAmountRwf, approvedBudgetRwf, startDate, endDate, nextReportDue, conditionsNote]
    );
    await appendAudit(sql, actor, orgId, 'ngo_grant_created', { id, donorName, grantCode, awardAmountRwf });
    return true;
  }

  if (kind === 'createNgoBudgetLine') {
    if (!perms.canManageGrantsAndBudget) throw new DomainError('Not authorized to create grant budget lines.', 403);
    const id = `bl-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const grantId = sid(actor.tenantId, String(input.grantId ?? 'grant-rift-2026'));
    const category = String(input.category ?? 'savings_group_capacity');
    const lineCode = String(input.lineCode ?? `BL-${Math.floor(100 + Math.random() * 900)}`).trim();
    const description = String(input.description ?? '').trim();
    const allocatedAmount = Math.max(1, Math.trunc(num(input.allocatedAmount ?? 5000000)));
    if (!description) throw new DomainError('Budget line description is required.', 400);

    await sql.query(
      `INSERT INTO ngo_budget_lines (
        id, tenant_id, org_id, program_id, grant_id, category, line_code, description,
        allocated_amount, committed_amount, spent_amount
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0)`,
      [id, actor.tenantId, orgId, programId, grantId, category, lineCode, description, allocatedAmount]
    );
    await appendAudit(sql, actor, orgId, 'ngo_budget_line_created', { id, grantId, lineCode, allocatedAmount });
    return true;
  }

  // 4-step NGO Expense Workflow:
  // Step 1: requestNgoExpense (proposed -> increments committed_amount on budget line, does NOT deduct spent_amount)
  if (kind === 'requestNgoExpense') {
    const id = `ngo-exp-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const projectId = input.projectId ? sid(actor.tenantId, String(input.projectId)) : null;
    const grantId = sid(actor.tenantId, String(input.grantId ?? 'grant-rift-2026'));
    const budgetLineId = sid(actor.tenantId, String(input.budgetLineId ?? 'bl-101'));
    const activityId = input.activityId ? sid(actor.tenantId, String(input.activityId)) : null;
    const title = String(input.title ?? '').trim();
    const category = String(input.category ?? 'savings_group_capacity');
    const vendorName = String(input.vendorName ?? '').trim();
    const amount = Math.max(1, Math.trunc(num(input.amount ?? 0)));
    const receiptUrl = String(input.receiptUrl ?? '').trim();
    const description = String(input.description ?? '').trim();
    if (!title || amount <= 0) throw new DomainError('Expense title and positive RWF amount are required.', 400);

    const blRes = await sql.query<{ allocated_amount: string; committed_amount: string; spent_amount: string }>(
      `SELECT allocated_amount, committed_amount, spent_amount FROM ngo_budget_lines WHERE id = $1 AND tenant_id = $2 AND org_id = $3`,
      [budgetLineId, actor.tenantId, orgId]
    );
    if (blRes.rows.length === 0) throw new DomainError('Selected budget line does not exist.', 404);
    const allocated = BigInt(blRes.rows[0].allocated_amount);
    const committed = BigInt(blRes.rows[0].committed_amount);
    if (committed + BigInt(amount) > allocated) {
      throw new DomainError('Expense exceeds remaining unallocated budget on this restricted grant budget line.', 400);
    }

    await sql.query(
      `INSERT INTO ngo_expenses (
        id, tenant_id, org_id, program_id, project_id, grant_id, budget_line_id, activity_id,
        title, category, vendor_name, amount, currency, receipt_url, description,
        status, requested_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'RWF',$13,$14,'proposed',$15)`,
      [id, actor.tenantId, orgId, programId, projectId, grantId, budgetLineId, activityId, title, category, vendorName, amount, receiptUrl, description, actorName]
    );
    await sql.query(
      `UPDATE ngo_budget_lines SET committed_amount = committed_amount + $1 WHERE id = $2 AND tenant_id = $3 AND org_id = $4`,
      [amount, budgetLineId, actor.tenantId, orgId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_expense_proposed', { id, budgetLineId, title, amount });
    return true;
  }

  // Step 2: reviewNgoExpense (program_reviewed)
  if (kind === 'reviewNgoExpense') {
    if (!perms.canApproveExpenses) throw new DomainError('Not authorized to review NGO program expenses.', 403);
    const expenseId = sid(actor.tenantId, String(input.expenseId ?? ''));
    await sql.query(
      `UPDATE ngo_expenses SET status = 'program_reviewed', reviewed_by = $1
       WHERE (id = $2 OR id = $5) AND tenant_id = $3 AND org_id = $4 AND status = 'proposed'`,
      [actorName, expenseId, actor.tenantId, orgId, String(input.expenseId ?? '')]
    );
    await appendAudit(sql, actor, orgId, 'ngo_expense_reviewed', { expenseId });
    return true;
  }

  // Step 3: approveNgoExpense (finance_approved - still does NOT deduct spent_amount until payment confirmation!)
  if (kind === 'approveNgoExpense') {
    if (!perms.canApproveExpenses) throw new DomainError('Not authorized to grant finance approval for NGO expenses.', 403);
    const expenseId = sid(actor.tenantId, String(input.expenseId ?? ''));
    await sql.query(
      `UPDATE ngo_expenses SET status = 'finance_approved', approved_by = $1
       WHERE (id = $2 OR id = $5) AND tenant_id = $3 AND org_id = $4 AND status IN ('proposed', 'program_reviewed')`,
      [actorName, expenseId, actor.tenantId, orgId, String(input.expenseId ?? '')]
    );
    await appendAudit(sql, actor, orgId, 'ngo_expense_approved', { expenseId });
    return true;
  }

  // Step 4: confirmNgoExpensePayment (paid -> updates spent_amount on budget line & project)
  if (kind === 'confirmNgoExpensePayment') {
    if (!perms.canConfirmPayments) throw new DomainError('Only Finance Manager, Accountant, or Executive Director can confirm NGO expense payment.', 403);
    const rawExpId = String(input.expenseId ?? '');
    const expenseId = sid(actor.tenantId, rawExpId);
    const paymentReference = String(input.paymentReference ?? `MOMO-NGO-DISB-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    const expRes = await sql.query<{
      id: string;
      amount: string;
      budget_line_id: string;
      project_id: string | null;
      status: string;
    }>(
      `SELECT id, amount, budget_line_id, project_id, status FROM ngo_expenses WHERE (id = $1 OR id = $4) AND tenant_id = $2 AND org_id = $3`,
      [expenseId, actor.tenantId, orgId, rawExpId]
    );
    if (expRes.rows.length === 0) throw new DomainError('Expense record not found.', 404);
    const exp = expRes.rows[0];
    if (exp.status === 'paid') return true;
    if (exp.status !== 'finance_approved') {
      throw new DomainError('Expense must receive Finance/Director approval before payment confirmation.', 400);
    }
    const amount = num(exp.amount);
    await sql.query(
      `UPDATE ngo_expenses SET status = 'paid', payment_reference = $1 WHERE id = $2 AND tenant_id = $3 AND org_id = $4`,
      [paymentReference, exp.id, actor.tenantId, orgId]
    );
    await sql.query(
      `UPDATE ngo_budget_lines SET spent_amount = spent_amount + $1 WHERE id = $2 AND tenant_id = $3 AND org_id = $4`,
      [amount, exp.budget_line_id, actor.tenantId, orgId]
    );
    if (exp.project_id) {
      await sql.query(
        `UPDATE ngo_projects SET budget_spent = budget_spent + $1 WHERE id = $2 AND tenant_id = $3 AND org_id = $4`,
        [amount, exp.project_id, actor.tenantId, orgId]
      );
    }
    await appendAudit(sql, actor, orgId, 'ngo_expense_paid', { expenseId: exp.id, amount, paymentReference });
    return true;
  }

  if (kind === 'recordNgoActivity') {
    if (!perms.canSubmitFieldData) throw new DomainError('Not authorized to record NGO field activities.', 403);
    const id = `act-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const projectId = input.projectId ? sid(actor.tenantId, String(input.projectId)) : sid(actor.tenantId, 'proj-gasabo');
    const grantId = input.grantId ? sid(actor.tenantId, String(input.grantId)) : sid(actor.tenantId, 'grant-rift-2026');
    const budgetLineId = input.budgetLineId ? sid(actor.tenantId, String(input.budgetLineId)) : sid(actor.tenantId, 'bl-101');
    const title = String(input.title ?? '').trim();
    if (!title) throw new DomainError('Activity title is required.', 400);
    const activityType = String(input.activityType ?? 'group_training');
    const district = String(input.district ?? 'Gasabo');
    const sector = String(input.sector ?? 'Kimironko');
    const scheduledDate = String(input.scheduledDate ?? new Date().toISOString().slice(0, 10));
    const targetParticipants = Math.max(0, Math.trunc(num(input.targetParticipants ?? 40)));
    const actualParticipants = Math.max(0, Math.trunc(num(input.actualParticipants ?? targetParticipants)));
    const linkedEntityType = String(input.linkedEntityType ?? 'savings_group');
    const linkedEntityId = String(input.linkedEntityId ?? 'group-ubumwe');
    const evidenceUrl = String(input.evidenceUrl ?? '').trim();
    const evidenceNote = String(input.evidenceNote ?? '').trim();

    await sql.query(
      `INSERT INTO ngo_activities (
        id, tenant_id, org_id, program_id, project_id, grant_id, budget_line_id,
        title, activity_type, district, sector, scheduled_date, completed_date,
        lead_officer, target_participants, actual_participants, linked_entity_type,
        linked_entity_id, evidence_url, evidence_note, status, verification_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,$19,'completed','submitted')`,
      [id, actor.tenantId, orgId, programId, projectId, grantId, budgetLineId, title, activityType, district, sector, scheduledDate, actorName, targetParticipants, actualParticipants, linkedEntityType, linkedEntityId, evidenceUrl, evidenceNote]
    );
    await appendAudit(sql, actor, orgId, 'ngo_activity_recorded', { id, title, district, linkedEntityId });
    return true;
  }

  if (kind === 'verifyNgoActivity') {
    if (!perms.canVerifyMeal) throw new DomainError('Only MEAL Officer or Program Leadership can verify activities.', 403);
    const rawId = String(input.activityId ?? '');
    const activityId = sid(actor.tenantId, rawId);
    const verificationStatus = String(input.verificationStatus ?? 'approved');
    const evidenceUrl = String(input.evidenceUrl ?? '').trim();
    await sql.query(
      `UPDATE ngo_activities
       SET verification_status = $1, status = 'completed',
           evidence_url = CASE WHEN $2 <> '' THEN $2 ELSE evidence_url END
       WHERE (id = $3 OR id = $6) AND tenant_id = $4 AND org_id = $5`,
      [verificationStatus, evidenceUrl, activityId, actor.tenantId, orgId, rawId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_activity_verified', { activityId, verificationStatus });
    return true;
  }

  if (kind === 'enrollNgoBeneficiaryCohort') {
    if (!perms.canSubmitFieldData) throw new DomainError('Not authorized to enroll beneficiary cohorts.', 403);
    const id = `coh-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const cohortCode = String(input.cohortCode ?? `COH-${Math.floor(100 + Math.random() * 900)}`).trim();
    const name = String(input.name ?? '').trim();
    if (!name) throw new DomainError('Cohort or group cluster name is required.', 400);
    const cohortType = String(input.cohortType ?? 'savings_group_itsinda');
    const district = String(input.district ?? 'Gasabo');
    const sector = String(input.sector ?? 'Kimironko');
    const linkedOrgId = String(input.linkedOrgId ?? 'group-ubumwe');
    const householdsCount = Math.max(0, Math.trunc(num(input.householdsCount ?? 30)));
    const participantsCount = Math.max(0, Math.trunc(num(input.participantsCount ?? 30)));
    const femaleCount = Math.max(0, Math.trunc(num(input.femaleCount ?? 20)));
    const youthCount = Math.max(0, Math.trunc(num(input.youthCount ?? 12)));
    const safeguardingLevel = String(input.safeguardingLevel ?? 'standard');
    const notes = String(input.notes ?? '').trim();

    await sql.query(
      `INSERT INTO ngo_beneficiary_cohorts (
        id, tenant_id, org_id, program_id, cohort_code, name, cohort_type,
        district, sector, linked_org_id, households_count, participants_count,
        female_count, youth_count, enrollment_stage, safeguarding_level,
        consent_basis, assigned_officer, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,'informed_program_consent',$16,$17)`,
      [id, actor.tenantId, orgId, programId, cohortCode, name, cohortType, district, sector, linkedOrgId, householdsCount, participantsCount, femaleCount, youthCount, safeguardingLevel, actorName, notes]
    );
    await appendAudit(sql, actor, orgId, 'ngo_cohort_enrolled', { id, cohortCode, name, participantsCount });
    return true;
  }

  if (kind === 'submitNgoFieldVisit') {
    if (!perms.canSubmitFieldData) throw new DomainError('Not authorized to submit field visits.', 403);
    const id = `fv-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const activityId = input.activityId ? sid(actor.tenantId, String(input.activityId)) : sid(actor.tenantId, 'act-101');
    const visitDate = String(input.visitDate ?? new Date().toISOString().slice(0, 10));
    const district = String(input.district ?? 'Gasabo');
    const sector = String(input.sector ?? 'Kimironko');
    const communityName = String(input.communityName ?? `${sector} Community Site`).trim();
    const purpose = String(input.purpose ?? '').trim();
    if (!purpose) throw new DomainError('Field visit purpose is required.', 400);
    const formType = String(input.formType ?? 'savings_group_monitoring');
    const attendeesCount = Math.max(0, Math.trunc(num(input.attendeesCount ?? 25)));
    const observations = String(input.observations ?? '').trim();
    const outcomesRecorded = String(input.outcomesRecorded ?? '').trim();
    const followUpNeeded = String(input.followUpNeeded ?? '').trim();
    const evidenceAttachment = String(input.evidenceAttachment ?? '').trim();
    const syncStatus = String(input.syncStatus ?? 'synced');

    await sql.query(
      `INSERT INTO ngo_field_visits (
        id, tenant_id, org_id, program_id, activity_id, officer_id, officer_name,
        visit_date, district, sector, community_name, purpose, form_type,
        attendees_count, observations, outcomes_recorded, follow_up_needed,
        evidence_attachment, sync_status, verification_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'submitted')`,
      [id, actor.tenantId, orgId, programId, activityId, actor.userId, actorName, visitDate, district, sector, communityName, purpose, formType, attendeesCount, observations, outcomesRecorded, followUpNeeded, evidenceAttachment, syncStatus]
    );
    await appendAudit(sql, actor, orgId, 'ngo_field_visit_submitted', { id, district, formType, attendeesCount, syncStatus });
    return true;
  }

  if (kind === 'syncOfflineFieldVisits') {
    await sql.query(
      `UPDATE ngo_field_visits
       SET sync_status = 'verified', verification_status = 'meal_reviewed'
       WHERE tenant_id = $1 AND org_id = $2 AND sync_status = 'queued_offline'`,
      [actor.tenantId, orgId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_offline_visits_synced', {});
    return true;
  }

  if (kind === 'createNgoIndicator') {
    if (!perms.canVerifyMeal) throw new DomainError('Only MEAL Officer or Program Leadership can define MEAL indicators.', 403);
    const id = `ind-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const code = String(input.code ?? `IND-${Math.floor(100 + Math.random() * 900)}`).trim();
    const name = String(input.name ?? '').trim();
    if (!name) throw new DomainError('Indicator name is required.', 400);
    const level = String(input.level ?? 'output');
    const unit = String(input.unit ?? 'count');
    const baselineValue = Math.trunc(num(input.baselineValue ?? 0));
    const targetValue = Math.trunc(num(input.targetValue ?? 100));
    const currentValue = Math.trunc(num(input.currentValue ?? baselineValue));
    const methodologyNote = String(input.methodologyNote ?? 'Observed program monitoring indicator.');

    await sql.query(
      `INSERT INTO ngo_indicators (
        id, tenant_id, org_id, program_id, code, name, level, unit,
        baseline_value, target_value, current_value, data_source,
        responsible_officer, verification_status, methodology_note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Field Surveys & HURIZA Group Telemetry',$12,'submitted',$13)`,
      [id, actor.tenantId, orgId, programId, code, name, level, unit, baselineValue, targetValue, currentValue, actorName, methodologyNote]
    );
    await appendAudit(sql, actor, orgId, 'ngo_indicator_created', { id, code, name, targetValue });
    return true;
  }

  if (kind === 'recordIndicatorObservation' || kind === 'verifyNgoIndicator') {
    if (!perms.canVerifyMeal) throw new DomainError('Only MEAL Officer or Program Leadership can update or verify indicators.', 403);
    const rawId = String(input.indicatorId ?? '');
    const indicatorId = sid(actor.tenantId, rawId);
    const currentValue = input.currentValue !== undefined ? Math.trunc(num(input.currentValue)) : undefined;
    const verificationStatus = String(input.verificationStatus ?? 'approved');
    if (currentValue !== undefined) {
      await sql.query(
        `UPDATE ngo_indicators SET current_value = $1, verification_status = $2 WHERE (id = $3 OR id = $6) AND tenant_id = $4 AND org_id = $5`,
        [currentValue, verificationStatus, indicatorId, actor.tenantId, orgId, rawId]
      );
    } else {
      await sql.query(
        `UPDATE ngo_indicators SET verification_status = $1 WHERE (id = $2 OR id = $5) AND tenant_id = $3 AND org_id = $4`,
        [verificationStatus, indicatorId, actor.tenantId, orgId, rawId]
      );
    }
    await appendAudit(sql, actor, orgId, 'ngo_indicator_verified', { indicatorId, currentValue, verificationStatus });
    return true;
  }

  if (kind === 'resolveDataQualityIssue') {
    if (!perms.canVerifyMeal) throw new DomainError('Not authorized to resolve MEAL data quality issues.', 403);
    const rawId = String(input.issueId ?? '');
    const issueId = sid(actor.tenantId, rawId);
    const resolutionNote = String(input.resolutionNote ?? 'Verified against supporting field evidence and reconciled.').trim();
    await sql.query(
      `UPDATE ngo_data_quality_issues
       SET status = 'resolved', resolution_note = $1, resolved_by = $2
       WHERE (id = $3 OR id = $6) AND tenant_id = $4 AND org_id = $5`,
      [resolutionNote, actorName, issueId, actor.tenantId, orgId, rawId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_dq_issue_resolved', { issueId, resolutionNote });
    return true;
  }

  if (kind === 'generateNgoReportSnapshot') {
    if (!perms.canGenerateReports) throw new DomainError('Not authorized to generate institutional donor reports.', 403);
    const id = `rep-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const grantId = input.grantId ? sid(actor.tenantId, String(input.grantId)) : sid(actor.tenantId, 'grant-rift-2026');
    const title = String(input.title ?? 'Quarterly Donor Accountability & ImpactTrace Report').trim();
    const reportType = String(input.reportType ?? 'donor_quarterly');
    const reportingPeriod = String(input.reportingPeriod ?? '2026-Q2');
    const executiveSummary = String(
      input.executiveSummary ??
        'Verified institutional progress report generated from HURIZA ImpactTrace, linking donor grant lines, completed field activities, anonymized savings group & cooperative aggregates, and verified MEAL indicators.'
    ).trim();
    const activitiesSummary = String(input.activitiesSummary ?? 'All scheduled district trainings and governance clinics reconciled against field attendance sheets.');
    const risksAndLimitations = String(
      input.risksAndLimitations ??
        'Observed group savings and reserve ratios reflect monitoring progress among participating cohorts and do not claim causal econometric impact without a counterfactual control group.'
    );

    const indRows = (
      await sql.query<Record<string, unknown>>(
        `SELECT code, name, baseline_value, target_value, current_value, unit, verification_status
         FROM ngo_indicators WHERE tenant_id = $1 AND org_id = $2 AND program_id = $3 ORDER BY code ASC`,
        [actor.tenantId, orgId, programId]
      )
    ).rows.map((r) => ({
      code: String(r.code),
      name: String(r.name),
      baseline: num(r.baseline_value),
      target: num(r.target_value),
      actual: num(r.current_value),
      unit: String(r.unit),
      verified: String(r.verification_status) === 'approved',
    }));

    const blRows = (
      await sql.query<{ alloc: string; comm: string; spent: string }>(
        `SELECT COALESCE(SUM(allocated_amount),0)::text AS alloc,
                COALESCE(SUM(committed_amount),0)::text AS comm,
                COALESCE(SUM(spent_amount),0)::text AS spent
         FROM ngo_budget_lines WHERE tenant_id = $1 AND org_id = $2 AND program_id = $3`,
        [actor.tenantId, orgId, programId]
      )
    ).rows[0];
    const allocatedRwf = num(blRows?.alloc);
    const committedRwf = num(blRows?.comm);
    const spentRwf = num(blRows?.spent);
    const budgetSummary = {
      allocatedRwf,
      committedRwf,
      spentRwf,
      utilizationPercent: allocatedRwf > 0 ? Math.round((spentRwf / allocatedRwf) * 100) : 0,
    };

    await sql.query(
      `INSERT INTO ngo_report_snapshots (
        id, tenant_id, org_id, program_id, grant_id, title, report_type, reporting_period,
        executive_summary, activities_summary, indicators_snapshot, budget_summary,
        risks_and_limitations, status, prepared_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14)`,
      [
        id, actor.tenantId, orgId, programId, grantId, title, reportType, reportingPeriod,
        executiveSummary, activitiesSummary, JSON.stringify(indRows), JSON.stringify(budgetSummary),
        risksAndLimitations, actorName,
      ]
    );
    await appendAudit(sql, actor, orgId, 'ngo_report_generated', { id, title, reportType, reportingPeriod });
    return true;
  }

  if (kind === 'approveNgoReportSnapshot') {
    if (!perms.canManageOrganization && !perms.canVerifyMeal) {
      throw new DomainError('Only Executive Leadership or MEAL Officer can approve final donor report snapshots.', 403);
    }
    const rawId = String(input.reportId ?? '');
    const reportId = sid(actor.tenantId, rawId);
    await sql.query(
      `UPDATE ngo_report_snapshots SET status = 'approved', approved_by = $1
       WHERE (id = $2 OR id = $5) AND tenant_id = $3 AND org_id = $4`,
      [actorName, reportId, actor.tenantId, orgId, rawId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_report_approved', { reportId });
    return true;
  }

  if (kind === 'grantNgoDonorAccess') {
    if (!perms.canManageDonorAccess) throw new DomainError('Not authorized to grant external donor portal access.', 403);
    const id = `dag-${randomUUID().slice(0, 8)}`;
    const programId = sid(actor.tenantId, String(input.programId ?? 'prog-frc-2026'));
    const grantId = input.grantId ? sid(actor.tenantId, String(input.grantId)) : sid(actor.tenantId, 'grant-rift-2026');
    const donorName = String(input.donorName ?? '').trim();
    const donorEmail = String(input.donorEmail ?? '').trim();
    if (!donorName || !donorEmail) throw new DomainError('Donor organization name and email are required.', 400);
    const permissionsScope = String(input.permissionsScope ?? 'aggregates_and_reports');
    const expiresAt = String(input.expiresAt ?? '2026-12-31');
    const accessCode = `TRACE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await sql.query(
      `INSERT INTO ngo_donor_access_grants (
        id, tenant_id, org_id, program_id, grant_id, donor_name, donor_email,
        access_code, permissions_scope, status, expires_at, granted_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11)`,
      [id, actor.tenantId, orgId, programId, grantId, donorName, donorEmail, accessCode, permissionsScope, expiresAt, actorName]
    );
    await appendAudit(sql, actor, orgId, 'ngo_donor_access_granted', { id, donorName, donorEmail, permissionsScope });
    return true;
  }

  if (kind === 'revokeNgoDonorAccess') {
    if (!perms.canManageDonorAccess) throw new DomainError('Not authorized to revoke donor portal access.', 403);
    const rawId = String(input.accessGrantId ?? '');
    const accessGrantId = sid(actor.tenantId, rawId);
    await sql.query(
      `UPDATE ngo_donor_access_grants SET status = 'revoked'
       WHERE (id = $1 OR id = $4) AND tenant_id = $2 AND org_id = $3`,
      [accessGrantId, actor.tenantId, orgId, rawId]
    );
    await appendAudit(sql, actor, orgId, 'ngo_donor_access_revoked', { accessGrantId });
    return true;
  }

  return false;
}
