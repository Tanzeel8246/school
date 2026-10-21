import { useState } from 'react';
import { useReport } from '@/hooks/useReport';
import type { PayrollReportRow, PayrollReportSummary } from '@/lib/dto';
import { ReportFilters, type FilterDef } from './ReportFilters';
import { SummaryCards } from './SummaryCards';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ExportBar } from './ExportBar';

const FILTERS: FilterDef[] = [
  { key: 'period', label: 'Period (YYYY-MM)', type: 'text' },
  {
    key: 'staffType',
    label: 'Staff type',
    type: 'select',
    options: [
      { value: '', label: 'All types' },
      { value: 'admin', label: 'Admin' },
      { value: 'accountant', label: 'Accountant' },
      { value: 'clerk', label: 'Clerk' },
      { value: 'support', label: 'Support' },
      { value: 'driver', label: 'Driver' },
    ],
  },
];

const COLUMNS: ColumnDef[] = [
  { key: 'employeeId', label: 'Emp ID' },
  { key: 'staffName', label: 'Name' },
  { key: 'staffType', label: 'Type' },
  { key: 'baseSalary', label: 'Base Salary', format: 'money' },
  { key: 'allowances', label: 'Allowances', format: 'money' },
  { key: 'deductions', label: 'Deductions', format: 'money' },
  { key: 'netSalary', label: 'Net Salary', format: 'money' },
  { key: 'status', label: 'Status', format: 'badge' },
];

const MONEY_KEYS = ['totalNetSalary', 'totalAllowances', 'totalDeductions'];

export function PayrollReport() {
  const [values, setValues] = useState<Record<string, string>>({});

  const params: Record<string, string | undefined> = {
    period: values.period || undefined,
    staffType: values.staffType || undefined,
  };

  const { rows, meta, summary, loading, error, page, setPage } =
    useReport<PayrollReportRow, PayrollReportSummary>('payroll', params);

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

      <ReportTable
        columns={COLUMNS}
        rows={rows as unknown as Record<string, unknown>[]}
        meta={meta}
        page={page}
        setPage={setPage}
        loading={loading}
      />

      <ExportBar type="payroll" params={params} />
    </div>
  );
}
