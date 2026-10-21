import { useState } from 'react';
import { useReport } from '@/hooks/useReport';
import type { StudentReportRow, StudentReportSummary } from '@/lib/dto';
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
      { value: 'active', label: 'Active' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'transferred', label: 'Transferred' },
      { value: 'left', label: 'Left' },
      { value: 'alumni', label: 'Alumni' },
    ],
  },
  { key: 'sectionId', label: 'Section ID', type: 'text' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'admissionNo', label: 'Adm No' },
  { key: 'fullName', label: 'Name' },
  { key: 'gender', label: 'Gender' },
  { key: 'status', label: 'Status', format: 'badge' },
  { key: 'sectionName', label: 'Section' },
  { key: 'className', label: 'Class' },
  { key: 'admissionDate', label: 'Admission Date', format: 'date' },
];

const SUMMARY_MONEY_KEYS: string[] = [];

export function StudentsReport() {
  const [values, setValues] = useState<Record<string, string>>({});

  const params: Record<string, string | undefined> = {
    from: values.from || undefined,
    to: values.to || undefined,
    status: values.status || undefined,
    sectionId: values.sectionId || undefined,
  };

  const { rows, meta, summary, loading, error, page, setPage } =
    useReport<StudentReportRow, StudentReportSummary>('students', params);

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
          moneyKeys={SUMMARY_MONEY_KEYS}
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

      <ExportBar type="students" params={params} />
    </div>
  );
}
