'use client';

import { useMemo, useState } from 'react';
import { Download, Plus, RefreshCw, Save, Send, Trash2, XCircle } from 'lucide-react';
import { rejectLead } from '@/app/actions';
import { issueQuote, saveQuoteDraft } from '@/app/quote-actions';
import { calculateDraftTotals, generateQuoteDraft } from '@/lib/quote-builder';
import type { QuoteDraftInput, QuoteRecord, QuoteSection, QuoteSettings } from '@/lib/quote-types';

type LeadProps = {
  id: string; email: string; name: string; company: string; project: string;
  area: number; complexity: string; deliverables: string; quoteTotal: number;
  fieldDays: number; processDays: number; payload?: Record<string, unknown>;
};

function zar(value: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value || 0);
}

function editableDraft(quote: QuoteRecord): QuoteDraftInput {
  return {
    id: quote.id, leadId: quote.leadId, clientCompany: quote.clientCompany,
    clientContact: quote.clientContact, clientEmail: quote.clientEmail, clientPhone: quote.clientPhone,
    clientAddress: quote.clientAddress, project: quote.project, deliverablesSummary: quote.deliverablesSummary,
    timeframe: quote.timeframe, validityDays: quote.validityDays, paymentReference: quote.paymentReference,
    vatEnabled: quote.vatEnabled, vatRate: quote.vatRate, sections: quote.sections,
  };
}

export default function QuoteEditor({
  lead, settings, existingQuote,
}: { lead: LeadProps; settings: QuoteSettings; existingQuote?: QuoteRecord }) {
  const initial = existingQuote ? editableDraft(existingQuote) : generateQuoteDraft(lead, settings);
  const [draft, setDraft] = useState<QuoteDraftInput>(initial);
  const [quoteNumber, setQuoteNumber] = useState(existingQuote?.quoteNumber || 'Allocated on first save');
  const [status, setStatus] = useState(existingQuote?.status || 'DRAFT');
  const [pending, setPending] = useState<'save' | 'preview' | 'issue' | 'reject' | null>(null);
  const [message, setMessage] = useState('');
  const totals = useMemo(
    () => calculateDraftTotals(draft.sections, draft.vatEnabled, draft.vatRate),
    [draft.sections, draft.vatEnabled, draft.vatRate]
  );
  const locked = status === 'ISSUED';

  const setField = <K extends keyof QuoteDraftInput>(key: K, value: QuoteDraftInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function updateSection(sectionId: string, update: Partial<QuoteSection>) {
    setField('sections', draft.sections.map((section) => section.id === sectionId ? { ...section, ...update } : section));
  }

  function updateItem(sectionId: string, itemId: string, key: string, value: string | number) {
    setField('sections', draft.sections.map((section) => section.id !== sectionId ? section : {
      ...section,
      items: section.items.map((row) => row.id === itemId
        ? { ...row, [key]: value, amount: key === 'rate' ? Number(value) * row.quantity : key === 'quantity' ? row.rate * Number(value) : row.amount }
        : row),
    }));
  }

  async function persist() {
    const result = await saveQuoteDraft(draft);
    setDraft((current) => ({ ...current, id: result.id }));
    setQuoteNumber(result.quoteNumber);
    return result;
  }

  async function run(kind: typeof pending, action: () => Promise<void>) {
    setPending(kind); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.'); }
    finally { setPending(null); }
  }

  if (locked && existingQuote) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div><p className="font-semibold text-emerald-900">Issued quote {existingQuote.quoteNumber}</p><p className="text-sm text-emerald-700">Grand total {zar(existingQuote.total)}</p></div>
        <a href={`/api/quotes/${existingQuote.id}/pdf?mode=issued`} target="_blank" className="inline-flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-4 py-2 text-sm font-medium text-emerald-800"><Download className="w-4 h-4" /> Download PDF</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs uppercase tracking-wide text-gray-500">Formal quote draft</p><p className="font-semibold text-gray-900">{quoteNumber}</p></div>
        <button type="button" className="inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-white" onClick={() => {
          if (confirm('Regenerate all line items from the questionnaire? Manual line edits will be replaced.')) setDraft(generateQuoteDraft(lead, settings));
        }}><RefreshCw className="w-4 h-4" /> Regenerate</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Client and project</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ['clientCompany', 'Company'], ['clientContact', 'Contact person'], ['clientEmail', 'Email'],
              ['clientPhone', 'Cell'], ['project', 'Project'], ['timeframe', 'Timeframe'],
              ['deliverablesSummary', 'Deliverables'], ['paymentReference', 'Payment reference'],
            ] as const).map(([key, label]) => (
              <label key={key} className={`text-xs font-medium text-gray-600 ${key === 'project' || key === 'deliverablesSummary' ? 'sm:col-span-2' : ''}`}>
                {label}<input value={String(draft[key] || '')} onChange={(event) => setField(key, event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white" />
              </label>
            ))}
            <label className="sm:col-span-2 text-xs font-medium text-gray-600">Client address<textarea value={draft.clientAddress} onChange={(event) => setField('clientAddress', event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white" rows={2} /></label>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Totals and tax</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-600">Validity (days)<input type="number" min="1" value={draft.validityDays} onChange={(event) => setField('validityDays', Number(event.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white" /></label>
            <label className="text-xs font-medium text-gray-600">VAT rate (%)<input type="number" min="0" step="0.01" disabled={!draft.vatEnabled} value={draft.vatRate} onChange={(event) => setField('vatRate', Number(event.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white disabled:bg-gray-100" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draft.vatEnabled} onChange={(event) => setField('vatEnabled', event.target.checked)} /> Add VAT to this quote</label>
          <div className="rounded-xl bg-white border p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><strong>{zar(totals.subtotal)}</strong></div>
            {draft.vatEnabled ? <div className="flex justify-between"><span>VAT {draft.vatRate}%</span><strong>{zar(totals.vatAmount)}</strong></div> : null}
            <div className="flex justify-between border-t pt-2 text-lg"><span>Grand total</span><strong>{zar(totals.total)}</strong></div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center"><h4 className="font-semibold text-gray-900">Itemized services</h4><button type="button" onClick={() => setField('sections', [...draft.sections, { id: crypto.randomUUID(), title: 'New section', items: [] }])} className="inline-flex items-center gap-1 text-sm text-cyan-700"><Plus className="w-4 h-4" /> Section</button></div>
        {draft.sections.map((section) => (
          <div key={section.id} className="bg-white border rounded-xl overflow-hidden">
            <div className="flex gap-2 items-center bg-gray-100 p-3">
              <input value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} className="flex-1 bg-transparent font-semibold min-w-0" />
              <button type="button" aria-label="Delete section" onClick={() => setField('sections', draft.sections.filter((candidate) => candidate.id !== section.id))}><Trash2 className="w-4 h-4 text-rose-500" /></button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[minmax(250px,1fr)_120px_100px_100px_110px_36px] gap-2 px-3 py-2 text-xs uppercase text-gray-400"><span>Description</span><span>Rate</span><span>Quantity</span><span>Unit</span><span className="text-right">Cost</span><span /></div>
                {section.items.map((row) => (
                  <div key={row.id} className="grid grid-cols-[minmax(250px,1fr)_120px_100px_100px_110px_36px] gap-2 px-3 py-2 border-t items-center">
                    <input value={row.description} onChange={(event) => updateItem(section.id, row.id, 'description', event.target.value)} className="border rounded px-2 py-2" />
                    <input type="number" min="0" step="0.01" value={row.rate} onChange={(event) => updateItem(section.id, row.id, 'rate', Number(event.target.value))} className="border rounded px-2 py-2" />
                    <input type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => updateItem(section.id, row.id, 'quantity', Number(event.target.value))} className="border rounded px-2 py-2" />
                    <input value={row.unit} onChange={(event) => updateItem(section.id, row.id, 'unit', event.target.value)} className="border rounded px-2 py-2" />
                    <span className="text-right font-medium">{zar(row.rate * row.quantity)}</span>
                    <button type="button" aria-label="Delete item" onClick={() => updateSection(section.id, { items: section.items.filter((candidate) => candidate.id !== row.id) })}><Trash2 className="w-4 h-4 text-rose-500" /></button>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => updateSection(section.id, { items: [...section.items, { id: crypto.randomUUID(), description: 'New item', rate: 0, quantity: 1, unit: 'Item', amount: 0 }] })} className="m-3 inline-flex items-center gap-1 text-sm text-cyan-700"><Plus className="w-4 h-4" /> Add item</button>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{message}</p> : null}
      <div className="flex flex-col sm:flex-row gap-2">
        <button disabled={pending !== null} onClick={() => run('save', async () => { await persist(); setMessage('Draft saved.'); })} className="inline-flex justify-center items-center gap-2 border bg-white rounded-lg px-4 py-3 text-sm font-medium"><Save className="w-4 h-4" /> {pending === 'save' ? 'Saving...' : 'Save draft'}</button>
        <button disabled={pending !== null} onClick={() => run('preview', async () => { const popup = window.open('', '_blank'); const saved = await persist(); if (popup) popup.location.href = `/api/quotes/${saved.id}/pdf?mode=draft`; })} className="inline-flex justify-center items-center gap-2 border bg-white rounded-lg px-4 py-3 text-sm font-medium"><Download className="w-4 h-4" /> {pending === 'preview' ? 'Preparing...' : 'Preview PDF'}</button>
        <button disabled={pending !== null} onClick={() => run('issue', async () => { if (!confirm('Issue and email this quote? Issued quotes cannot be edited.')) return; const saved = await persist(); await issueQuote(saved.id); setStatus('ISSUED'); setMessage('Quote issued, emailed, and added to invoices.'); })} className="inline-flex justify-center items-center gap-2 bg-cyan-600 text-white rounded-lg px-5 py-3 text-sm font-medium"><Send className="w-4 h-4" /> {pending === 'issue' ? 'Issuing...' : 'Issue & email'}</button>
        <button disabled={pending !== null} onClick={() => run('reject', async () => { await rejectLead(lead.id); })} className="inline-flex justify-center items-center gap-2 border border-rose-200 text-rose-600 rounded-lg px-4 py-3 text-sm"><XCircle className="w-4 h-4" /> Reject lead</button>
      </div>
    </div>
  );
}
