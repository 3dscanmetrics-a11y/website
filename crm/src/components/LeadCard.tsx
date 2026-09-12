'use client';

import { useState } from 'react';
import { Briefcase, ChevronDown, Clock, Ruler, Settings } from 'lucide-react';
import QuoteEditor from './QuoteEditor';
import type { QuoteRecord, QuoteSettings } from '@/lib/quote-types';

type Lead = {
  id: string;
  email: string;
  name: string;
  company: string;
  project: string;
  area: number;
  complexity: string;
  deliverables: string;
  quoteTotal: number;
  estimateFormatted?: string;
  estimateLow?: number;
  estimateHigh?: number;
  payload?: Record<string, unknown>;
  status: string;
  createdAt: string;
  rawEmail?: string;
  fieldDays: number;
  processDays: number;
};

function formatZAR(val: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(val || 0);
}

function deliverableList(raw: string) {
  try {
    return JSON.parse(raw || '[]').join(', ');
  } catch {
    return '';
  }
}

export default function LeadCard({
  lead, defaultOpen = false, settings, quote,
}: { lead: Lead; defaultOpen?: boolean; settings: QuoteSettings; quote?: QuoteRecord }) {
  const [open, setOpen] = useState(defaultOpen);
  const range = String(
    lead.payload?.publicEstimate || lead.estimateFormatted || formatZAR(lead.quoteTotal || 0)
  );
  const statusClass =
    lead.status === 'PENDING'
      ? 'bg-amber-100 text-amber-800'
      : lead.status === 'APPROVED' || lead.status === 'SENT'
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-rose-100 text-rose-800';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
      <button
        type="button"
        className="w-full text-left px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-50"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusClass}`}>
          {lead.status}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{lead.project || 'Unknown Project'}</p>
          <p className="text-sm text-gray-500 truncate">
            {lead.name}
            {lead.company ? ` · ${lead.company}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0 max-w-[42%] sm:max-w-none">
          <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug">{range}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">{new Date(lead.createdAt).toLocaleString()}</p>
        </div>
      </button>

      {open ? (
        <div className="border-t border-gray-100">
          <div className="flex flex-col md:flex-row">
            <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-gray-100 flex-1">
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <span className="font-semibold text-gray-900">Client:</span> {lead.name} ({lead.company})
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Email:</span> {lead.email}
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Original Email Context
                </h4>
                <div className="bg-gray-50 rounded p-3 text-sm text-gray-600 max-h-32 overflow-y-auto font-mono">
                  {lead.rawEmail?.substring(0, 300)}...
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 md:p-6 md:w-96">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                <Settings className="w-4 h-4 mr-1" /> AI Extracted Parameters
              </h4>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-500 flex items-center">
                    <Ruler className="w-4 h-4 mr-2" /> Area
                  </span>
                  <span className="font-medium text-gray-900">{lead.area} sqm</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500 flex items-center">
                    <Settings className="w-4 h-4 mr-2" /> Complexity
                  </span>
                  <span className="font-medium text-gray-900">{lead.complexity}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500 flex items-center">
                    <Briefcase className="w-4 h-4 mr-2" /> Deliverables
                  </span>
                  <span className="font-medium text-gray-900 truncate ml-4">{deliverableList(lead.deliverables)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500 flex items-center">
                    <Clock className="w-4 h-4 mr-2" /> Est. Field Time
                  </span>
                  <span className="font-medium text-gray-900">{lead.fieldDays} Days</span>
                </li>
              </ul>
              <div className="mt-6 p-4 bg-white rounded-lg border border-cyan-100 shadow-sm">
                <p className="text-xs text-cyan-600 font-semibold uppercase">Indicative range</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{range}</p>
              </div>
            </div>
          </div>
          {lead.status === 'PENDING' || quote ? (
            <div className="border-t border-gray-100 bg-gray-50 p-4 md:p-6">
              <QuoteEditor
                lead={{
                  id: lead.id,
                  email: lead.email,
                  name: lead.name,
                  company: lead.company,
                  project: lead.project,
                  area: lead.area,
                  complexity: lead.complexity,
                  deliverables: lead.deliverables,
                  quoteTotal: lead.quoteTotal,
                  fieldDays: lead.fieldDays,
                  processDays: lead.processDays,
                  payload: lead.payload,
                }}
                settings={settings}
                existingQuote={quote}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
