'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';
import { generateQuotePDF } from '@/lib/pdf';
import { calculateDraftTotals } from '@/lib/quote-builder';
import { getQuote, getQuoteSettings } from '@/lib/quote-repository';
import type { QuoteDraftInput, QuoteSection, QuoteSettings, QuoteTerm } from '@/lib/quote-types';

function cleanSections(sections: QuoteSection[]) {
  return sections
    .map((section) => ({
      id: section.id || randomUUID(),
      title: String(section.title || '').trim(),
      items: section.items
        .map((row) => ({
          id: row.id || randomUUID(), description: String(row.description || '').trim(),
          rate: Number(row.rate || 0), quantity: Number(row.quantity || 0),
          unit: String(row.unit || 'Item').trim(), amount: Number(row.rate || 0) * Number(row.quantity || 0),
        }))
        .filter((row) => row.description && row.quantity >= 0 && row.rate >= 0),
    }))
    .filter((section) => section.title && section.items.length);
}

async function allocateQuoteNumber(db: CloudflareEnv['DB']) {
  const year = new Date().getFullYear();
  await db.prepare('INSERT OR IGNORE INTO quote_sequences (year, last_number) VALUES (?, 0)').bind(year).run();
  const row = await db.prepare(
    'UPDATE quote_sequences SET last_number = last_number + 1 WHERE year = ? RETURNING last_number'
  ).bind(year).first<{ last_number: number }>();
  if (!row) throw new Error('Could not allocate a quote number.');
  return `3DSM-Q-${year}-${String(row.last_number).padStart(4, '0')}`;
}

export async function saveQuoteDraft(input: QuoteDraftInput) {
  const db = await getDb();
  const settings = await getQuoteSettings(db);
  const sections = cleanSections(input.sections || []);
  if (!input.leadId || !input.clientContact || !input.clientEmail || !input.project || !sections.length) {
    throw new Error('Client, email, project and at least one quote item are required.');
  }
  const totals = calculateDraftTotals(sections, Boolean(input.vatEnabled), Number(input.vatRate));
  const existing = input.id ? await getQuote(db, input.id) : null;
  if (existing?.status === 'ISSUED') throw new Error('Issued quotes cannot be edited. Create a revision instead.');
  const id = existing?.id || randomUUID();
  const quoteNumber = existing?.quoteNumber || await allocateQuoteNumber(db);

  const statements = [
    db.prepare(
      `INSERT INTO quotes (
        id, quote_number, lead_id, status, client_company, client_contact, client_email,
        client_phone, client_address, project, deliverables_summary, timeframe, validity_days,
        payment_reference, vat_enabled, vat_rate, subtotal, vat_amount, total
      ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        client_company=excluded.client_company, client_contact=excluded.client_contact,
        client_email=excluded.client_email, client_phone=excluded.client_phone,
        client_address=excluded.client_address, project=excluded.project,
        deliverables_summary=excluded.deliverables_summary, timeframe=excluded.timeframe,
        validity_days=excluded.validity_days, payment_reference=excluded.payment_reference,
        vat_enabled=excluded.vat_enabled, vat_rate=excluded.vat_rate, subtotal=excluded.subtotal,
        vat_amount=excluded.vat_amount, total=excluded.total, updated_at=datetime('now')`
    ).bind(
      id, quoteNumber, input.leadId, input.clientCompany || '', input.clientContact,
      input.clientEmail, input.clientPhone || '', input.clientAddress || '', input.project,
      input.deliverablesSummary || '', input.timeframe || '', Number(input.validityDays || settings.validityDays),
      input.paymentReference || input.clientCompany || input.clientContact,
      input.vatEnabled ? 1 : 0, Number(input.vatRate || settings.vatRate),
      totals.subtotal, totals.vatAmount, totals.total
    ),
    db.prepare('DELETE FROM quote_items WHERE quote_id = ?').bind(id),
    db.prepare('DELETE FROM quote_sections WHERE quote_id = ?').bind(id),
  ];
  sections.forEach((section, sectionIndex) => {
    statements.push(db.prepare(
      'INSERT INTO quote_sections (id, quote_id, title, sort_order) VALUES (?, ?, ?, ?)'
    ).bind(section.id, id, section.title, sectionIndex));
    section.items.forEach((row, itemIndex) => {
      statements.push(db.prepare(
        `INSERT INTO quote_items (id, quote_id, section_id, description, rate, quantity, unit, amount, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(row.id, id, section.id, row.description, row.rate, row.quantity, row.unit, row.amount, itemIndex));
    });
  });
  await db.batch(statements);
  revalidatePath('/');
  return { id, quoteNumber, ...totals };
}

export async function issueQuote(id: string) {
  const db = await getDb();
  const quote = await getQuote(db, id);
  if (!quote) throw new Error('Quote not found.');
  if (quote.status === 'ISSUED') return { id: quote.id, quoteNumber: quote.quoteNumber, alreadyIssued: true };
  if (!quote.sections.length || quote.total <= 0) throw new Error('The quote must contain priced line items.');
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured; the quote was not issued.');

  const settings = await getQuoteSettings(db);
  const issueDate = new Date().toISOString().slice(0, 10);
  const issuedQuote = { ...quote, issueDate, settings, terms: settings.terms };
  const pdf = await generateQuotePDF(issuedQuote);
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `3D Scan Metrics <${settings.email}>`,
    to: quote.clientEmail,
    subject: `Formal Quote ${quote.quoteNumber}: ${quote.project}`,
    html: `<p>Hi ${quote.clientContact},</p><p>Please find attached formal quote <strong>${quote.quoteNumber}</strong> for ${quote.project}.</p><p>This quote is valid for ${quote.validityDays} days.</p><p>Kind regards,<br>${settings.tradingName}</p>`,
    attachments: [{ filename: `${quote.quoteNumber}.pdf`, content: pdf }],
  }, { idempotencyKey: `issue-${quote.id}` });

  await db.batch([
    db.prepare(
      `UPDATE quotes SET status='ISSUED', issue_date=?, issued_at=datetime('now'),
       settings_snapshot=?, terms_snapshot=?, updated_at=datetime('now') WHERE id=? AND status='DRAFT'`
    ).bind(issueDate, JSON.stringify(settings), JSON.stringify(settings.terms), id),
    db.prepare("UPDATE leads SET status='sent', updated_at=datetime('now') WHERE id=?").bind(quote.leadId),
    db.prepare(
      `INSERT OR IGNORE INTO invoices (id, lead_id, quote_id, client_name, project, amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'UNPAID')`
    ).bind(randomUUID(), quote.leadId, quote.id, quote.clientCompany || quote.clientContact, quote.project, quote.total),
  ]);
  revalidatePath('/');
  return { id: quote.id, quoteNumber: quote.quoteNumber, alreadyIssued: false };
}

export async function saveQuoteSettings(input: QuoteSettings) {
  const db = await getDb();
  const terms: QuoteTerm[] = (input.terms || []).filter((term) => term.heading.trim() && term.body.trim());
  if (!input.companyName || !input.tradingName || !input.email || !input.bankAccountNumber || !terms.length) {
    throw new Error('Company, email, bank account and terms are required.');
  }
  await db.prepare(
    `UPDATE quote_settings SET company_name=?, trading_name=?, registration_number=?, email=?, website=?,
     contact_name=?, phone=?, bank_name=?, bank_account_name=?, bank_account_number=?, bank_branch_code=?,
     validity_days=?, deposit_percent=?, vat_rate=?, vat_default_enabled=?, terms_json=?, updated_at=datetime('now')
     WHERE id=1`
  ).bind(
    input.companyName, input.tradingName, input.registrationNumber, input.email, input.website,
    input.contactName, input.phone, input.bankName, input.bankAccountName, input.bankAccountNumber,
    input.bankBranchCode, input.validityDays, input.depositPercent, input.vatRate,
    input.vatDefaultEnabled ? 1 : 0, JSON.stringify(terms)
  ).run();
  revalidatePath('/');
  return { ok: true };
}
