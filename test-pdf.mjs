
import { exportDailyCollectionPdf, exportMonthlyRevenuePdf, exportWeeklyCollectionPdf, exportOutstandingPdf, exportIncomeExpensePdf, exportExpensesPdf, exportPlPdf, exportLedgerPdf, exportReceiptsPdf, exportCommissionsPdf, exportChartOfAccountsPdf, exportCorporateAccountsPdf, exportDashboardPdf, exportStatsPdf } from './src/app/lib/pdf-export.js';

async function test() {
  try {
    console.log('Testing exportPlPdf...');
    const buf1 = await exportPlPdf([{code: '4001', name: 'Revenue', balance: 5000}], [{code: '5001', name: 'Expense', balance: 2000}], 5000, 2000, 3000);
    console.log('exportPlPdf ok, size:', buf1.length);

    console.log('Testing exportLedgerPdf...');
    const buf2 = await exportLedgerPdf([{
      entryNumber: 'JE-001',
      date: new Date(),
      sourceType: 'manual',
      description: 'Test',
      lines: [{ accountId: { code: '1001', name: 'Cash' }, debit: 100, credit: 0 }]
    }]);
    console.log('exportLedgerPdf ok, size:', buf2.length);

    console.log('Testing exportExpensesPdf...');
    const buf3 = await exportExpensesPdf([{
      date: new Date(),
      category: 'reagent',
      vendorName: 'Acme',
      amount: 500,
      taxAmount: 50,
      paidFrom: 'cash'
    }]);
    console.log('exportExpensesPdf ok, size:', buf3.length);
  } catch (err) {
    console.error('PDF Export Error:', err);
  }
}
test();
