import { useState } from 'react';
import { useReport } from '@/hooks/useReport';
import type { FeeReportRow, FeeReportSummary } from '@/lib/dto';
import { ReportFilters, type FilterDef } from './ReportFilters';
import { SummaryCards } from './SummaryCards';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ExportBar } from './ExportBar';

const FILTERS: FilterDef[] = [
  { key: 'from', label: 'From date', type: 'date' },
  { key: 'to', label: 'To date', type: 'date' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: '', label: 'All statuses' },
      { value: 'paid', label: 'Paid' },
      { value: 'partial', label: 'Partial' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'pending', label: 'Pending' },
    ],
  },
];

const COLUMNS: ColumnDef[] = [
  { key: 'admissionNo', label: 'Adm No' },
  { key: 'studentName', label: 'Student' },
  { key: 'challanNo', label: 'Challan No' },
  { key: 'total', label: 'Total', format: 'money' },
  { key: 'paid', label: 'Paid', format: 'money' },
  { key: 'outstanding', label: 'Outstanding', format: 'money' },
  { key: 'dueDate', label: 'Due Date', format: 'date' },
  { key: 'status', label: 'Status', format: 'badge' },
];

const MONEY_KEYS = ['totalCharged', 'totalCollected', 'totalOutstanding'];

export function FeesReport() {
  const [values, setValues] = useState<Record<string, string>>({});

  const params: Record<string, string | undefined> = {
    from: values.from || undefined,
    to: values.to || undefined,
    status: values.status || undefined,
  };

  const { rows, meta, summary, loading, error, page, setPage } =
    useReport<FeeReportRow, FeeReportSummary>('fees', params);

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

      <ExportBar type="fees" params={params} />
    </div>
  );
}
