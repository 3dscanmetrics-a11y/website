PRAGMA foreign_keys = OFF;

CREATE TABLE crm_users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ADMIN','HR','FINANCE','CRM')),
  must_change_password INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE crm_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(user_id) REFERENCES crm_users(id) ON DELETE CASCADE
);
CREATE INDEX idx_crm_sessions_token ON crm_sessions(token_hash, expires_at);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL,
  entity_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(actor_user_id) REFERENCES crm_users(id)
);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);

CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
INSERT INTO expense_categories(id,name) VALUES
 ('hardware','Hardware/Equipment'),('software','Software Subscriptions'),
 ('travel','Travel & Accommodation'),('contractors','Contractors');

ALTER TABLE expenses RENAME TO expenses_legacy;
CREATE TABLE expenses (
  id TEXT PRIMARY KEY, supplier TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  transaction_date TEXT NOT NULL, category_id TEXT, reference TEXT,
  amount_ex_vat_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_ex_vat_cents >= 0),
  vat_cents INTEGER NOT NULL DEFAULT 0 CHECK(vat_cents >= 0), vat_rate REAL NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL CHECK(total_cents > 0), currency TEXT NOT NULL DEFAULT 'ZAR',
  payment_method TEXT, notes TEXT, receipt_key TEXT, lead_id TEXT,
  allocation_type TEXT NOT NULL DEFAULT 'OVERHEAD' CHECK(allocation_type IN ('PROJECT','OVERHEAD')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','VOID')),
  source TEXT NOT NULL DEFAULT 'MANUAL', created_by TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  voided_at TEXT, void_reason TEXT,
  FOREIGN KEY(category_id) REFERENCES expense_categories(id), FOREIGN KEY(lead_id) REFERENCES leads(id),
  FOREIGN KEY(created_by) REFERENCES crm_users(id)
);
INSERT INTO expenses(id,supplier,description,transaction_date,category_id,amount_ex_vat_cents,total_cents,status,source,created_at,updated_at)
SELECT e.id,e.vendor,e.vendor,substr(e.date,1,10),c.id,CAST(round(e.amount*100) AS INTEGER),CAST(round(e.amount*100) AS INTEGER),'POSTED','LEGACY',e.date,e.date
FROM expenses_legacy e LEFT JOIN expense_categories c ON c.name=e.category;
DROP TABLE expenses_legacy;
CREATE INDEX idx_expenses_date ON expenses(transaction_date DESC);
CREATE INDEX idx_expenses_status ON expenses(status, transaction_date DESC);

CREATE TABLE employees (
  id TEXT PRIMARY KEY, employee_number TEXT NOT NULL UNIQUE, legal_first_name TEXT NOT NULL,
  legal_last_name TEXT NOT NULL, preferred_name TEXT, email TEXT, phone TEXT,
  identity_type TEXT, identity_number TEXT, tax_number TEXT, address TEXT,
  job_title TEXT NOT NULL, department TEXT, employment_type TEXT NOT NULL DEFAULT 'PERMANENT',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ON_LEAVE','TERMINATED')),
  work_location TEXT, start_date TEXT NOT NULL, end_date TEXT, ordinary_hours_weekly REAL,
  remuneration_cents INTEGER, remuneration_frequency TEXT, bank_detail_reference TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX idx_employees_status ON employees(status, legal_last_name);
CREATE TABLE emergency_contacts (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, name TEXT NOT NULL, relationship TEXT,
  phone TEXT NOT NULL, email TEXT, FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE TABLE employee_documents (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, document_type TEXT NOT NULL, file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL, content_type TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  issue_date TEXT, expiry_date TEXT, notes TEXT, retention_until TEXT, uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE, FOREIGN KEY(uploaded_by) REFERENCES crm_users(id)
);
CREATE INDEX idx_employee_documents_expiry ON employee_documents(expiry_date);
CREATE TABLE leave_types (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, paid INTEGER NOT NULL DEFAULT 1,
  default_days REAL, cycle_months INTEGER NOT NULL DEFAULT 12, active INTEGER NOT NULL DEFAULT 1,
  requires_document INTEGER NOT NULL DEFAULT 0
);
INSERT INTO leave_types(id,name,paid,default_days,cycle_months,requires_document) VALUES
 ('annual','Annual Leave',1,15,12,0),('sick','Sick Leave',1,30,36,0),
 ('family','Family Responsibility',1,3,12,0),('maternity','Maternity / Parental Leave',0,NULL,12,1),
 ('unpaid','Unpaid Leave',0,NULL,12,0),('other','Other Leave',0,NULL,12,0);
CREATE TABLE leave_cycles (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, leave_type_id TEXT NOT NULL,
  starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, entitlement_days REAL NOT NULL DEFAULT 0,
  UNIQUE(employee_id,leave_type_id,starts_on), FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY(leave_type_id) REFERENCES leave_types(id)
);
CREATE TABLE leave_adjustments (
  id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, days REAL NOT NULL, reason TEXT NOT NULL,
  created_by TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(cycle_id) REFERENCES leave_cycles(id) ON DELETE CASCADE, FOREIGN KEY(created_by) REFERENCES crm_users(id)
);
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, leave_type_id TEXT NOT NULL,
  starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, days REAL NOT NULL CHECK(days > 0), reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  supporting_document_key TEXT, override_reason TEXT, created_by TEXT, decided_by TEXT, decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY(leave_type_id) REFERENCES leave_types(id), FOREIGN KEY(created_by) REFERENCES crm_users(id),
  FOREIGN KEY(decided_by) REFERENCES crm_users(id)
);
CREATE INDEX idx_leave_requests_dates ON leave_requests(status, starts_on, ends_on);

PRAGMA foreign_keys = ON;
