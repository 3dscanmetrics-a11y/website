import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateQuotePDF } from '../src/lib/pdf';
import type { QuoteRecord } from '../src/lib/quote-types';

const settings = {
  companyName: 'Freelance Geomatics ZA (Pty) Ltd', tradingName: '3D Scan Metrics Laser Scanning',
  registrationNumber: '2018/643721/07', email: 'isaiah@3dscanmetrics.co.za',
  website: 'www.3dscanmetrics.co.za', contactName: 'Isaiah Mpofu', phone: '+27 82 733 6873',
  bankName: 'First National Bank (FNB)', bankAccountName: 'Freelance Geomatics ZA (Pty) Ltd',
  bankAccountNumber: '62909760185', bankBranchCode: '250655', validityDays: 90,
  depositPercent: 50, vatRate: 15, vatDefaultEnabled: false,
  terms: [
    { heading: '1. DEFINITIONS', body: '1.1. The Company refers to Freelance Geomatics ZA (Pty) Ltd.\n1.2. The Client refers to the entity requesting the services.\n1.3. Services refers strictly to 3D Laser Scanning, Point Cloud Registration, and 3D Modelling/Drafting.' },
    { heading: '2. QUOTATION VALIDITY', body: '2.1. Quotations are valid for acceptance for the period stated from the date of issue.\n2.2. Pricing is based on the specific quantity, time, area and scope detailed in the quote. Any expansion of the scan area or level of detail requested on-site will require a variation order.' },
    { heading: '3. PAYMENT TERMS', body: '3.1. A 50% deposit is required upon acceptance to book the scanning team and equipment.\n3.2. The balance is due prior to release of final deliverables.\n3.3. Payments must use the business name or client name as reference.' },
    { heading: '4. SITE ACCESS AND SCANNING CONDITIONS', body: '4.1. Laser scanners operate on line-of-sight technology and can only capture visible surfaces.\n4.2. The Client must ensure the site is clear of temporary obstructions before arrival.\n4.3. The Company is not liable for data shadows caused by immovable objects. Additional access or scan setups may be quoted separately.\n4.4. Excessive vibration may result in data noise or re-scanning charged as additional time.' },
    { heading: '5. DELIVERABLES AND DATA', body: '5.1. Deliverables will be supplied in the formats specified in the quote.\n5.2. The Client is responsible for hardware capable of viewing and storing large scan files.\n5.3. Final drawings represent site conditions at the time of scanning.\n5.4. Raw scan data will be retained for 6 months; thereafter archiving is the Client responsibility.' },
    { heading: '6. EXCLUSIONS', body: '6.1. Unless itemized, services exclude sub-surface investigations or utility detection.\n6.2. Destructive testing is excluded.\n6.3. Confined-space scanning is excluded unless safety permits and specialized equipment is quoted.' },
    { heading: '7. INTELLECTUAL PROPERTY', body: '7.1. Processed point clouds and 3D models remain Company property until full payment. Upon payment, the Client receives a perpetual licence to use the data for the specified project.' },
  ],
};

const quote: QuoteRecord = {
  id: 'sample', quoteNumber: '3DSM-Q-2026-0001', leadId: 'sample-lead', status: 'DRAFT',
  clientCompany: 'Boitshoko', clientContact: 'Sabata Motshabaesi', clientEmail: 'sabata@boitshoko.co.za',
  clientPhone: '011 568 9969', clientAddress: 'Alrode, Gauteng',
  project: 'As-built 3D Laser Scanning 1x Boiler SAB Alrode',
  deliverablesSummary: '3D Revit Model LOD 300 and 2D Layouts', timeframe: '11 Days',
  issueDate: '2026-08-15', validityDays: 90, paymentReference: 'Boitshoko',
  vatEnabled: false, vatRate: 15, subtotal: 62500, vatAmount: 0, total: 62500,
  sections: [
    { id: 's1', title: '1. 3D Laser Scanning', items: [
      { id: 'i1', description: 'On-site scanning', rate: 12000, quantity: 2, unit: 'Days', amount: 24000 },
      { id: 'i2', description: 'Point cloud registration', rate: 3000, quantity: 2, unit: 'Days', amount: 6000 },
      { id: 'i3', description: 'Site establishment', rate: 2500, quantity: 1, unit: 'Item', amount: 2500 },
    ] },
    { id: 's2', title: '2. 2D Drawings', items: [{ id: 'i4', description: 'Exterior and interior layouts', rate: 5000, quantity: 1, unit: 'Item', amount: 5000 }] },
    { id: 's3', title: '3. 3D Drawings', items: [{ id: 'i5', description: 'Exterior and interior Revit model LOD 300', rate: 25000, quantity: 1, unit: 'Item', amount: 25000 }] },
  ],
  settings, terms: settings.terms,
};

async function main() {
  const outputDir = resolve(process.cwd(), '../output/pdf');
  mkdirSync(outputDir, { recursive: true });
  const output = resolve(outputDir, 'sample-formal-quote.pdf');
  writeFileSync(output, await generateQuotePDF(quote, { draft: true }));
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
