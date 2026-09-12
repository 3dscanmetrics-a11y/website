'use server';
import { getDb } from '@/lib/db';
import { mapExpense, mapInvoice, mapLead, toDbStatus } from '@/lib/map';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { getQuotes as readQuotes, getQuoteSettings as readQuoteSettings } from '@/lib/quote-repository';

export async function getLeads() {
  const db = await getDb();
  const { results } = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all<Record<string, unknown>>();
  return (results ?? []).map((row) => mapLead(row)!);
}

export async function getInvoices() {
  const db = await getDb();
  const { results } = await db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all<Record<string, unknown>>();
  return (results ?? []).map(mapInvoice);
}

export async function getExpenses() {
  const db = await getDb();
  const { results } = await db.prepare('SELECT * FROM expenses ORDER BY transaction_date DESC').all<Record<string, unknown>>();
  return (results ?? []).map(mapExpense);
}

export async function getQuoteData() {
  const db = await getDb();
  return readQuotes(db);
}

export async function getQuoteSettings() {
  const db = await getDb();
  return readQuoteSettings(db);
}

export async function addExpense(vendor: string, amount: number, category: string) {
  const db = await getDb();
  const cat = await db.prepare('SELECT id FROM expense_categories WHERE name=?').bind(category).first<{id:string}>();
  await db
    .prepare("INSERT INTO expenses (id,supplier,description,transaction_date,category_id,amount_ex_vat_cents,total_cents,status,source) VALUES (?,?,?,date('now'),?,?,?,'POSTED','LEGACY_UI')")
    .bind(randomUUID(), vendor, vendor, cat?.id || null, Math.round(amount*100), Math.round(amount*100))
    .run();
  revalidatePath('/');
}

export async function markInvoicePaid(id: string) {
  const db = await getDb();
  await db.prepare("UPDATE invoices SET status = 'PAID' WHERE id = ?").bind(id).run();
  revalidatePath('/');
}

export async function rejectLead(id: string) {
  const db = await getDb();
  await db
    .prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(toDbStatus('REJECTED'), id)
    .run();
  revalidatePath('/');
}
