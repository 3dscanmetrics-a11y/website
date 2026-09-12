-- Structured, version-safe formal quotations.
CREATE TABLE IF NOT EXISTS quote_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL,
  trading_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_account_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_branch_code TEXT NOT NULL,
  validity_days INTEGER NOT NULL DEFAULT 90,
  deposit_percent REAL NOT NULL DEFAULT 50,
  vat_rate REAL NOT NULL DEFAULT 15,
  vat_default_enabled INTEGER NOT NULL DEFAULT 0,
  terms_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO quote_settings (
  id, company_name, trading_name, registration_number, email, website,
  contact_name, phone, bank_name, bank_account_name, bank_account_number,
  bank_branch_code, validity_days, deposit_percent, vat_rate,
  vat_default_enabled, terms_json
) VALUES (
  1,
  'Freelance Geomatics ZA (Pty) Ltd',
  '3D Scan Metrics Laser Scanning',
  '2018/643721/07',
  'isaiah@3dscanmetrics.co.za',
  'www.3dscanmetrics.co.za',
  'Isaiah Mpofu',
  '+27 82 733 6873',
  'First National Bank (FNB)',
  'Freelance Geomatics ZA (Pty) Ltd',
  '62909760185',
  '250655',
  90,
  50,
  15,
  0,
  '[{"heading":"1. DEFINITIONS","body":"1.1. The Company refers to Freelance Geomatics ZA (Pty) Ltd.\n1.2. The Client refers to the entity requesting the services.\n1.3. Services refers strictly to 3D Laser Scanning, Point Cloud Registration, and 3D Modelling/Drafting."},{"heading":"2. QUOTATION VALIDITY","body":"2.1. Quotations are valid for acceptance for the period stated from the date of issue.\n2.2. Pricing is based on the specific quantity, time, area and scope detailed in the quote. Any expansion of the scan area or level of detail requested on-site will require a variation order."},{"heading":"3. PAYMENT TERMS","body":"3.1. A 50% deposit is required upon acceptance to book the scanning team and equipment.\n3.2. The balance is due prior to the release of the final deliverables.\n3.3. Payments must use the business name or client name as reference."},{"heading":"4. SITE ACCESS AND SCANNING CONDITIONS","body":"4.1. Laser scanners operate on line-of-sight technology and can only capture visible surfaces.\n4.2. The Client must ensure the site is clear of temporary obstructions before arrival.\n4.3. The Company is not liable for data shadows caused by immovable objects. Additional access or scan setups may be quoted separately.\n4.4. Excessive vibration may result in data noise or re-scanning charged as additional time."},{"heading":"5. DELIVERABLES AND DATA","body":"5.1. Deliverables will be supplied in the formats specified in the quote.\n5.2. The Client is responsible for hardware capable of viewing and storing large scan files.\n5.3. Final drawings represent site conditions at the time of scanning.\n5.4. Raw scan data will be retained for 6 months; thereafter archiving is the Client responsibility."},{"heading":"6. EXCLUSIONS","body":"6.1. Unless itemized, services exclude sub-surface investigations or utility detection.\n6.2. Destructive testing is excluded.\n6.3. Confined-space scanning is excluded unless safety permits and specialized equipment is quoted."},{"heading":"7. INTELLECTUAL PROPERTY","body":"7.1. Processed point clouds and 3D models remain Company property until full payment. Upon payment, the Client receives a perpetual licence to use the data for the specified project."}]'
);

CREATE TABLE IF NOT EXISTS quote_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'VOID')),
  client_company TEXT,
  client_contact TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  client_address TEXT,
  project TEXT NOT NULL,
  deliverables_summary TEXT,
  timeframe TEXT,
  issue_date TEXT,
  validity_days INTEGER NOT NULL DEFAULT 90,
  payment_reference TEXT,
  vat_enabled INTEGER NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 15,
  subtotal REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  settings_snapshot TEXT,
  terms_snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  issued_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_lead ON quotes (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes (status);

CREATE TABLE IF NOT EXISTS quote_sections (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_sections_quote ON quote_sections (quote_id, sort_order);

CREATE TABLE IF NOT EXISTS quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  description TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Item',
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES quote_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items (quote_id, sort_order);

ALTER TABLE invoices ADD COLUMN quote_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_quote_unique ON invoices (quote_id) WHERE quote_id IS NOT NULL;
