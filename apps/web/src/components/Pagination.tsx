import { Button } from '@/components/ui/button';
import type { ListMeta } from '@/hooks/useApiList';

/** Footer pager + total count, shared by list pages. */
export function Pagination({
  meta,
  page,
  onPage,
  noun,
}: {
  meta: ListMeta | null;
  page: number;
  onPage: (p: number) => void;
  noun: string;
}) {
  if (!meta) return null;
  const totalPages = meta.totalPages || 1;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {meta.total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Prev
        </Button>
        <span className="px-2">
          {meta.page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
