export type QuoteItem = {
  id: string;
  description: string;
  rate: number;
  quantity: number;
  unit: string;
  amount: number;
};

export type QuoteSection = { id: string; title: string; items: QuoteItem[] };
export type QuoteTerm = { heading: string; body: string };

export type QuoteSettings = {
  companyName: string;
  tradingName: string;
  registrationNumber: string;
  email: string;
  website: string;
  contactName: string;
  phone: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  validityDays: number;
  depositPercent: number;
  vatRate: number;
  vatDefaultEnabled: boolean;
  terms: QuoteTerm[];
};

export type QuoteRecord = {
  id: string;
  quoteNumber: string;
  leadId: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  project: string;
  deliverablesSummary: string;
  timeframe: string;
  issueDate: string;
  validityDays: number;
  paymentReference: string;
  vatEnabled: boolean;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  sections: QuoteSection[];
  settings: QuoteSettings;
  terms: QuoteTerm[];
};

export type QuoteDraftInput = Omit<
  QuoteRecord,
  'id' | 'quoteNumber' | 'status' | 'issueDate' | 'subtotal' | 'vatAmount' | 'total' | 'settings' | 'terms'
> & { id?: string };
