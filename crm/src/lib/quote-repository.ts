import type { QuoteRecord, QuoteSection, QuoteSettings, QuoteTerm } from '@/lib/quote-types';

type Db = CloudflareEnv['DB'];

const fallbackTerms: QuoteTerm[] = [
  { heading: '1. DEFINITIONS', body: 'The Company refers to Freelance Geomatics ZA (Pty) Ltd. The Client refers to the entity requesting the services.' },
  { heading: '2. QUOTATION VALIDITY', body: 'This quotation is valid for the stated period. Changes in area, access, scope or level of detail require a variation order.' },
  { heading: '3. PAYMENT TERMS', body: 'A 50% deposit is required to book the scanning team. The balance is due before final deliverables are released.' },
  { heading: '4. SITE ACCESS AND SCANNING CONDITIONS', body: 'The Client must provide safe, stable and unobstructed site access. Laser scanning captures visible surfaces only.' },
  { heading: '5. DELIVERABLES AND DATA', body: 'Deliverables are supplied in the quoted formats. Raw scan data is retained for 6 months.' },
  { heading: '6. EXCLUSIONS', body: 'Unless itemized, services exclude sub-surface investigation, destructive testing and confined-space scanning.' },
  { heading: '7. INTELLECTUAL PROPERTY', body: 'Deliverables remain Company property until full payment, after which the Client receives a perpetual project licence.' },
];

function parseJson<T>(value: unknown, fallback: T): T {
  try { return value ? JSON.parse(String(value)) as T : fallback; } catch { return fallback; }
}

export function mapSettings(row: Record<string, unknown>): QuoteSettings {
  return {
    companyName: String(row.company_name || ''), tradingName: String(row.trading_name || ''),
    registrationNumber: String(row.registration_number || ''), email: String(row.email || ''),
    website: String(row.website || ''), contactName: String(row.contact_name || ''), phone: String(row.phone || ''),
    bankName: String(row.bank_name || ''), bankAccountName: String(row.bank_account_name || ''),
    bankAccountNumber: String(row.bank_account_number || ''), bankBranchCode: String(row.bank_branch_code || ''),
    validityDays: Number(row.validity_days || 90), depositPercent: Number(row.deposit_percent || 50),
    vatRate: Number(row.vat_rate || 15), vatDefaultEnabled: Boolean(row.vat_default_enabled),
    terms: parseJson<QuoteTerm[]>(row.terms_json, fallbackTerms),
  };
}

export async function getQuoteSettings(db: Db): Promise<QuoteSettings> {
  const row = await db.prepare('SELECT * FROM quote_settings WHERE id = 1').first<Record<string, unknown>>();
  if (!row) throw new Error('Quote settings are not initialized. Apply migration 0004.');
  return mapSettings(row);
}

export async function getQuotes(db: Db): Promise<QuoteRecord[]> {
  const [quotesResult, sectionsResult, itemsResult] = await Promise.all([
    db.prepare('SELECT * FROM quotes ORDER BY created_at DESC').all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM quote_sections ORDER BY sort_order').all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM quote_items ORDER BY sort_order').all<Record<string, unknown>>(),
  ]);
  const sectionsByQuote = new Map<string, QuoteSection[]>();
  for (const row of sectionsResult.results || []) {
    const section: QuoteSection = { id: String(row.id), title: String(row.title), items: [] };
    const quoteId = String(row.quote_id);
    sectionsByQuote.set(quoteId, [...(sectionsByQuote.get(quoteId) || []), section]);
  }
  for (const row of itemsResult.results || []) {
    const sections = sectionsByQuote.get(String(row.quote_id)) || [];
    const section = sections.find((candidate) => candidate.id === String(row.section_id));
    section?.items.push({
      id: String(row.id), description: String(row.description), rate: Number(row.rate),
      quantity: Number(row.quantity), unit: String(row.unit), amount: Number(row.amount),
    });
  }
  const liveSettings = await getQuoteSettings(db);
  return (quotesResult.results || []).map((row) => ({
    id: String(row.id), quoteNumber: String(row.quote_number), leadId: String(row.lead_id),
    status: String(row.status) as QuoteRecord['status'], clientCompany: String(row.client_company || ''),
    clientContact: String(row.client_contact || ''), clientEmail: String(row.client_email || ''),
    clientPhone: String(row.client_phone || ''), clientAddress: String(row.client_address || ''),
    project: String(row.project || ''), deliverablesSummary: String(row.deliverables_summary || ''),
    timeframe: String(row.timeframe || ''), issueDate: String(row.issue_date || ''),
    validityDays: Number(row.validity_days || 90), paymentReference: String(row.payment_reference || ''),
    vatEnabled: Boolean(row.vat_enabled), vatRate: Number(row.vat_rate || 0), subtotal: Number(row.subtotal || 0),
    vatAmount: Number(row.vat_amount || 0), total: Number(row.total || 0),
    sections: sectionsByQuote.get(String(row.id)) || [],
    settings: parseJson<QuoteSettings>(row.settings_snapshot, liveSettings),
    terms: parseJson<QuoteTerm[]>(row.terms_snapshot, liveSettings.terms),
  }));
}

export async function getQuote(db: Db, id: string): Promise<QuoteRecord | null> {
  return (await getQuotes(db)).find((quote) => quote.id === id) || null;
}
