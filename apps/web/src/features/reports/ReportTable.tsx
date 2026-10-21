import type { ReactNode } from 'react';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/Pagination';
import { money, date, statusVariant } from '@/lib/format';
import type { ListMeta } from '@/hooks/useApiList';

export interface ColumnDef {
  key: string;
  label: string;
  /** How to format the cell value. Default: plain string. */
  format?: 'money' | 'date' | 'pct' | 'badge';
}

interface Props {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  meta: ListMeta | null;
  page: number;
  setPage: (n: number) => void;
  loading: boolean;
}

function formatCell(value: unknown, format?: ColumnDef['format']): ReactNode {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'money':
      return money(typeof value === 'number' ? value : Number(value));
    case 'date':
      return date(String(value));
    case 'pct':
      return `${typeof value === 'number' ? value.toFixed(1) : value}%`;
    case 'badge':
      return (
        <Badge variant={statusVariant(String(value))}>{String(value)}</Badge>
      );
    default:
      return String(value);
  }
}

/** Generic paginated table for report views. Shows skeleton rows while loading. */
export function ReportTable({ columns, rows, meta, page, setPage, loading }: Props) {
  const SKELETON_ROWS = 5;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              {columns.map((col) => (
                <TH key={col.key}>{col.label}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {loading &&
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TR key={`skel-${i}`} className="hover:bg-transparent">
                  {columns.map((col) => (
                    <TD key={col.key}>
                      <Skeleton className="h-4 w-20" />
                    </TD>
                  ))}
                </TR>
              ))}
            {!loading && rows.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  No data found.
                </TD>
              </TR>
            )}
            {!loading &&
              rows.map((row, i) => (
                <TR key={(row['id'] as string | number | undefined) ?? i}>
                  {columns.map((col) => (
                    <TD key={col.key}>{formatCell(row[col.key], col.format)}</TD>
                  ))}
                </TR>
              ))}
          </TBody>
        </Table>
      </div>
      {meta && meta.totalPages > 1 && (
        <Pagination meta={meta} page={page} onPage={setPage} noun="records" />
      )}
    </div>
  );
}
