import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';
import { requireUser, audit } from '@/lib/auth';

const logExpenseTool = {
  name: 'log_expense',
  description: 'Logs a business expense into the CRM ledger',
  parameters: {
    type: 'OBJECT',
    properties: {
      vendor: { type: 'STRING', description: 'The name of the vendor or supplier' },
      amount: { type: 'NUMBER', description: 'The total amount of the expense in ZAR' },
      category: {
        type: 'STRING',
        description: 'The category of the expense (e.g. Hardware/Equipment, Travel, Software)',
      },
    },
    required: ['vendor', 'amount', 'category'],
  },
};

const getFinancialSummaryTool = {
  name: 'get_financial_summary',
  description: 'Retrieves the total revenue, expenses, and net profit for the business',
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { prompt } = (await req.json()) as { prompt: string };
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const db = await getDb();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are the Executive AI Assistant inside MetricsCRM. For expenses, extract a proposed draft. Never claim it was saved unless the user explicitly uses the word confirm in their current message.',
        tools: [{ functionDeclarations: [logExpenseTool, getFinancialSummaryTool] }],
        temperature: 0,
      },
    });

    const call = response.functionCalls?.[0];

    if (call) {
      if (call.name === 'log_expense') {
        if (!['ADMIN','FINANCE'].includes(user.role)) return NextResponse.json({error:'Not authorized'},{status:403});
        const { vendor, amount, category } = call.args as {
          vendor: string;
          amount: number;
          category: string;
        };
        if (!prompt.toLowerCase().includes('confirm')) return NextResponse.json({text:`Please confirm this expense before I post it: ${vendor}, R${Number(amount).toFixed(2)}, category ${category}. Reply “confirm” with these details to continue.`,actionTaken:false});
        if (!vendor.trim() || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({error:'Invalid expense details'},{status:400});
        const cat=await db.prepare('SELECT id,name FROM expense_categories WHERE lower(name)=lower(?) AND active=1').bind(category).first<{id:string;name:string}>();
        if(!cat)return NextResponse.json({text:`I could not post this because “${category}” is not an active expense category.`,actionTaken:false});
        const id=randomUUID(),value=Math.round(amount*100);
        const duplicate=await db.prepare("SELECT id FROM expenses WHERE supplier=? AND transaction_date=date('now') AND total_cents=? AND status!='VOID'").bind(vendor,value).first();
        if(duplicate)return NextResponse.json({text:'A matching expense already exists today. Please use the Expenses screen if this is intentionally a duplicate.',actionTaken:false});
        await db.prepare("INSERT INTO expenses(id,supplier,description,transaction_date,category_id,amount_ex_vat_cents,total_cents,status,source,created_by) VALUES(?,?,?,date('now'),?,?,?,'POSTED','AI',?)").bind(id,vendor,vendor,cat.id,value,value,user.id).run();
        await audit('EXPENSE_CREATED','expense',id,{source:'AI'});

        return NextResponse.json({
          text: `Done! I have successfully logged a ${amount} ZAR expense for ${vendor} under ${category}.`,
          actionTaken: true,
        });
      }

      if (call.name === 'get_financial_summary') {
        const invoices = (
          await db.prepare("SELECT amount FROM invoices WHERE status = 'PAID'").all<{ amount: number }>()
        ).results ?? [];
        const expenses = (await db.prepare("SELECT total_cents FROM expenses WHERE status='POSTED'").all<{ total_cents: number }>()).results ?? [];

        const rev = invoices.reduce((s: number, i: { amount: number }) => s + (i.amount || 0), 0);
        const exp = expenses.reduce((s: number, e: { total_cents: number }) => s + (e.total_cents || 0)/100, 0);
        const profit = rev - exp;

        const summaryResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `The financial data is: Revenue=${rev}, Expenses=${exp}, Profit=${profit}. Please summarize this professionally in one sentence for the director.`,
          config: { temperature: 0.3 },
        });

        return NextResponse.json({
          text: summaryResponse.text,
          actionTaken: false,
        });
      }
    }

    return NextResponse.json({ text: response.text, actionTaken: false });
  } catch (error) {
    console.error('[Assistant Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
