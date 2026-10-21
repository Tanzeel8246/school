import { useState } from 'react';
import { useReport } from '@/hooks/useReport';
import type { AttendanceReportRow, AttendanceReportSummary } from '@/lib/dto';
import { ReportFilters, type FilterDef } from './ReportFilters';
import { SummaryCards } from './SummaryCards';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ExportBar } from './ExportBar';

const FILTERS: FilterDef[] = [
  { key: 'from', label: 'From date', type: 'date' },
  { key: 'to', label: 'To date', type: 'date' },
  { key: 'sectionId', label: 'Section ID', type: 'text' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'fullName', label: 'Name' },
  { key: 'admissionNo', label: 'Adm No' },
  { key: 'sectionName', label: 'Section' },
  { key: 'presentDays', label: 'Present' },
  { key: 'absentDays', label: 'Absent' },
  { key: 'lateDays', label: 'Late' },
  { key: 'attendancePct', label: 'Attendance %', format: 'pct' },
];

export function AttendanceReport() {
  const [values, setValues] = useState<Record<string, string>>({});

  const params: Record<string, string | undefined> = {
    from: values.from || undefined,
    to: values.to || undefined,
    sectionId: values.sectionId || undefined,
  };

  const { rows, meta, summary, loading, error, page, setPage } =
    useReport<AttendanceReportRow, AttendanceReportSummary>('attendance', params);

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

      <ExportBar type="attendance" params={params} />
    </div>
  );
}
