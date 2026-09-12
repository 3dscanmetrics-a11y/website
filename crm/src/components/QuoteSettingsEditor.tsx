'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { saveQuoteSettings } from '@/app/quote-actions';
import type { QuoteSettings } from '@/lib/quote-types';

export default function QuoteSettingsEditor({ initial }: { initial: QuoteSettings }) {
  const [settings, setSettings] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const set = <K extends keyof QuoteSettings>(key: K, value: QuoteSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const fields = [
    ['companyName', 'Legal company name'], ['tradingName', 'Trading name'], ['registrationNumber', 'Registration number'],
    ['email', 'Quote email'], ['website', 'Website'], ['contactName', 'Contact person'], ['phone', 'Phone'],
    ['bankName', 'Bank'], ['bankAccountName', 'Account name'], ['bankAccountNumber', 'Account number'], ['bankBranchCode', 'Branch code'],
  ] as const;
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-5 md:p-6">
        <h3 className="font-bold text-lg mb-4">Company and banking details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {fields.map(([key, label]) => <label key={key} className="text-sm text-gray-600">{label}<input value={String(settings[key])} onChange={(event) => set(key, event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm" /></label>)}
        </div>
      </div>
      <div className="bg-white border rounded-xl p-5 md:p-6">
        <h3 className="font-bold text-lg mb-4">Quote defaults</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="text-sm text-gray-600">Validity days<input type="number" value={settings.validityDays} onChange={(event) => set('validityDays', Number(event.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2.5" /></label>
          <label className="text-sm text-gray-600">Deposit %<input type="number" value={settings.depositPercent} onChange={(event) => set('depositPercent', Number(event.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2.5" /></label>
          <label className="text-sm text-gray-600">VAT rate %<input type="number" value={settings.vatRate} onChange={(event) => set('vatRate', Number(event.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2.5" /></label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.vatDefaultEnabled} onChange={(event) => set('vatDefaultEnabled', event.target.checked)} /> Enable VAT by default for new quotes</label>
      </div>
      <div className="bg-white border rounded-xl p-5 md:p-6">
        <h3 className="font-bold text-lg mb-4">Terms and conditions</h3>
        <div className="space-y-4">{settings.terms.map((term, index) => <div key={index} className="border rounded-lg p-3"><input value={term.heading} onChange={(event) => set('terms', settings.terms.map((value, i) => i === index ? { ...value, heading: event.target.value } : value))} className="w-full font-semibold mb-2" /><textarea rows={5} value={term.body} onChange={(event) => set('terms', settings.terms.map((value, i) => i === index ? { ...value, body: event.target.value } : value))} className="w-full border rounded-lg p-3 text-sm" /></div>)}</div>
      </div>
      <button onClick={async () => { setState('saving'); try { await saveQuoteSettings(settings); setState('saved'); } catch { setState('error'); } }} className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-lg px-5 py-3"><Save className="w-4 h-4" /> {state === 'saving' ? 'Saving...' : 'Save settings'}</button>
      {state === 'saved' ? <span className="ml-3 text-sm text-emerald-600">Settings saved.</span> : null}{state === 'error' ? <span className="ml-3 text-sm text-rose-600">Could not save settings.</span> : null}
    </div>
  );
}
