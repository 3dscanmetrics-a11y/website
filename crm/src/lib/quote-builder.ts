import { calculateEstimateRange, DEFAULT_PRICING } from '@/lib/pricing';
import type { QuoteDraftInput, QuoteItem, QuoteSection, QuoteSettings } from '@/lib/quote-types';

type LeadForQuote = {
  id: string;
  email: string;
  name: string;
  company: string;
  project: string;
  area: number;
  complexity: string;
  deliverables: string;
  fieldDays: number;
  processDays: number;
  payload?: Record<string, unknown>;
};

const labelForDeliverable: Record<string, string> = {
  raw: 'Raw registered point cloud',
  viewer: 'Web viewer / virtual tour preparation',
  cad: '2D CAD drawings',
  topo: 'Topographical outputs',
  bim: '3D BIM / Revit model',
};

function item(description: string, rate: number, quantity = 1, unit = 'Item'): QuoteItem {
  return { id: crypto.randomUUID(), description, rate, quantity, unit, amount: rate * quantity };
}

function parseDeliverables(raw: string, payload: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return Array.isArray(payload.deliverables) ? payload.deliverables.map(String) : [];
}

export function generateQuoteDraft(lead: LeadForQuote, settings: QuoteSettings): QuoteDraftInput {
  const payload = lead.payload || {};
  const deliverables = parseDeliverables(lead.deliverables, payload);
  const access = String(payload.access || 'Standard business hours only');
  const accuracy = String(payload.accuracy || 'Standard');
  const bimLevel = String(payload.bimLevel || payload.lod || '300');
  const range = calculateEstimateRange(DEFAULT_PRICING, {
    area: lead.area,
    complexity: lead.complexity,
    deliverables,
    access,
    accuracy,
    bimLevel,
  });
  const b = range.breakdown;
  const rawAreaCost = lead.area * b.baseRate;
  const siteAdjustment = rawAreaCost * (b.siteMult - 1);
  const preAccess = rawAreaCost * b.siteMult + b.flatFee;
  const accessAdjustment = preAccess * (b.accessMult - 1);
  const preAccuracyField = preAccess * b.accessMult;
  const accuracyFieldAdjustment = preAccuracyField * (b.accuracyMult - 1);

  const fieldItems = [
    item('On-site 3D laser scanning', b.baseRate, lead.area, 'Sqm'),
    ...(siteAdjustment > 0 ? [item(`Site environment adjustment - ${lead.complexity}`, siteAdjustment)] : []),
    item('Site establishment and mobilisation', b.flatFee),
    ...(accessAdjustment > 0 ? [item(`Access adjustment - ${access}`, accessAdjustment)] : []),
    ...(accuracyFieldAdjustment > 0
      ? [item(`High-precision field capture adjustment - ${accuracy}`, accuracyFieldAdjustment)]
      : []),
  ];

  const processingItems: QuoteItem[] = [];
  const processingBase = rawAreaCost * DEFAULT_PRICING.processing_base * b.accuracyMult;
  processingItems.push(item('Point cloud registration and QA', processingBase));
  for (const id of deliverables) {
    if (id === 'raw') continue;
    const multiplier = DEFAULT_PRICING.deliverable_multipliers[id] || 0;
    const lodMultiplier = id === 'bim' ? b.lodMult : 1;
    const amount = rawAreaCost * multiplier * lodMultiplier * b.accuracyMult;
    if (amount > 0) {
      const suffix = id === 'bim' ? ` LOD ${bimLevel}` : '';
      processingItems.push(item(`${labelForDeliverable[id] || id}${suffix}`, amount));
    }
  }

  const sections: QuoteSection[] = [
    { id: crypto.randomUUID(), title: '1. 3D Laser Scanning', items: fieldItems },
    { id: crypto.randomUUID(), title: '2. Processing and Deliverables', items: processingItems },
  ];
  const generated = sections.flatMap((section) => section.items).reduce((sum, row) => sum + row.amount, 0);
  if (generated < range.mid) {
    sections[1].items.push(item('Minimum project charge adjustment', range.mid - generated));
  }

  return {
    leadId: lead.id,
    clientCompany: lead.company || '',
    clientContact: lead.name || '',
    clientEmail: lead.email || '',
    clientPhone: String(payload.phone || ''),
    clientAddress: String(payload.address || payload.location || payload.site_location || ''),
    project: lead.project || '3D Laser Scanning Project',
    deliverablesSummary: deliverables.map((id) => labelForDeliverable[id] || id).join(', '),
    timeframe: `${Math.max(lead.fieldDays || range.fieldDays, lead.processDays || range.processDays)} Days`,
    validityDays: settings.validityDays,
    paymentReference: lead.company || lead.name || 'Client name',
    vatEnabled: settings.vatDefaultEnabled,
    vatRate: settings.vatRate,
    sections,
  };
}

export function calculateDraftTotals(sections: QuoteSection[], vatEnabled: boolean, vatRate: number) {
  const subtotal = sections
    .flatMap((section) => section.items)
    .reduce((sum, row) => sum + Number(row.rate || 0) * Number(row.quantity || 0), 0);
  const vatAmount = vatEnabled ? subtotal * (Number(vatRate || 0) / 100) : 0;
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}
