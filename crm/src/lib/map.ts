const OPEN_STATUSES = new Set(['new', 'pending', 'contacted', 'PENDING']);

export type MappedLead = Record<string, unknown> & {
  id: string;
  email: string;
  name: string;
  company: string;
  project: string;
  area: number;
  complexity: string;
  quoteTotal: number;
  estimateFormatted: string;
  estimateLow: number;
  estimateHigh: number;
  deliverables: string;
  rawEmail: string;
  fieldDays: number;
  processDays: number;
  createdAt: string;
  status: string;
  payload: Record<string, unknown>;
};

export function mapLead(row: Record<string, unknown> | null): MappedLead | null {
  if (!row) return null;
  const rawStatus = String(row.status || 'new');
  let status = 'PENDING';
  if (rawStatus === 'approved' || rawStatus === 'APPROVED') status = 'APPROVED';
  else if (rawStatus === 'sent' || rawStatus === 'SENT') status = 'SENT';
  else if (rawStatus === 'rejected' || rawStatus === 'REJECTED' || rawStatus === 'closed') status = 'REJECTED';
  else if (OPEN_STATUSES.has(rawStatus)) status = 'PENDING';

  const deliverables =
    (row.deliverables as string) ||
    (row.deliverables_json as string) ||
    '[]';

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(row.payload_json || row.payload || '{}')) || {};
  } catch {
    payload = {};
  }

  return {
    ...row,
    id: String(row.id || ''),
    email: String(row.email || ''),
    company: String(row.company || ''),
    project: String(row.project || ''),
    area: Number(row.area || 0),
    complexity: String(row.complexity || ''),
    name: (row.name as string) || (row.contact_name as string) || '',
    quoteTotal: Number(row.quoteTotal ?? row.estimate_zar ?? 0),
    estimateFormatted: String(row.estimate_formatted || row.estimateFormatted || ''),
    estimateLow: Number(row.estimate_low ?? row.estimateLow ?? 0),
    estimateHigh: Number(row.estimate_high ?? row.estimateHigh ?? 0),
    deliverables,
    payload,
    rawEmail: (row.rawEmail as string) || (row.raw_email as string) || '',
    fieldDays: Number(row.fieldDays ?? row.field_days ?? 0),
    processDays: Number(row.processDays ?? row.process_days ?? 0),
    createdAt: (row.createdAt as string) || (row.created_at as string) || '',
    status,
  };
}

export type MappedInvoice = {
  id: string; leadId: string; quoteId: string; clientName: string; project: string;
  amount: number; status: 'UNPAID' | 'PAID'; createdAt: string;
};

export type MappedExpense = { id: string; vendor: string; amount: number; category: string; date: string; status: string };

export function mapInvoice(row: Record<string, unknown>): MappedInvoice {
  return {
    id: String(row.id || ''),
    leadId: String(row.lead_id || row.leadId || ''),
    quoteId: String(row.quote_id || row.quoteId || ''),
    clientName: (row.clientName as string) || (row.client_name as string) || '',
    project: String(row.project || ''),
    amount: Number(row.amount || 0),
    status: String(row.status || 'UNPAID') as MappedInvoice['status'],
    createdAt: (row.createdAt as string) || (row.created_at as string) || '',
  };
}

export function mapExpense(row: Record<string, unknown>): MappedExpense {
  return {
    id: String(row.id || ''), vendor: String(row.supplier || row.vendor || ''), amount: Number(row.total_cents || 0)/100,
    category: String(row.category_name || row.category || ''), date: String(row.transaction_date || row.date || ''), status:String(row.status || 'POSTED'),
  };
}

export function toDbStatus(uiStatus: 'PENDING' | 'APPROVED' | 'SENT' | 'REJECTED') {
  if (uiStatus === 'APPROVED') return 'approved';
  if (uiStatus === 'SENT') return 'sent';
  if (uiStatus === 'REJECTED') return 'rejected';
  return 'pending';
}
