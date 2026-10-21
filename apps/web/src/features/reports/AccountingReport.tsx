import { useState } from 'react';
import { useReport } from '@/hooks/useReport';
import type { AccountingRow, AccountingSummary } from '@/lib/dto';
import { ReportFilters, type FilterDef } from './ReportFilters';
import { SummaryCards } from './SummaryCards';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ExportBar } from './ExportBar';

const FILTERS: FilterDef[] = [
  { key: 'from', label: 'From date', type: 'date' },
  { key: 'to', label: 'To date', type: 'date' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'month', label: 'Month' },
  { key: 'feeIncome', label: 'Fee Income', format: 'money' },
  { key: 'payrollExpense', label: 'Payroll Expense', format: 'money' },
  { key: 'net', label: 'Net', format: 'money' },
];

const MONEY_KEYS = ['totalIncome', 'totalExpense', 'netBalance'];

export function AccountingReport() {
  const [values, setValues] = useState<Record<string, string>>({});

  const params: Record<string, string | undefined> = {
    from: values.from || undefined,
    to: values.to || undefined,
  };

  // Accounting returns all monthly rows at once (no pagination).
  const { rows, summary, loading, error } =
    useReport<AccountingRow, AccountingSummary>('accounting', params);

  function handleFilterChange(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <ReportFilters filters={FILTERS} values={values} onChange={handleFilterChange} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <SummaryCards
          summary={summary as unknown as Record<string, number | string>}
          moneyKeys={MONEY_KEYS}
        />
      )}

      {/* No pagination for accounting — all months returned at once */}
      <ReportTable
        columns={COLUMNS}
        rows={rows as unknown as Record<string, unknown>[]}
        meta={null}
        page={1}
        setPage={() => undefined}
        loading={loading}
      />

      <ExportBar type="accounting" params={params} />
    </div>
  );
}
