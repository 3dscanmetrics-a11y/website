import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateQuotePDF } from '@/lib/pdf';
import { getQuote } from '@/lib/quote-repository';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await getDb();
  const quote = await getQuote(db, id);
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const mode = new URL(request.url).searchParams.get('mode');
  const draft = quote.status !== 'ISSUED' || mode === 'draft';
  const pdf = await generateQuotePDF({ ...quote, issueDate: quote.issueDate || new Date().toISOString().slice(0, 10) }, { draft });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quote.quoteNumber}${draft ? '-DRAFT' : ''}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
