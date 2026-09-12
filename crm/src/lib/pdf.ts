import PDFDocument from 'pdfkit';
import type { QuoteRecord } from '@/lib/quote-types';

const NAVY = '#071747';
const ORANGE = '#ff5a3d';
const PALE = '#f4f9fb';
const BLUE_ROW = '#dcecf8';
const GREY_ROW = '#d7d7d7';

function zar(value: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value || 0);
}

function dateLabel(value?: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return new Intl.DateTimeFormat('en-GB').format(date);
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size = 62) {
  doc.save().circle(x + size / 2, y + size / 2, size / 2).fillAndStroke(ORANGE, '#000000');
  doc.fillColor('#000000');
  const cx = x + size / 2;
  doc.rect(cx - 19, y + 18, 16, 24).fill();
  doc.rect(cx + 3, y + 18, 16, 24).fill();
  doc.polygon([cx - 3, y + 25], [cx + 3, y + 31], [cx - 3, y + 37]).fill();
  doc.rect(cx - 3, y + 38, 6, 16).fill();
  doc.rect(cx - 10, y + 53, 20, 4).fill();
  doc.restore();
}

function companyHeader(doc: PDFKit.PDFDocument, quote: QuoteRecord, compact = false) {
  const settings = quote.settings;
  doc.rect(0, 0, doc.page.width, compact ? 142 : 94).fill(PALE);
  drawLogo(doc, 42, 19, compact ? 48 : 58);
  if (compact) {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(settings.tradingName, 42, 76);
    doc.font('Helvetica-Oblique').fontSize(9).text(`A ${settings.companyName} Company`, 42, 92);
    doc.font('Helvetica').fontSize(8).text(`Reg: ${settings.registrationNumber}`, 42, 107);
    doc.text(`${settings.email}  |  ${settings.website}  |  ${settings.phone}`, 42, 121);
  }
}

function draftWatermark(doc: PDFKit.PDFDocument) {
  const cursorX = doc.x;
  const cursorY = doc.y;
  doc.save().fillColor('#d1d5db').fillOpacity(0.24).font('Helvetica-Bold').fontSize(74)
    .rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] })
    .text('DRAFT', 70, doc.page.height / 2 - 35, { width: 470, align: 'center' });
  doc.restore();
  doc.x = cursorX;
  doc.y = cursorY;
}

function drawLabelValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text(label, x, y, { continued: true, width });
  doc.font('Helvetica').text(value || '-', { width });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number, quote: QuoteRecord, draft: boolean) {
  if (doc.y + height <= doc.page.height - 50) return;
  doc.addPage();
  companyHeader(doc, quote, true);
  doc.y = 158;
  if (draft) draftWatermark(doc);
}

function drawTable(doc: PDFKit.PDFDocument, quote: QuoteRecord, draft: boolean) {
  const x = 42;
  const widths = [217, 82, 62, 68, 82];
  const totalWidth = widths.reduce((sum, value) => sum + value, 0);
  const row = (cells: string[], fill: string | null, bold = false, height = 24) => {
    ensureSpace(doc, height + 4, quote, draft);
    const y = doc.y;
    if (fill) doc.rect(x, y, totalWidth, height).fill(fill);
    doc.strokeColor('#111111').lineWidth(0.7);
    let cursor = x;
    for (let index = 0; index < widths.length; index += 1) {
      doc.rect(cursor, y, widths[index], height).stroke();
      doc.fillColor('#111111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
        .text(cells[index] || '', cursor + 4, y + 7, {
          width: widths[index] - 8,
          align: index === 0 || index === 3 ? 'left' : 'right',
          ellipsis: true,
        });
      cursor += widths[index];
    }
    doc.y = y + height;
  };

  row(['Item', 'Rate', 'Quantity', 'Unit', 'Cost'], null, true, 25);
  for (const section of quote.sections) {
    row([section.title, '', '', '', ''], GREY_ROW, true, 23);
    let sectionTotal = 0;
    for (const item of section.items) {
      sectionTotal += item.amount;
      row([item.description, zar(item.rate), Number(item.quantity).toLocaleString('en-ZA'), item.unit, zar(item.amount)], null);
    }
    row(['Subtotal', '', '', '', zar(sectionTotal)], BLUE_ROW, true, 23);
  }
  row(['', '', '', 'Subtotal', zar(quote.subtotal)], null, true);
  if (quote.vatEnabled) row(['', '', '', `VAT ${quote.vatRate}%`, zar(quote.vatAmount)], null, true);
  row(['', '', '', 'Grand Total', zar(quote.total)], BLUE_ROW, true, 27);
}

function drawTerms(doc: PDFKit.PDFDocument, quote: QuoteRecord, draft: boolean) {
  const newTermsPage = () => {
    doc.addPage();
    companyHeader(doc, quote, true);
    if (draft) draftWatermark(doc);
    doc.y = 158;
  };
  newTermsPage();
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13)
    .text('TERMS AND CONDITIONS OF SERVICE: 3D LASER SCANNING', 42, doc.y, { width: 511 });
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(9).text(`${quote.settings.companyName} t/a ${quote.settings.tradingName}`);
  doc.text(`Registration No: ${quote.settings.registrationNumber}`);
  doc.moveDown(1.2);

  quote.terms.forEach((term, index) => {
    if (index === 4) newTermsPage();
    const cursorX = doc.x;
    const cursorY = doc.y;
    const bodyHeight = doc.heightOfString(term.body, { width: 511, lineGap: 2 });
    doc.x = cursorX;
    doc.y = cursorY;
    if (index !== 4) ensureSpace(doc, bodyHeight + 35, quote, draft);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10.5).text(term.heading, 42, doc.y, { width: 511 });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).text(term.body, 42, doc.y, { width: 511, lineGap: 2 });
    doc.moveDown(0.9);
  });

  ensureSpace(doc, 135, quote, draft);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('ACCEPTANCE', 42, doc.y);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9.5)
    .text('I, the undersigned, accept this quotation and the terms governing the 3D laser scanning services.', 42, doc.y, { width: 511 });
  doc.moveDown(1.5).text('Signed: __________________________________________');
  doc.moveDown(1.2).text('Date: ____________________________________________');
  doc.moveDown(1.2).text('For (Client Name): ________________________________');
}

export function generateQuotePDF(quote: QuoteRecord, options: { draft?: boolean } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const draft = Boolean(options.draft);
      const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: quote.quoteNumber } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      companyHeader(doc, quote);
      if (draft) draftWatermark(doc);
      const settings = quote.settings;
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
        .text(`Quote number: ${quote.quoteNumber}`, 370, 48, { width: 183, align: 'right' });
      doc.font('Helvetica').text(`Quote issued on ${dateLabel(quote.issueDate)}`, 370, 63, { width: 183, align: 'right' });
      doc.text(`Valid for ${quote.validityDays} days`, 370, 77, { width: 183, align: 'right' });

      doc.rect(0, 100, doc.page.width, 130).fill(PALE);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(settings.tradingName, 42, 114);
      doc.font('Helvetica-Oblique').fontSize(9).text(`A ${settings.companyName} Company`, 42, 132);
      doc.font('Helvetica').fontSize(8.5).text(`Reg: ${settings.registrationNumber}`, 42, 148);
      doc.text(settings.email, 42, 167).text(settings.website, 42, 182);
      doc.font('Helvetica-Bold').text('Contact Person: ', 42, 198, { continued: true }).font('Helvetica').text(settings.contactName);
      doc.font('Helvetica-Bold').text('Cell: ', 42, 213, { continued: true }).font('Helvetica').text(settings.phone);

      drawLabelValue(doc, 'Quote to: ', quote.clientCompany || quote.clientContact, 300, 114, 253);
      drawLabelValue(doc, 'Contact Person: ', quote.clientContact, 300, 134, 253);
      drawLabelValue(doc, 'Email: ', quote.clientEmail, 300, 154, 253);
      drawLabelValue(doc, 'Cell: ', quote.clientPhone, 300, 174, 253);
      drawLabelValue(doc, 'Address: ', quote.clientAddress, 300, 194, 253);

      doc.y = 250;
      drawLabelValue(doc, 'Project: ', quote.project, 42, doc.y, 511);
      doc.moveDown(0.55);
      drawLabelValue(doc, 'Deliverables: ', quote.deliverablesSummary, 42, doc.y, 511);
      doc.moveDown(0.55);
      drawLabelValue(doc, 'Timeframe: ', quote.timeframe, 42, doc.y, 511);
      doc.moveDown(1.2);
      drawTable(doc, quote, draft);

      ensureSpace(doc, 125, quote, draft);
      doc.moveDown(1.5);
      drawLabelValue(doc, 'Payment reference: ', quote.paymentReference || quote.clientCompany || quote.clientContact, 42, doc.y, 511);
      doc.moveDown(1.1);
      drawLabelValue(doc, 'Bank: ', settings.bankName, 42, doc.y, 511);
      doc.moveDown(0.55);
      drawLabelValue(doc, 'Account name: ', settings.bankAccountName, 42, doc.y, 511);
      doc.moveDown(0.55);
      drawLabelValue(doc, 'Account number: ', settings.bankAccountNumber, 42, doc.y, 511);
      doc.moveDown(0.55);
      drawLabelValue(doc, 'Branch code: ', settings.bankBranchCode, 42, doc.y, 511);

      drawTerms(doc, quote, draft);
      const pages = doc.bufferedPageRange();
      for (let index = 0; index < pages.count; index += 1) {
        doc.switchToPage(index);
        doc.page.margins.bottom = 0;
        doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
          .text(`Page ${index + 1} of ${pages.count}  |  ${quote.quoteNumber}`, 42, doc.page.height - 24, {
            width: 511, align: 'center', lineBreak: false,
          });
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
